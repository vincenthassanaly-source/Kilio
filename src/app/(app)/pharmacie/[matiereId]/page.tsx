"use client";

import { use } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import { cardTight, eyebrow, linkButton, screenTitle } from "@/lib/ui";
import { chapitresDeMatiere, notionsDeChapitre } from "@/lib/pharmacie/selecteurs";
import { pluriel } from "@/lib/pharmacie/format";
import { AvecSnapshot, IntrouvableCarte } from "../EtatSnapshot";

export default function MatierePage({ params }: { params: Promise<{ matiereId: string }> }) {
  const { matiereId } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <AvecSnapshot>
        {(snapshot) => {
          const matiere = snapshot.matieres.find((m) => m.id === matiereId);
          if (!matiere) {
            return (
              <>
                <TransitionLink href="/pharmacie" className={linkButton}>
                  ← Pharmacie
                </TransitionLink>
                <IntrouvableCarte message="Cette matière n'existe plus : elle a peut-être été renommée ou fusionnée." />
              </>
            );
          }
          const chapitres = chapitresDeMatiere(snapshot, matiere.id);
          return (
            <>
              <div className="flex flex-col gap-1">
                <TransitionLink href="/pharmacie" className={`${linkButton} self-start`}>
                  ← Pharmacie
                </TransitionLink>
                <h1 className={screenTitle}>{matiere.nom}</h1>
              </div>
              {chapitres.length === 0 ? (
                <IntrouvableCarte message="Aucun chapitre pour l'instant." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {chapitres.map((chapitre) => {
                    const notions = notionsDeChapitre(snapshot, chapitre.id);
                    return (
                      <li key={chapitre.id}>
                        <TransitionLink
                          href={`/pharmacie/${matiere.id}/${chapitre.id}`}
                          className={`${cardTight} flex items-baseline justify-between gap-3`}
                        >
                          <span className="truncate text-[14.5px] font-semibold text-ink">{chapitre.nom}</span>
                          <span className={`${eyebrow} shrink-0 font-normal`}>{pluriel(notions.length, "notion")}</span>
                        </TransitionLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          );
        }}
      </AvecSnapshot>
    </div>
  );
}
