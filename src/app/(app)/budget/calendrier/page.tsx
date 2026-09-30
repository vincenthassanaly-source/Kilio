import Link from "next/link";
import { Suspense } from "react";
import { getTransactionsParJour } from "@/app/actions/transactions";
import { formatMontant, grilleCalendrierMois } from "@/lib/budget/compute";
import { card, eyebrow, screenTitle } from "@/lib/ui";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { PeriodeNavigation } from "../PeriodeNavigation";
import { genererOccurrencesDuesPourLaRequete, lirePeriodeMensuelle } from "../requete";

const JOURS_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

function ListeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6.5h13M8 12h13M8 17.5h13" />
      <path d="M3 6.5h.01M3 12h.01M3 17.5h.01" />
    </svg>
  );
}

type CalendrierSearchParams = Promise<{ periode?: string }>;

export default function CalendrierPage({ searchParams }: { searchParams: CalendrierSearchParams }) {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={eyebrow}>Budget</p>
            <h1 className={screenTitle}>Calendrier</h1>
          </div>
          <Link
            href="/budget/transactions"
            aria-label="Liste"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-line text-ink-2"
          >
            <ListeIcon />
          </Link>
        </div>

        <Suspense fallback={<PeriodeNavigation route="/budget/calendrier" />}>
          <PeriodeNavigationCourante searchParams={searchParams} />
        </Suspense>

        <div className={`${card} flex flex-col gap-2`}>
          <div className="grid grid-cols-7 gap-1 text-center">
            {JOURS_SEMAINE.map((jour, i) => (
              <span key={i} className="text-[11px] font-semibold text-ink-2">
                {jour}
              </span>
            ))}
          </div>
          <Suspense fallback={<GrilleSkeleton />}>
            <Grille searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </PullToRefresh>
  );
}

async function PeriodeNavigationCourante({ searchParams }: { searchParams: CalendrierSearchParams }) {
  return <PeriodeNavigation route="/budget/calendrier" periode={await lirePeriodeMensuelle(searchParams)} />;
}

// Cellules de 40 px à 320 px : montants arrondis, sans symbole ni centimes.
// Le détail exact reste dans le libellé accessible et sur la page du jour.
const montantCompact = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
function formatMontantCompact(montant: number): string {
  return montantCompact.format(montant);
}

function libelleJour(date: string, totaux: { depenses?: number; revenus?: number }): string {
  const parties = [];
  if (totaux.depenses) parties.push(`dépenses ${formatMontant(totaux.depenses)}`);
  if (totaux.revenus) parties.push(`revenus ${formatMontant(totaux.revenus)}`);
  return `${Number(date.slice(-2))} : ${parties.join(", ")}`;
}

async function Grille({ searchParams }: { searchParams: CalendrierSearchParams }) {
  const periode = await lirePeriodeMensuelle(searchParams);
  await genererOccurrencesDuesPourLaRequete();

  const totauxParJour = await getTransactionsParJour(periode);
  const semaines = grilleCalendrierMois(periode);

  return (
    <div className="flex flex-col gap-1">
      {semaines.map((semaine, i) => (
        <div key={i} className="grid grid-cols-7 gap-1">
          {semaine.map((jour) => {
            const totaux = totauxParJour[jour.date];
            return (
              <Link
                key={jour.date}
                href={`/budget/transactions?date=${jour.date}`}
                aria-label={totaux ? libelleJour(jour.date, totaux) : undefined}
                className={`flex min-h-14 min-w-0 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] leading-tight transition-colors ${
                  jour.horsMois ? "opacity-30" : ""
                } ${totaux ? "bg-surface-alt" : "hover:bg-surface-alt/60"}`}
              >
                <span className="text-[12px] font-semibold text-ink">
                  {Number(jour.date.slice(-2))}
                </span>
                {totaux?.depenses ? (
                  <span className="whitespace-nowrap text-alert tabular-nums">-{formatMontantCompact(totaux.depenses)}</span>
                ) : null}
                {totaux?.revenus ? (
                  <span className="whitespace-nowrap text-kcal tabular-nums">+{formatMontantCompact(totaux.revenus)}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Extrait de l'ancien loading.tsx : grille de 5 semaines.
function GrilleSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, j) => (
            <Skeleton key={j} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}
