"use client";

import { memo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enregistrerEntreeHabitude, supprimerHabitude, type HabitudeDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { restaurerElement } from "@/lib/query/rollback";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { HabitudeForm } from "./HabitudeForm";
import { ProgressRing } from "@/components/ProgressRing";
import { card, dangerButton, ghostButton, input, listCard, metaText, nameText, pillTag } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import { vibrate } from "@/lib/haptics";
import { aujourdhuiParis } from "@/lib/date/paris";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import { CheckIcon, FlameIcon } from "@/components/icons";

function HabitudeCardBase({ habitude, date }: { habitude: HabitudeDuJour; date: string }) {
  const [editing, setEditing] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const [isPending, startTransition] = useTransition();
  const valeurServeur = habitude.entreeDuJour ? String(habitude.entreeDuJour.valeur) : "";
  const [valeurInput, setValeurInput] = useState(valeurServeur);
  // Resynchronise la saisie quand le serveur change la valeur (autre appareil,
  // dashboard) ou que la date affichée change : sinon un blur ultérieur
  // réécrirait l'ancienne valeur par-dessus.
  const cleServeur = `${date}|${valeurServeur}`;
  const [cleVue, setCleVue] = useState(cleServeur);
  if (cleVue !== cleServeur) {
    setCleVue(cleServeur);
    setValeurInput(valeurServeur);
  }
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.habitudes(date) });
    // La progression des objectifs liés dépend de ces check.
    queryClient.invalidateQueries({ queryKey: ["objectif"] });
  }

  // Cocher/décocher une habitude booléenne ou série est l'action la plus
  // fréquente du module : optimiste (le ring bascule à l'instant du tap),
  // rollback silencieux + toast discret si le serveur échoue. Le streak
  // affiché reste celui d'avant le tap le temps du round-trip (recalculé
  // côté serveur, pas approximé ici) — `onSettled` réconcilie.
  const toggleMutation = useMutation({
    // Sans `always`, TanStack met la mutation en pause hors ligne et le
    // repli `enqueueAction` ci-dessous n'est jamais atteint.
    networkMode: "always",
    // `enfile` : pas d'invalidation quand la coche est partie en file hors
    // ligne, sinon un refetch réussi relirait l'ancien état serveur et la coche
    // sauterait en arrière jusqu'au rejeu.
    mutationFn: async (nouvelleValeur: number): Promise<{ enfile: boolean }> => {
      vibrate();
      try {
        await enregistrerEntreeHabitude(habitude.id, date, nouvelleValeur);
        return { enfile: false };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("habitudes", "enregistrerEntreeHabitude", [habitude.id, date, nouvelleValeur]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
        return { enfile: true };
      }
    },
    onMutate: async (nouvelleValeur) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habitudes(date) });
      const previous = queryClient.getQueryData<HabitudeDuJour[]>(queryKeys.habitudes(date));
      queryClient.setQueryData<HabitudeDuJour[]>(queryKeys.habitudes(date), (old) =>
        old?.map((h) =>
          h.id === habitude.id
            ? {
                ...h,
                entreeDuJour: h.entreeDuJour
                  ? { ...h.entreeDuJour, valeur: nouvelleValeur }
                  : { id: "", habitude_id: h.id, date, valeur: nouvelleValeur, created_at: new Date().toISOString() },
              }
            : h
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      restaurerElement(queryClient, queryKeys.habitudes(date), context?.previous, habitude.id);
      showToast("Impossible de mettre à jour l'habitude.");
    },
    onSettled: (resultat) => {
      if (!resultat?.enfile) invalidate();
    },
  });

  if (editing) {
    return (
      <li className={card}>
        <HabitudeForm
          habitude={habitude}
          onDone={() => {
            setEditing(false);
            invalidate();
          }}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-2 text-sm text-ink-2 underline"
        >
          Annuler
        </button>
      </li>
    );
  }

  const valeur = habitude.entreeDuJour?.valeur ?? 0;
  const fait = valeur > 0;
  const atteint = habitude.valeur_cible != null && valeur >= habitude.valeur_cible;
  const pct = habitude.type === "quantifiee" && habitude.valeur_cible ? valeur / habitude.valeur_cible : fait ? 1 : 0;

  function enregistrerValeur() {
    // Champ vide : rien à enregistrer (Number("") vaudrait 0 et écraserait la valeur du jour).
    if (valeurInput.trim() === "") return;
    const valeur = Number(valeurInput);
    if (!Number.isFinite(valeur) || valeur < 0) return;
    // Valeur inchangée : pas d'aller-retour serveur à chaque blur.
    if (habitude.entreeDuJour && habitude.entreeDuJour.valeur === valeur) return;
    // Même patron que le toggle ci-dessus : hors ligne, mise en file ;
    // autre échec, toast `role="alert"` et saisie conservée — plus jamais
    // d'exception vers error.tsx (constat T1).
    startTransition(async () => {
      try {
        await enregistrerEntreeHabitude(habitude.id, date, valeur);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueueAction("habitudes", "enregistrerEntreeHabitude", [habitude.id, date, valeur]);
          showToast("Enregistré, sera synchronisé à la reconnexion");
        } else {
          showErrorToast(`La valeur de « ${habitude.nom} » n'a pas pu être enregistrée. Réessaie.`);
          return;
        }
      }
      invalidate();
    });
  }

  function supprimer() {
    if (!confirmDelete(`Supprimer l'habitude « ${habitude.nom} » ?`)) return;
    startTransition(async () => {
      try {
        await supprimerHabitude(habitude.id);
      } catch (err) {
        if (!isNetworkError(err)) {
          showErrorToast(`Impossible de supprimer « ${habitude.nom} ». Réessaie.`);
          return;
        }
        await enqueueAction("habitudes", "supprimerHabitude", [habitude.id, aujourdhuiParis()]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
      }
      invalidate();
    });
  }

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
      className={listCard}
    >
      <div className="flex items-start gap-3">
        <ProgressRing size={34} strokeWidth={4} pct={pct} color="var(--accent-habitudes)">
          {habitude.type !== "quantifiee" && (
            <button
              type="button"
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate(fait ? 0 : 1)}
              aria-label={fait ? "Marquer non fait" : "Marquer fait"}
              className="flex h-full w-full items-center justify-center"
            >
              {fait ? (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M1 6l3.2 3.2L11 2" stroke="var(--accent-habitudes)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="text-sm">{habitude.icone || ""}</span>
              )}
            </button>
          )}
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className={nameText}>
              {habitude.icone && <span className="mr-1.5">{habitude.icone}</span>}
              {habitude.nom}
            </p>
            {habitude.streak > 0 && (habitude.type === "streak" || habitude.frequence_hebdo != null) && (
              <span className={`${pillTag} inline-flex items-center gap-1 tabular-nums`}>
                <FlameIcon size={12} />
                <span className="sr-only">Série : </span>
                {habitude.streak}
                {habitude.frequence_hebdo != null ? " sem." : "j"}
              </span>
            )}
          </div>

          {habitude.frequence_hebdo != null && (
            <p className={`${metaText} tabular-nums`}>
              {habitude.faitsCetteSemaine} / {habitude.frequence_hebdo} cette semaine
            </p>
          )}
          {habitude.objectifs.length > 0 && (
            <p className={metaText}>
              Objectif : {habitude.objectifs.map((o) => o.titre).join(", ")}
            </p>
          )}

          {habitude.type === "quantifiee" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                aria-label={`Valeur de ${habitude.nom}`}
                value={valeurInput}
                onChange={(e) => setValeurInput(e.target.value)}
                onBlur={enregistrerValeur}
                disabled={isPending}
                className={`${input} w-24 py-1.5`}
              />
              <span className={metaText}>
                {habitude.unite}
                {habitude.valeur_cible != null && ` / ${habitude.valeur_cible}`}
              </span>
              {atteint && (
                <span className={`${metaText} inline-flex items-center gap-1`}>
                  <CheckIcon size={12} />
                  objectif atteint
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
          Modifier
        </button>
        <button type="button" disabled={isPending} onClick={supprimer} className={dangerButton}>
          Supprimer
        </button>
      </div>
    </motion.li>
  );
}

export const HabitudeCard = memo(HabitudeCardBase);
