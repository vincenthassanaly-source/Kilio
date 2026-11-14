"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/types";
import { TransitionLink } from "@/components/TransitionLink";
import { normalizeSearch } from "@/lib/normalize";
import { useMasques } from "@/lib/actions/elementsMasques";
import { card, input, kcalPillTag, listCard, metaText, nameTextComplet, pillTag, zoneTapPill } from "@/lib/ui";

// Classes d'état exclusives : `pillTag` porte déjà bg-surface-alt/text-ink-2,
// on retire donc ces trois classes de la base plutôt que d'en empiler d'autres.
const chipBase = pillTag.replace("bg-surface-alt", "").replace("text-ink-2", "").replace("font-semibold", "");
const CHIP_ACTIF = "bg-kcal-soft text-kcal font-bold";
const CHIP_INACTIF = "bg-surface-alt text-ink-2 font-semibold";

const SOURCE_LABEL: Record<string, string> = {
  manuel: "Manuel",
  hellofresh: "HelloFresh",
};

type RecetteView = Tables<"recettes"> & { kcalParPortion: number; ingredientsText: string };

type TempsFilter = "15" | "30" | "60" | null;
type KcalFilter = "300" | "600" | "600+" | null;

const TEMPS_CHIPS: { value: NonNullable<TempsFilter>; label: string; max: number }[] = [
  { value: "15", label: "< 15 min", max: 15 },
  { value: "30", label: "< 30 min", max: 30 },
  { value: "60", label: "< 1h", max: 60 },
];

const KCAL_CHIPS: { value: NonNullable<KcalFilter>; label: string }[] = [
  { value: "300", label: "< 300 kcal" },
  { value: "600", label: "300-600 kcal" },
  { value: "600+", label: "> 600 kcal" },
];

export function RecettesList({
  recettes: toutesLesRecettes,
}: {
  recettes: RecetteView[];
}) {
  // Recettes en cours de suppression (toast « Annuler » encore affiché) : cachées.
  const masquees = useMasques("recette");
  const recettes = useMemo(
    () => (masquees.size === 0 ? toutesLesRecettes : toutesLesRecettes.filter((r) => !masquees.has(r.id))),
    [toutesLesRecettes, masquees]
  );
  const [search, setSearch] = useState("");
  const [tempsFilter, setTempsFilter] = useState<TempsFilter>(null);
  const [kcalFilter, setKcalFilter] = useState<KcalFilter>(null);

  function matchesFilters(r: RecetteView): boolean {
    if (tempsFilter !== null) {
      if (r.temps_prepa_min == null) return false;
      const max = TEMPS_CHIPS.find((c) => c.value === tempsFilter)!.max;
      if (r.temps_prepa_min >= max) return false;
    }
    if (kcalFilter !== null) {
      if (kcalFilter === "300" && !(r.kcalParPortion < 300)) return false;
      if (kcalFilter === "600" && !(r.kcalParPortion >= 300 && r.kcalParPortion <= 600)) return false;
      if (kcalFilter === "600+" && !(r.kcalParPortion > 600)) return false;
    }
    return true;
  }

  const filtered = useMemo(() => {
    const term = normalizeSearch(search);
    return recettes.filter((r) => {
      const matchesSearch =
        term === "" ||
        normalizeSearch(r.nom).includes(term) ||
        normalizeSearch(r.ingredientsText).includes(term);
      return matchesSearch && matchesFilters(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recettes, search, tempsFilter, kcalFilter]);

  if (recettes.length === 0) {
    return (
      <div className={`${card} flex flex-col items-center gap-2 py-8 text-center`}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z" />
          <path d="M18 8h1.5v12H18M9 9h6M9 12.5h6" />
        </svg>
        <p className="text-body font-bold text-ink">Aucune recette pour l&apos;instant.</p>
        <p className="text-sm text-ink-2 text-pretty">Ajoute-en une avec ses ingrédients et ses étapes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Rechercher une recette…"
        aria-label="Rechercher une recette"
        enterKeyHint="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={input}
      />
      <div className="flex flex-wrap gap-x-2 gap-y-4">
        <div role="group" aria-label="Temps de préparation" className="contents">
        {TEMPS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setTempsFilter((prev) => (prev === chip.value ? null : chip.value))}
            aria-pressed={tempsFilter === chip.value}
            className={`${chipBase} ${zoneTapPill} ${tempsFilter === chip.value ? CHIP_ACTIF : CHIP_INACTIF}`}
          >
            {chip.label}
          </button>
        ))}
        </div>
        <div role="group" aria-label="Calories par portion" className="contents">
        {KCAL_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setKcalFilter((prev) => (prev === chip.value ? null : chip.value))}
            aria-pressed={kcalFilter === chip.value}
            className={`${chipBase} ${zoneTapPill} ${kcalFilter === chip.value ? CHIP_ACTIF : CHIP_INACTIF}`}
          >
            {chip.label}
          </button>
        ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-5 text-center text-sm text-ink-3">Aucune recette ne correspond à ta recherche.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((recette) => (
            <li key={recette.id}>
              <TransitionLink href={`/nutrition/recettes/${recette.id}`} className={listCard}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`${nameTextComplet} min-w-0 flex-1 text-pretty`} style={{ viewTransitionName: `recette-title-${recette.id}` }}>
                    {recette.nom}
                  </p>
                  <span className={kcalPillTag}>{recette.kcalParPortion} kcal/portion</span>
                </div>
                <p className={metaText}>
                  {SOURCE_LABEL[recette.source]}
                  {recette.temps_prepa_min != null ? ` · ${recette.temps_prepa_min} min` : ""}
                  {" · "}
                  {recette.portions} portion{recette.portions > 1 ? "s" : ""}
                </p>
              </TransitionLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { RecetteView };
