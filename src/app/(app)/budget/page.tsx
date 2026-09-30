import Link from "next/link";
import { Suspense } from "react";
import { getComptesAvecSolde } from "@/app/actions/comptes";
import { getResumeMois } from "@/app/actions/transactions";
import { getSuiviCategories } from "@/app/actions/budgets";
import { formatMontant, formatPeriode, premierJourDuMois } from "@/lib/budget/compute";
import { card, eyebrow, screenTitle, sectionTitle } from "@/lib/ui";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { genererOccurrencesDuesPourLaRequete } from "./requete";

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function RecurrentesIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M20.5 6H8a5 5 0 0 0-5 5v1" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M3.5 18H16a5 5 0 0 0 5-5v-1" />
    </svg>
  );
}

function CalendrierIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function StatistiquesIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 20.5V10" />
      <path d="M12 20.5V4" />
      <path d="M20 20.5v-7" />
    </svg>
  );
}

export default function BudgetPage() {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-5">
        <div>
          <p className={eyebrow}>Budget</p>
          <h1 className={screenTitle}>Vue d&apos;ensemble</h1>
        </div>

        <Suspense fallback={<BudgetResumeSkeleton />}>
          <BudgetResume />
        </Suspense>

        <div className={`${card} flex flex-col gap-2`}>
          <p className={sectionTitle}>Autres vues</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/budget/recurrentes"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-alt px-3.5 py-2 text-[13.5px] font-semibold text-ink-2"
            >
              <RecurrentesIcon />
              Transactions récurrentes
            </Link>
            <Link
              href="/budget/calendrier"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-alt px-3.5 py-2 text-[13.5px] font-semibold text-ink-2"
            >
              <CalendrierIcon />
              Calendrier
            </Link>
            <Link
              href="/budget/statistiques"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-alt px-3.5 py-2 text-[13.5px] font-semibold text-ink-2"
            >
              <StatistiquesIcon />
              Statistiques
            </Link>
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}

// Mois courant et occurrences récurrentes générées à chaque requête :
// tout ce qui en dépend arrive en streaming sous la coquille.
async function BudgetResume() {
  await genererOccurrencesDuesPourLaRequete();
  const periode = premierJourDuMois();

  const [comptes, resumeMois, suiviCategories] = await Promise.all([
    getComptesAvecSolde(),
    getResumeMois(periode),
    getSuiviCategories(periode),
  ]);

  const totalSoldes = comptes.reduce((acc, c) => acc + c.solde, 0);
  const soldeMois = resumeMois.totalRevenus - resumeMois.totalDepenses;
  const enDepassement = suiviCategories.filter((s) => s.statut !== "ok");

  return (
    <>
      <div className={`${card} flex flex-col gap-1`}>
        <p className={eyebrow}>Solde total</p>
        <p
          className={`font-display text-3xl font-semibold tabular-nums ${totalSoldes < 0 ? "text-alert" : "text-ink"}`}
        >
          {formatMontant(totalSoldes)}
        </p>
        <Link
          href="/budget/comptes"
          className="mt-1 inline-flex w-fit items-center rounded-full border border-line px-3.5 py-2 text-[13.5px] font-semibold text-ink-2"
        >
          {comptes.length === 0
            ? "Ajouter un compte"
            : `Voir ${comptes.length === 1 ? "le compte" : `les ${comptes.length} comptes`}`}
        </Link>
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <p className={sectionTitle}>{formatPeriode(periode)}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <span className={eyebrow}>Revenus</span>
            <span className="font-display text-lg font-semibold tabular-nums text-kcal">
              {formatMontant(resumeMois.totalRevenus)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={eyebrow}>Dépenses</span>
            <span className="font-display text-lg font-semibold tabular-nums text-ink">
              {formatMontant(resumeMois.totalDepenses)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={eyebrow}>Solde</span>
            <span
              className={`font-display text-lg font-semibold tabular-nums ${soldeMois < 0 ? "text-alert" : "text-ink"}`}
            >
              {formatMontant(soldeMois)}
            </span>
          </div>
        </div>
        <Link
          href="/budget/transactions"
          className="inline-flex w-fit items-center rounded-full border border-line px-3.5 py-2 text-[13.5px] font-semibold text-ink-2"
        >
          Voir les transactions
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className={sectionTitle}>Catégories en dépassement</p>
        {enDepassement.length === 0 ? (
          <p className="text-ink-2">Aucune catégorie en dépassement ce mois-ci.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {enDepassement.map((suivi) => {
              const pct =
                suivi.cible > 0 ? Math.min(100, Math.round((suivi.consomme / suivi.cible) * 100)) : 100;
              // Graduated Alert Rule (T8) : ambre à l'approche, rouge au dépassement.
              const color = suivi.statut === "depasse" ? "var(--accent-alert)" : "var(--accent-warning)";

              return (
                <li key={suivi.categorie.id} className={`${card} flex flex-col gap-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                      {suivi.categorie.icone && <span>{suivi.categorie.icone}</span>}
                      {suivi.categorie.nom}
                    </p>
                    <span
                      className={`text-[12.5px] tabular-nums ${suivi.statut === "depasse" ? "text-alert" : "text-ink-2"}`}
                    >
                      {formatMontant(suivi.consomme)} / {formatMontant(suivi.cible)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/budget/categories"
          className="inline-flex w-fit items-center rounded-full border border-line px-3.5 py-2 text-[13.5px] font-semibold text-ink-2"
        >
          Voir toutes les catégories
        </Link>
      </div>

    </>
  );
}

// Extrait de l'ancien loading.tsx : solde, mois courant, dépassements.
function BudgetResumeSkeleton() {
  return (
    <>
      <div className={`${card} flex flex-col gap-2`}>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className={`${card} flex flex-col gap-3`}>
        <Skeleton className="h-3.5 w-28" />
        <div className="flex gap-5">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="h-16 w-full rounded-[20px]" />
        <Skeleton className="h-16 w-full rounded-[20px]" />
      </div>
    </>
  );
}
