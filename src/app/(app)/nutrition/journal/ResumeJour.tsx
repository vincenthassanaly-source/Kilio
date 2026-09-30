import type { Nutrition } from "@/lib/nutrition/compute";
import { SEUIL_DEPASSEMENT_LEGER } from "@/lib/nutrition/bilan";
import { card } from "@/lib/ui";

const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Un seul gramme au-delà de l'objectif n'a pas la même gravité que 500 kcal
// en trop : un dépassement léger (≤10 %, SEUIL_DEPASSEMENT_LEGER, partagé
// avec le Bilan) reste ambre/informatif plutôt que de basculer
// immédiatement dans le rouge d'alerte — la même teinte que le bouton
// "Supprimer" — pour un outil de perte de poids utilisé plusieurs fois par
// jour, où un cadrage binaire réussi/échec entretient l'anxiété plus qu'il
// n'aide. Seul un dépassement net (>10 %) mérite l'alerte forte.

type Severite = "ok" | "leger" | "marque";

function severite(consomme: number, cible: number): Severite {
  if (cible <= 0 || consomme <= cible) return "ok";
  return consomme / cible <= SEUIL_DEPASSEMENT_LEGER ? "leger" : "marque";
}

function couleurSeverite(sev: Severite, couleurBase: string): string {
  if (sev === "marque") return "var(--accent-alert)";
  if (sev === "leger") return "var(--accent-warning)";
  return couleurBase;
}

function MacroBar({
  label,
  consomme,
  cible,
  color,
}: {
  label: string;
  consomme: number;
  cible: number;
  color: string;
}) {
  const pct = cible > 0 ? Math.min(100, Math.round((consomme / cible) * 100)) : 0;
  const sev = severite(consomme, cible);
  const barColor = couleurSeverite(sev, color);
  const texteClass =
    sev === "marque" ? "font-bold text-alert" : sev === "leger" ? "font-semibold text-warning" : "text-ink-3";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-ink">{label}</span>
        <span className={`flex items-center gap-1 text-[11.5px] font-mono ${texteClass}`}>
          {sev !== "ok" && (
            // Marqueur non-couleur du dépassement (en plus de la teinte) : un
            // lecteur daltonien ou en faible luminosité doit pouvoir repérer
            // le dépassement sans dépendre de la couleur seule.
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3.5 22 20.5H2L12 3.5Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M12 10v4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17.5" r="1" fill="currentColor" />
            </svg>
          )}
          {Math.round(consomme)} / {Math.round(cible)} g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

export function ResumeJour({
  consomme,
  cible,
}: {
  consomme: Nutrition;
  cible: Nutrition | null;
}) {
  if (!cible) {
    return (
      <p className="text-sm text-ink-2">
        Définis un objectif ci-dessus pour voir ton résumé du jour.
      </p>
    );
  }

  const reste = cible.kcal - consomme.kcal;
  const kcalSeverite = severite(consomme.kcal, cible.kcal);
  const kcalPct = cible.kcal > 0 ? Math.min(100, Math.round((consomme.kcal / cible.kcal) * 100)) : 0;
  const kcalOffset = CIRCUMFERENCE * (1 - kcalPct / 100);
  const resteLabel =
    reste >= 0
      ? `${Math.round(reste)} kcal restantes aujourd'hui`
      : kcalSeverite === "leger"
        ? `${Math.round(-reste)} kcal au-dessus de l'objectif`
        : `Objectif dépassé de ${Math.round(-reste)} kcal`;
  const resteTexteClass =
    kcalSeverite === "marque" ? "text-alert" : kcalSeverite === "leger" ? "text-warning" : "text-ink-2";

  return (
    <div className={`${card} flex flex-col gap-1`}>
      <div className="flex items-center gap-4.5">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r={RADIUS} stroke="var(--surface-alt)" strokeWidth="11" fill="none" />
            <circle
              cx="66"
              cy="66"
              r={RADIUS}
              stroke={couleurSeverite(kcalSeverite, "var(--accent-kcal)")}
              strokeWidth="11"
              fill="none"
              strokeLinecap="round"
              transform="rotate(-90 66 66)"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={kcalOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <div className="font-display text-2xl font-semibold tabular-nums text-ink">
              {Math.round(consomme.kcal)}
            </div>
            <div className="text-[11px] tabular-nums text-ink-3">/ {Math.round(cible.kcal)} kcal</div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className={`mb-0.5 text-[12.5px] font-semibold tabular-nums ${resteTexteClass}`}>{resteLabel}</p>
          <MacroBar label="Protéines" consomme={consomme.proteines} cible={cible.proteines} color="var(--accent-protein)" />
          <MacroBar label="Glucides" consomme={consomme.glucides} cible={cible.glucides} color="var(--accent-carbs)" />
          <MacroBar label="Lipides" consomme={consomme.lipides} cible={cible.lipides} color="var(--accent-fat)" />
        </div>
      </div>
    </div>
  );
}
