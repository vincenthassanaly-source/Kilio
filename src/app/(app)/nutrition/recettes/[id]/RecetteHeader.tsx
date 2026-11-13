"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteRecette } from "@/app/actions/recettes";
import type { Tables } from "@/lib/supabase/types";
import { card, dangerButton, ghostButton, textButton } from "@/lib/ui";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { BackLink } from "@/components/BackLink";

const RecetteForm = dynamic(() => import("../RecetteForm").then((m) => m.RecetteForm), { ssr: false });

const SOURCE_LABEL: Record<string, string> = {
  manuel: "Manuel",
  hellofresh: "HelloFresh",
};

export function RecetteHeader({
  recette,
}: {
  recette: Tables<"recettes">;
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  if (editing) {
    return (
      <div className={card}>
        <RecetteForm recette={recette} onDone={() => setEditing(false)} />
        <button type="button" onClick={() => setEditing(false)} className={`mt-2 ${textButton}`}>
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <BackLink href="/nutrition/recettes">Recettes</BackLink>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            style={{ viewTransitionName: `recette-title-${recette.id}` }}
            className="mt-1 text-balance break-words font-display text-heading font-semibold text-ink"
          >
            {recette.nom}
          </h1>
          <p className="text-small text-ink-2">
            {SOURCE_LABEL[recette.source]}
            {recette.temps_prepa_min != null ? ` · ${recette.temps_prepa_min} min` : ""}
            {" · "}
            {recette.portions} portion{recette.portions > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
            Éditer
          </button>
          <button
            type="button"
            onClick={() =>
              // Suppression différée : retour à la liste (où la recette est
              // masquée), « Annuler » la ramène pendant le délai du toast ; ses
              // ingrédients et étapes partent avec elle à l'expiration.
              supprimerAvecAnnulation({
                texte: `Recette « ${recette.nom} » supprimée`,
                ariaLabel: `Annuler la suppression de la recette « ${recette.nom} »`,
                masque: { type: "recette", id: recette.id },
                masquer: () => router.push("/nutrition/recettes"),
                supprimer: () => deleteRecette(recette.id),
                erreur: `Impossible de supprimer la recette « ${recette.nom} ». Réessaie.`,
              })
            }
            aria-label={`Supprimer la recette « ${recette.nom} »`}
            className={dangerButton}
          >
            Supprimer
          </button>
        </div>
      </div>
      {recette.description && <p className="text-sm text-ink text-pretty">{recette.description}</p>}
    </div>
  );
}
