"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { definirPriorite, getPriorites } from "@/app/actions/opinions-partis";
import { SegmentedControl } from "@/components/SegmentedControl";
import { runAction } from "@/lib/actions/runAction";
import { LIBELLE_NIVEAU, NIVEAUX, type Niveau, type Priorites } from "@/lib/opinions/partis";
import { LIBELLE_THEME, THEMES, type Theme } from "@/lib/opinions/types";
import { queryKeys } from "@/lib/query/keys";
import { card, label, pillTag, sectionTitle } from "@/lib/ui";

const OPTIONS = NIVEAUX.map((niveau) => ({ value: niveau, label: LIBELLE_NIVEAU[niveau] }));

// Importance de chaque thème pour moi : elle pondère la proximité avec les
// partis (secondaire ×0,5, normal ×1, prioritaire ×2). Optimiste : le choix
// s'affiche tout de suite, et la liste est relue si l'enregistrement échoue.
export function PrioritesEditor() {
  const queryClient = useQueryClient();
  const { data: priorites } = useQuery({ queryKey: queryKeys.opinionsPriorites, queryFn: getPriorites });
  const definies = Object.keys(priorites ?? {}).length;

  function changer(theme: Theme, niveau: Niveau) {
    queryClient.setQueryData<Priorites>(queryKeys.opinionsPriorites, (avant) => ({ ...avant, [theme]: niveau }));
    void runAction(() => definirPriorite(theme, niveau), {
      onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.opinionsPriorites }),
    });
  }

  return (
    <details className={card}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal">
        <span className={sectionTitle}>Mes priorités par thème</span>
        <span className={pillTag}>{definies} définie{definies > 1 ? "s" : ""}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <p className="text-xs text-ink-3">
          Ce qui compte le plus pour toi pèse davantage dans la proximité avec les partis. Un thème non réglé vaut
          « Normal ».
        </p>
        {THEMES.map((theme) => (
          <div key={theme} className="flex flex-col gap-1.5">
            <span className={label}>{LIBELLE_THEME[theme]}</span>
            <SegmentedControl
              options={OPTIONS}
              value={priorites?.[theme] ?? "normal"}
              onChange={(niveau) => changer(theme, niveau)}
              ariaLabel={`Importance du thème ${LIBELLE_THEME[theme]}`}
              taille="sm"
            />
          </div>
        ))}
      </div>
    </details>
  );
}
