"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/types";
import { TransitionLink } from "@/components/TransitionLink";
import { normalizeSearch } from "@/lib/normalize";
import { input, kcalPillTag, listCard, metaText, nameText, pillTag, zoneTapPill } from "@/lib/ui";

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
  recettes,
}: {
  recettes: RecetteView[];
}) {
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
    return <p className="text-ink-2">Aucune recette pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Rechercher une recette…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={input}
      />
      <div className="flex flex-wrap gap-x-2 gap-y-4">
        {TEMPS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setTempsFilter((prev) => (prev === chip.value ? null : chip.value))}
            className={
              tempsFilter === chip.value
                ? `${pillTag} ${zoneTapPill} bg-kcal-soft text-kcal font-bold`
                : `${pillTag} ${zoneTapPill}`
            }
          >
            {chip.label}
          </button>
        ))}
        {KCAL_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setKcalFilter((prev) => (prev === chip.value ? null : chip.value))}
            className={
              kcalFilter === chip.value
                ? `${pillTag} ${zoneTapPill} bg-kcal-soft text-kcal font-bold`
                : `${pillTag} ${zoneTapPill}`
            }
          >
            {chip.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-5 text-center text-sm text-ink-3">Aucune recette ne correspond à ta recherche.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((recette) => (
            <li key={recette.id}>
              <TransitionLink href={`/nutrition/recettes/${recette.id}`} className={listCard}>
                <div className="flex items-center justify-between gap-2">
                  <p className={nameText} style={{ viewTransitionName: `recette-title-${recette.id}` }}>
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
