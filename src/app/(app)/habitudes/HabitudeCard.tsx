"use client";

import { memo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enregistrerEntreeHabitude, supprimerHabitude, type HabitudeDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { HabitudeForm } from "./HabitudeForm";
import { ProgressRing } from "@/components/ProgressRing";
import { card, dangerButton, ghostButton, input, listCard, metaText, nameText, pillTag } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";

function HabitudeCardBase({ habitude, date }: { habitude: HabitudeDuJour; date: string }) {
  const [editing, setEditing] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const [isPending, startTransition] = useTransition();
  const [valeurInput, setValeurInput] = useState(
    habitude.entreeDuJour ? String(habitude.entreeDuJour.valeur) : ""
  );
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
    mutationFn: async (nouvelleValeur: number) => {
      vibrate();
      try {
        await enregistrerEntreeHabitude(habitude.id, date, nouvelleValeur);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("habitudes", "enregistrerEntreeHabitude", [habitude.id, date, nouvelleValeur]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
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
      if (context?.previous) queryClient.setQueryData(queryKeys.habitudes(date), context.previous);
      showToast("Impossible de mettre à jour l'habitude.");
    },
    onSettled: invalidate,
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
    const valeur = Number(valeurInput);
    if (!Number.isFinite(valeur) || valeur < 0) return;
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
        await enqueueAction("habitudes", "supprimerHabitude", [habitude.id]);
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
              <span className={`${pillTag} tabular-nums`}>
                🔥 {habitude.streak}
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
              {atteint && <span className={metaText}>✓ objectif atteint</span>}
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
