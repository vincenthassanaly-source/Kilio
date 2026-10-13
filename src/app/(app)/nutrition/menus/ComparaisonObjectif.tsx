import { severiteDepassement, type SeveriteDepassement } from "@/lib/nutrition/bilan";
import type { Nutrition } from "@/lib/nutrition/compute";

const COULEUR_BARRE: Record<SeveriteDepassement, string> = {
  ok: "var(--accent-kcal)",
  leger: "var(--accent-warning)",
  marque: "var(--accent-alert)",
};

const CLASSE_TEXTE: Record<SeveriteDepassement, string> = {
  ok: "text-ink-2",
  leger: "text-warning",
  marque: "text-alert",
};

const fr = (n: number) => Math.round(n).toLocaleString("fr-FR");

/**
 * Menu du jour comparé à la cible du type de jour (repos ou entraînement).
 * Ton neutre, comme le Journal : un dépassement ≤ 10 % reste ambre, seul un
 * dépassement net passe à l'alerte. Les protéines sont un plancher, jamais
 * colorées en dépassement. Un jour libre suspend la comparaison.
 */
export function ComparaisonObjectif({
  prevu,
  cible,
  libre,
}: {
  prevu: Nutrition;
  cible: Nutrition | null;
  libre: boolean;
}) {
  if (prevu.kcal <= 0) return <p className="text-xs text-ink-3">Rien de planifié ce jour-là.</p>;

  if (libre) {
    return (
      <p className="text-xs text-ink-2">
        <span className="mr-2 rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-ink-2">
          Jour libre
        </span>
        <span className="tabular-nums">{fr(prevu.kcal)} kcal prévues</span>
      </p>
    );
  }

  if (!cible) {
    return (
      <p className="text-xs tabular-nums text-ink-2">{fr(prevu.kcal)} kcal prévues · pas d&apos;objectif défini</p>
    );
  }

  const severite = severiteDepassement(prevu.kcal, cible.kcal);
  const reste = cible.kcal - prevu.kcal;
  const pct = cible.kcal > 0 ? Math.min(100, Math.round((prevu.kcal / cible.kcal) * 100)) : 0;
  const resume =
    reste >= 0
      ? `il reste ${fr(reste)} kcal`
      : severite === "leger"
        ? `${fr(-reste)} kcal au-dessus`
        : `dépassé de ${fr(-reste)} kcal`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[15px] font-semibold tabular-nums text-ink">
          {fr(prevu.kcal)}
          <span className="text-xs font-semibold text-ink-3"> / {fr(cible.kcal)} kcal</span>
        </span>
        <span className={`text-[12.5px] font-semibold tabular-nums ${CLASSE_TEXTE[severite]}`}>{resume}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COULEUR_BARRE[severite] }} />
      </div>
      <p className="flex flex-wrap gap-x-3 text-[11.5px] font-semibold tabular-nums">
        <span style={{ color: "var(--accent-protein)" }}>
          P {fr(prevu.proteines)} / {fr(cible.proteines)} g
        </span>
        <span style={{ color: "var(--accent-carbs)" }}>
          G {fr(prevu.glucides)} / {fr(cible.glucides)} g
        </span>
        <span style={{ color: "var(--accent-fat)" }}>
          L {fr(prevu.lipides)} / {fr(cible.lipides)} g
        </span>
      </p>
    </div>
  );
}
