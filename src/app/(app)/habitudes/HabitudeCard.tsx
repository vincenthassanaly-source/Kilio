"use client";

import { memo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { enregistrerEntreeHabitude, supprimerHabitude, type HabitudeDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { restaurerElement } from "@/lib/query/rollback";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { HabitudeForm } from "./HabitudeForm";
import { ProgressRing } from "@/components/ProgressRing";
import { card, input, listCard, metaText, nameTextComplet, pillTag, textButton } from "@/lib/ui";
import { MenuHabitude } from "./MenuHabitude";
import { vibrate } from "@/lib/haptics";
import { aujourdhuiParis } from "@/lib/date/paris";
import { erreurValeurEntree, VALEUR_MAX_ENTREE_HABITUDE } from "@/lib/habitudes/compute";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import { CheckIcon, FlameIcon } from "@/components/icons";

function HabitudeCardBase({ habitude, date }: { habitude: HabitudeDuJour; date: string }) {
  const [editing, setEditing] = useState(false);
  const [masquee, setMasquee] = useState(false);
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
          className={`mt-2 ${textButton}`}
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
  const cochable = habitude.type !== "quantifiee";

  function enregistrerValeur() {
    // Champ vide : rien à enregistrer (Number("") vaudrait 0 et écraserait la valeur du jour).
    if (valeurInput.trim() === "") return;
    const valeur = Number(valeurInput);
    const erreur = erreurValeurEntree(valeur);
    if (erreur) {
      showErrorToast(erreur);
      return;
    }
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

  // Suppression différée : l'habitude disparaît tout de suite, « Annuler » la
  // ramène pendant le délai du toast, la Server Action ne part qu'ensuite.
  function supprimer() {
    supprimerAvecAnnulation({
      texte: `Habitude « ${habitude.nom} » archivée`,
      ariaLabel: `Annuler l'archivage de l'habitude « ${habitude.nom} »`,
      masquer: () => setMasquee(true),
      restaurer: () => setMasquee(false),
      supprimer: async () => {
        try {
          await supprimerHabitude(habitude.id);
        } catch (err) {
          if (!isNetworkError(err)) throw err;
          await enqueueAction("habitudes", "supprimerHabitude", [habitude.id, aujourdhuiParis()]);
          showToast("Enregistré, sera synchronisé à la reconnexion");
        }
      },
      erreur: `Impossible d'archiver « ${habitude.nom} ». Réessaie.`,
      onSupprime: invalidate,
    });
  }

  if (masquee) return null;

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
      // Habitude à cocher : toute la ligne coche (le bouton de l'anneau reste
      // la commande accessible au clavier). Les autres commandes de la carte
      // (menu « … », champ) gardent leur propre geste.
      onClick={
        cochable
          ? (e: React.MouseEvent) => {
              if ((e.target as HTMLElement).closest("button, input, a, [role='menu']")) return;
              if (!toggleMutation.isPending) toggleMutation.mutate(fait ? 0 : 1);
            }
          : undefined
      }
      className={`${listCard} ${cochable ? "cursor-pointer" : "active:scale-100!"}`}
    >
      <div className="flex items-start gap-3">
        <ProgressRing
          size={34}
          strokeWidth={4}
          pct={pct}
          color="var(--accent-habitudes)"
          trackColor={habitude.type === "quantifiee" ? undefined : "var(--control-border)"}
        >
          {/* Quantifiée : l'icône vit dans l'anneau comme pour les autres
              types (et sur la tuile d'Aujourd'hui), pour que tous les noms
              partent du même bord. */}
          {habitude.type === "quantifiee" && habitude.icone && (
            <span aria-hidden="true" className="text-small leading-none">
              {habitude.icone}
            </span>
          )}
          {habitude.type !== "quantifiee" && (
            <button
              type="button"
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate(fait ? 0 : 1)}
              aria-label={habitude.nom}
              aria-pressed={fait}
              className="relative flex h-full w-full items-center justify-center after:absolute after:-inset-[5px] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
            >
              {fait ? (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M1 6l3.2 3.2L11 2" stroke="var(--accent-habitudes)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                habitude.icone ? (
                  <span className="text-small">{habitude.icone}</span>
                ) : (
                  <span className="text-ink-3">
                    <CheckIcon size={12} />
                  </span>
                )
              )}
            </button>
          )}
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            {/* flex-1 : la pastille de série se range contre le menu « … »
                au lieu de flotter au milieu de la ligne. */}
            <p className={`min-w-0 flex-1 ${nameTextComplet}`}>{habitude.nom}</p>
            {habitude.streak > 0 && (habitude.type === "streak" || habitude.frequence_hebdo != null) && (
              <span className={`${pillTag} inline-flex items-center gap-1 tabular-nums`}>
                <FlameIcon size={12} />
                <span className="sr-only">Série : </span>
                {habitude.streak}
                {habitude.frequence_hebdo != null ? " sem." : " j"}
              </span>
            )}
            <MenuHabitude
              nom={habitude.nom}
              disabled={isPending}
              onModifier={() => setEditing(true)}
              onArchiver={supprimer}
            />
          </div>

          {habitude.frequence_hebdo != null && (
            <p className={`${metaText} tabular-nums`}>
              {habitude.faitsCetteSemaine} / {habitude.frequence_hebdo} cette semaine
            </p>
          )}

          {habitude.type === "quantifiee" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max={VALEUR_MAX_ENTREE_HABITUDE}
                step="any"
                aria-label={`Valeur de ${habitude.nom}`}
                value={valeurInput}
                onChange={(e) => setValeurInput(e.target.value)}
                onBlur={enregistrerValeur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                enterKeyHint="done"
                disabled={isPending}
                className={`${input} w-24 py-2.5`}
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
    </motion.li>
  );
}

export const HabitudeCard = memo(HabitudeCardBase);
