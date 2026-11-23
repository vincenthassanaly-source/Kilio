"use client";

import { memo } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enregistrerEntreeHabitude, type HabitudeDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { restaurerElement } from "@/lib/query/rollback";
import { showToast } from "@/components/toast/toast-store";
import { ProgressRing } from "@/components/ProgressRing";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import { CheckIcon, FlameIcon } from "@/components/icons";

export const DashboardHabitItem = memo(function DashboardHabitItem({
  habitude,
  date,
}: {
  habitude: HabitudeDuJour;
  date: string;
}) {
  const queryClient = useQueryClient();
  const valeur = habitude.entreeDuJour?.valeur ?? 0;
  const fait = valeur > 0;
  const pct =
    habitude.type === "quantifiee" && habitude.valeur_cible
      ? valeur / habitude.valeur_cible
      : fait
        ? 1
        : 0;

  // Même mutation optimiste que HabitudeCard (src/app/(app)/habitudes/HabitudeCard.tsx),
  // sur la même query key : cocher depuis le dashboard ou /habitudes met à
  // jour le même cache.
  const toggleMutation = useMutation({
    // Sans `always`, TanStack met la mutation en pause hors ligne et le
    // repli `enqueueAction` ci-dessous n'est jamais atteint.
    networkMode: "always",
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
      restaurerElement(queryClient, queryKeys.habitudes(date), context?.previous, habitude.id);
      showToast("Impossible de mettre à jour l'habitude.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habitudes(date) });
    },
  });

  function toggle() {
    if (habitude.type === "quantifiee") return;
    toggleMutation.mutate(fait ? 0 : 1);
  }

  const classeTuile =
    "flex w-[60px] shrink-0 flex-col items-center gap-1.5 rounded-2xl pb-1 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";
  const nom = (
    // Deux lignes plutôt qu'une coupure à ~12 caractères : « Boire 2 L … » ne dit pas quelle habitude.
    <span className="line-clamp-2 w-full break-words text-center text-micro font-semibold leading-tight text-ink-2">{habitude.nom}</span>
  );

  // Habitude chiffrée : une valeur se saisit, elle ne se coche pas (pas de « +1 »).
  // La tuile mène à Habitudes, où se trouve le champ ; anneau en pointillé et
  // valeur du jour sous le nom pour la distinguer d'une tuile à cocher.
  if (habitude.type === "quantifiee") {
    const valeurLue = `${valeur}${habitude.valeur_cible != null ? ` / ${habitude.valeur_cible}` : ""}${habitude.unite ? ` ${habitude.unite}` : ""}`;
    return (
      <Link
        href="/habitudes"
        aria-label={`${habitude.nom} : ${valeurLue}. Saisir la valeur dans Habitudes`}
        className={classeTuile}
      >
        <span className="relative">
          <ProgressRing size={50} strokeWidth={5} pct={pct} color="var(--accent-habitudes)">
            <span className="text-base leading-none">{habitude.icone || <CheckIcon size={16} />}</span>
          </ProgressRing>
          {/* Contour pointillé : se lit « à saisir » plutôt que « à cocher ». */}
          <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full border border-dashed border-control-border" />
        </span>
        {nom}
        <span aria-hidden className="text-micro font-bold tabular-nums text-ink-2">
          {valeur}
          {habitude.valeur_cible != null && `/${habitude.valeur_cible}`}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={toggleMutation.isPending}
      onClick={toggle}
      aria-pressed={fait}
      className={classeTuile}
    >
      <ProgressRing size={50} strokeWidth={5} pct={pct} color="var(--accent-habitudes)" trackColor="var(--control-border)">
        <span className="text-base leading-none">{habitude.icone || <CheckIcon size={16} />}</span>
      </ProgressRing>
      {nom}
      {(habitude.type === "streak" || habitude.frequence_hebdo != null) && habitude.streak > 0 && (
        <span className="inline-flex items-center gap-0.5 text-micro font-bold text-habitudes">
          <FlameIcon size={12} />
          <span className="sr-only">Série : </span>
          {habitude.streak}
        </span>
      )}
    </button>
  );
});
