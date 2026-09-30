"use client";

import { useState } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ProgressRing } from "@/components/ProgressRing";
import { TransitionLink } from "@/components/TransitionLink";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { card, cardTight, eyebrow, input, primaryButton, sectionTitle } from "@/lib/ui";
import { estAcquise } from "@/lib/pharmacie/srs";
import { cartesARevoir, cheminDeNotion, dernieresNotions, statsMatiere } from "@/lib/pharmacie/selecteurs";
import { pluriel, pourcentage } from "@/lib/pharmacie/format";
import type { PharmaSnapshot } from "@/lib/pharmacie/types";
import { AvecSnapshot, IntrouvableCarte } from "./EtatSnapshot";
import { ResultatsRecherche } from "./ResultatsRecherche";

export function PharmacieAccueil() {
  const queryClient = useQueryClient();
  const [requete, setRequete] = useState("");

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.pharmacie })}>
      <div className="flex flex-col gap-5">
        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Rechercher une notion, une molécule…"
          aria-label="Rechercher dans la Pharmacie"
          enterKeyHint="search"
          className={input}
        />
        <AvecSnapshot>
          {(snapshot) =>
            requete.trim().length >= 2 ? (
              <ResultatsRecherche snapshot={snapshot} requete={requete} />
            ) : (
              <Accueil snapshot={snapshot} />
            )
          }
        </AvecSnapshot>
      </div>
    </PullToRefresh>
  );
}

function Accueil({ snapshot }: { snapshot: PharmaSnapshot }) {
  // Instant de lecture figé à la première rendu : la liste « à réviser » ne
  // doit pas bouger sous les doigts pendant qu'on consulte l'écran.
  const [maintenant] = useState(() => new Date());

  if (snapshot.matieres.length === 0) {
    return (
      <IntrouvableCarte message="Rien ici pour l'instant. Dicte ta première info à Claude dans le chat : elle sera rangée dans un cours et apparaîtra ici." />
    );
  }

  const aRevoir = cartesARevoir(snapshot.cartes, maintenant).length;
  const acquises = snapshot.cartes.filter(estAcquise).length;
  const maitrise = pourcentage(acquises, snapshot.cartes.length);
  const recentes = dernieresNotions(snapshot, 5);

  return (
    <>
      <section className={`${card} flex items-center gap-4 rounded-[24px] p-[18px]`} aria-label="Révision du jour">
        <ProgressRing size={72} strokeWidth={7} pct={maitrise / 100} color="var(--accent-kcal)">
          <span className="font-display text-[17px] font-bold leading-none text-ink">{maitrise}%</span>
          <span className="mt-0.5 text-[11px] font-semibold text-ink-3">acquis</span>
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="font-display text-[22px] font-bold leading-tight text-ink">
              {aRevoir === 0 ? "Rien à réviser" : pluriel(aRevoir, "carte")}
            </p>
            <p className="text-[13px] text-ink-2">
              {aRevoir === 0 ? "Tu es à jour, reviens plus tard." : "à réviser aujourd'hui"}
            </p>
          </div>
          {aRevoir > 0 && (
            <TransitionLink href="/pharmacie/revision" className={`${primaryButton} self-start text-[14px]`}>
              Commencer
            </TransitionLink>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2.5" aria-labelledby="titre-matieres">
        <h2 id="titre-matieres" className={sectionTitle}>
          Matières
        </h2>
        <ul className="flex flex-col gap-2">
          {snapshot.matieres.map((matiere) => {
            const stats = statsMatiere(snapshot, matiere.id);
            const pct = pourcentage(stats.acquises, stats.cartes);
            return (
              <li key={matiere.id}>
                <TransitionLink href={`/pharmacie/${matiere.id}`} className={`${cardTight} flex flex-col gap-2`}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14.5px] font-semibold text-ink">{matiere.nom}</span>
                    <span className="shrink-0 text-[12px] text-ink-2">
                      {pluriel(stats.chapitres, "chapitre")} · {pluriel(stats.notions, "notion")}
                    </span>
                  </span>
                  <span
                    className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt"
                    role="img"
                    aria-label={`${pct} % des cartes acquises`}
                  >
                    <span className="block h-full rounded-full bg-pharmacie" style={{ width: `${pct}%` }} />
                  </span>
                </TransitionLink>
              </li>
            );
          })}
        </ul>
      </section>

      {recentes.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-labelledby="titre-recentes">
          <h2 id="titre-recentes" className={sectionTitle}>
            Dernières notions
          </h2>
          <ul className="flex flex-col gap-2">
            {recentes.map((notion) => {
              const chemin = cheminDeNotion(snapshot, notion);
              if (!chemin) return null;
              return (
                <li key={notion.id}>
                  <TransitionLink
                    href={`/pharmacie/${chemin.matiere.id}/${chemin.chapitre.id}#notion-${notion.id}`}
                    className={`${cardTight} flex flex-col gap-0.5`}
                  >
                    <span className={eyebrow}>
                      {chemin.matiere.nom} › {chemin.chapitre.nom}
                    </span>
                    <span className="truncate text-[14.5px] font-semibold text-ink">{notion.titre}</span>
                  </TransitionLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
