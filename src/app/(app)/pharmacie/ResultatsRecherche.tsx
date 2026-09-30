"use client";

import { TransitionLink } from "@/components/TransitionLink";
import { cardTight, pillTag } from "@/lib/ui";
import { cheminDeNotion, rechercherNotions } from "@/lib/pharmacie/selecteurs";
import type { PharmaSnapshot } from "@/lib/pharmacie/types";

export function ResultatsRecherche({ snapshot, requete }: { snapshot: PharmaSnapshot; requete: string }) {
  const resultats = rechercherNotions(snapshot, requete);

  if (resultats.length === 0) {
    return (
      <p className="text-[14.5px] text-ink-2" role="status">
        Aucune notion ne correspond à « {requete.trim()} ».
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Résultats de recherche">
      {resultats.map(({ notion }) => {
        const chemin = cheminDeNotion(snapshot, notion);
        if (!chemin) return null;
        return (
          <li key={notion.id}>
            <TransitionLink
              href={`/pharmacie/${chemin.matiere.id}/${chemin.chapitre.id}#notion-${notion.id}`}
              className={`${cardTight} flex flex-col gap-1`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {chemin.matiere.nom} › {chemin.chapitre.nom}
              </span>
              <span className="text-[14.5px] font-semibold text-ink">{notion.titre}</span>
              <span className="line-clamp-2 text-[13px] text-ink-2">{notion.contenu}</span>
              {notion.tags.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {notion.tags.map((tag) => (
                    <span key={tag} className={pillTag}>
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </TransitionLink>
          </li>
        );
      })}
    </ul>
  );
}
