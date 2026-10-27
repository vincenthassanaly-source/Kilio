"use client";

import { useId } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import { SegmentedPill } from "@/components/SegmentedControl";
import { SEGMENT_CADRE, segmentClasseGlissant } from "@/lib/segmented";

const ONGLETS = [
  { cle: "cours", libelle: "Cours", href: "/pharmacie" },
  { cle: "referentiel", libelle: "Référentiel", href: "/pharmacie/referentiel" },
  { cle: "huiles", libelle: "Huiles", nom: "Huiles essentielles", href: "/pharmacie/huiles-essentielles" },
] as const;

// Trois entrées du module : le cahier de cours (matières, notions, cartes), le
// référentiel médicaments (classes, molécules, pathologies, protocoles) et les
// huiles essentielles. Le libellé court tient dans un tiers de l'écran ; le
// nom complet (qui contient le libellé) est celui annoncé aux lecteurs d'écran.
// Même contrôle segmenté « lien » que la sous-navigation Nutrition (actif en
// vert plein, DESIGN.md) : `SEGMENT_CADRE` + `segmentClasseGlissant` + pastille.
export function OngletsPharmacie({ actif }: { actif: (typeof ONGLETS)[number]["cle"] }) {
  const pastilleId = useId();

  return (
    <nav aria-label="Sections de la Pharmacie" className={SEGMENT_CADRE}>
      {ONGLETS.map((onglet) => {
        const estActif = onglet.cle === actif;
        return (
          <TransitionLink
            key={onglet.cle}
            href={onglet.href}
            aria-current={estActif ? "page" : undefined}
            aria-label={"nom" in onglet ? onglet.nom : undefined}
            className={segmentClasseGlissant()}
          >
            {estActif && <SegmentedPill layoutId={pastilleId} />}
            <span className={`relative transition-colors ${estActif ? "text-on-kcal" : "text-ink-2"}`}>
              {onglet.libelle}
            </span>
          </TransitionLink>
        );
      })}
    </nav>
  );
}
