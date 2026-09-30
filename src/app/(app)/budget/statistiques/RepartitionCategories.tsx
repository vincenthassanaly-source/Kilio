import type { SuiviCategorie } from "@/app/actions/budgets";
import { formatMontant } from "@/lib/budget/compute";

/**
 * Répartition des dépenses du mois par catégorie principale (les
 * sous-catégories sont déjà agrégées dans `suivi.consomme` par
 * `getSuiviCategories`, cohérent avec le suivi de budget).
 *
 * Barres horizontales en CSS (largeur en %), pas en SVG : c'est le motif
 * déjà utilisé dans tout le module Budget pour ce type de barre proportionnelle
 * (`CategorieProgressCard`, "Catégories en dépassement" de /budget) — le
 * pattern SVG à la main d'`EvolutionChart` concerne les courbes/valeurs
 * continues, pas les barres de proportion simples.
 */
export function RepartitionCategories({ suivi }: { suivi: SuiviCategorie[] }) {
  const total = suivi.reduce((acc, s) => acc + s.consomme, 0);
  const donnees = suivi.filter((s) => s.consomme > 0).sort((a, b) => b.consomme - a.consomme);

  if (donnees.length === 0) {
    return <p className="text-ink-2">Aucune dépense ce mois-ci.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {donnees.map((s) => {
        const pct = total > 0 ? Math.round((s.consomme / total) * 100) : 0;
        return (
          <li key={s.categorie.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-medium text-ink">
                {s.categorie.icone && <span className="mr-1">{s.categorie.icone}</span>}
                {s.categorie.nom}
              </span>
              <span className="tabular-nums text-ink-2">
                {formatMontant(s.consomme)} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
              <div className="h-full rounded-full bg-ink-2" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
