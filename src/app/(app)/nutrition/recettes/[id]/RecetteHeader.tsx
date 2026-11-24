"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteRecette } from "@/app/actions/recettes";
import type { Tables } from "@/lib/supabase/types";
import { card, textButton } from "@/lib/ui";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { BackLink } from "@/components/BackLink";
import { MenuActions } from "@/components/MenuActions";

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
        {/* Actions de gestion rares rangées dans le menu « … » (DESIGN.md,
            MenuActions) : le nom de la recette garde toute la largeur. */}
        <div className="shrink-0">
          <MenuActions
            libelle={`Actions de la recette « ${recette.nom} »`}
            libelleMenu={`Actions de la recette « ${recette.nom} »`}
            actions={[
              { libelle: "Modifier", onSelect: () => setEditing(true) },
              {
                libelle: "Supprimer",
                // Suppression différée : retour à la liste (où la recette est
                // masquée), « Annuler » la ramène pendant le délai du toast ; ses
                // ingrédients et étapes partent avec elle à l'expiration.
                onSelect: () =>
                  supprimerAvecAnnulation({
                    texte: `Recette « ${recette.nom} » supprimée`,
                    ariaLabel: `Annuler la suppression de la recette « ${recette.nom} »`,
                    masque: { type: "recette", id: recette.id },
                    masquer: () => router.push("/nutrition/recettes"),
                    supprimer: () => deleteRecette(recette.id),
                    erreur: `Impossible de supprimer la recette « ${recette.nom} ». Réessaie.`,
                  }),
              },
            ]}
          />
        </div>
      </div>
      {recette.description && <p className="text-small text-ink text-pretty">{recette.description}</p>}
    </div>
  );
}
