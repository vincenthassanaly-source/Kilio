import type { CompteAvecSolde } from "@/app/actions/comptes";
import { formatMontant } from "@/lib/budget/compute";

/**
 * Solde actuel par compte (pas l'activité dépenses/revenus de la période) :
 * `getComptesAvecSolde` renvoie un solde cumulé depuis l'origine, pas une
 * activité bornée dans le temps — réutiliser tel quel évite d'ajouter une
 * nouvelle agrégation par compte/période non demandée explicitement (le
 * prompt proposait "solde OU activité"), cf. décision documentée dans le
 * rapport.
 */
export function RepartitionComptes({ comptes }: { comptes: CompteAvecSolde[] }) {
  if (comptes.length === 0) {
    return <p className="text-ink-2">Aucun compte pour l&apos;instant.</p>;
  }

  const maxAbs = Math.max(1, ...comptes.map((c) => Math.abs(c.solde)));

  return (
    <ul className="flex flex-col gap-2.5">
      {comptes.map((compte) => {
        const pct = Math.round((Math.abs(compte.solde) / maxAbs) * 100);
        return (
          <li key={compte.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-medium text-ink">{compte.nom}</span>
              <span className={`tabular-nums ${compte.solde < 0 ? "text-alert" : "text-ink-2"}`}>
                {formatMontant(compte.solde)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
              <div
                className={`h-full rounded-full ${compte.solde < 0 ? "bg-alert" : "bg-kcal"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
