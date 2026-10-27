"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { changerStatutObjectif, supprimerObjectif } from "@/app/actions/objectifs";
import { queryKeys } from "@/lib/query/keys";
import { ObjectifForm } from "../ObjectifForm";
import type { Enums, Tables } from "@/lib/supabase/types";
import { card, dangerButton, errorText, ghostButton } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import { runAction } from "@/lib/actions/runAction";
import { SegmentedControl } from "@/components/SegmentedControl";
import { BackLink } from "@/components/BackLink";

const STATUT_LABELS: Record<Enums<"statut_objectif">, string> = {
  en_cours: "En cours",
  atteint: "Atteint",
  abandonne: "Abandonné",
};

const CATEGORIE_LABELS: Record<Enums<"categorie_objectif">, string> = {
  perso: "Personnel",
  pro: "Professionnel",
};

function formatEcheance(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ObjectifHeader({ objectif }: { objectif: Tables<"objectifs"> }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function invalidate() {
    // Les pages liste et détail lisent deux clés TanStack Query disjointes
    // (`objectifs` / `objectif(id)`) : n'invalider que l'une des deux laisse
    // l'autre afficher un statut/titre périmé jusqu'à 30s après une
    // modification faite ici (CLICK-PATH-501).
    queryClient.invalidateQueries({ queryKey: queryKeys.objectif(objectif.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.objectifs });
  }

  if (editing) {
    return (
      <div className={card}>
        <ObjectifForm
          objectif={objectif}
          onDone={() => {
            setEditing(false);
            invalidate();
          }}
        />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-sm text-ink-2 underline">
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <BackLink href="/objectifs">Objectifs</BackLink>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            style={{ viewTransitionName: `objectif-title-${objectif.id}` }}
            className="mt-1 truncate font-display text-[22px] font-semibold text-ink"
          >
            {objectif.titre}
          </h1>
          <p className="text-[13px] text-ink-2">
            {CATEGORIE_LABELS[objectif.categorie]}
            {objectif.date_echeance ? ` · Échéance : ${formatEcheance(objectif.date_echeance)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
            Éditer
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirmDelete(`Supprimer l'objectif « ${objectif.titre} » ?`)) return;
              setError(null);
              // Invalidée avant l'appel, pas après : `supprimerObjectif` se
              // termine par `redirect("/objectifs")`, qui jette et empêche
              // tout code placé après l'`await` de s'exécuter.
              queryClient.invalidateQueries({ queryKey: queryKeys.objectifs });
              startTransition(async () => {
                try {
                  await supprimerObjectif(objectif.id);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Erreur inconnue.");
                }
              });
            }}
            className={dangerButton}
          >
            Suppr.
          </button>
        </div>
      </div>

      {objectif.description && <p className="text-sm text-ink text-pretty">{objectif.description}</p>}

      {/* Contrôle segmenté (T7) au lieu d'une liste déroulante à 3 choix. */}
      <SegmentedControl
        ariaLabel="Statut de l'objectif"
        taille="sm"
        options={(Object.keys(STATUT_LABELS) as Enums<"statut_objectif">[]).map((key) => ({
          value: key,
          label: STATUT_LABELS[key],
        }))}
        value={objectif.statut}
        onChange={(statut) => {
          if (isPending || statut === objectif.statut) return;
          startTransition(async () => {
            // Contrat T1 : un échec s'affiche en toast au lieu d'error.tsx.
            const resultat = await runAction(() => changerStatutObjectif(objectif.id, statut), {
              erreur: "Le statut n'a pas pu être changé. Réessaie.",
            });
            if (resultat.ok) invalidate();
          });
        }}
      />

      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
