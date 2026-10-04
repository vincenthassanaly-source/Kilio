import Link from "next/link";
import { Suspense } from "react";
import { getComptesAvecSolde } from "@/app/actions/comptes";
import { getCategories } from "@/app/actions/categories-budget";
import { getTransactions } from "@/app/actions/transactions";
import { screenTitle } from "@/lib/ui";
import { AddTransactionToggle } from "./AddTransactionToggle";
import { TransactionsFilters } from "./TransactionsFilters";
import { TransactionsList } from "./TransactionsList";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { genererOccurrencesDuesPourLaRequete } from "../requete";

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CalendrierIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

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

type TransactionsSearchParams = Promise<{
  compte?: string;
  categorie?: string;
  mois?: string;
  date?: string;
  q?: string;
}>;

export default function TransactionsPage({ searchParams }: { searchParams: TransactionsSearchParams }) {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className={screenTitle}>Transactions</h1>
          <div className="flex gap-2">
            <Link
              href="/budget/calendrier"
              aria-label="Calendrier"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-line text-ink-2"
            >
              <CalendrierIcon />
            </Link>
            <Link
              href="/budget/recurrentes"
              aria-label="Récurrentes"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-line text-ink-2"
            >
              <RecurrentesIcon />
            </Link>
          </div>
        </div>
        <Suspense fallback={<TransactionsSkeleton />}>
          <TransactionsContenu searchParams={searchParams} />
        </Suspense>
      </div>
    </PullToRefresh>
  );
}

async function TransactionsContenu({ searchParams }: { searchParams: TransactionsSearchParams }) {
  const { compte, categorie, mois, date, q } = await searchParams;

  // Pas de cron dans ce repo : les occurrences récurrentes dues sont
  // générées ici, avant les lectures ci-dessous, pour apparaître
  // immédiatement dans l'historique du chargement en cours.
  // Sauf pendant une recherche (`?q=`) : ce rendu-là est déclenché par la
  // frappe (TransactionsFilters), et l'écran a déjà généré les occurrences
  // du jour à son ouverture — plus d'écriture en base par lettre tapée.
  if (!q) await genererOccurrencesDuesPourLaRequete();

  const [comptes, categories, transactions] = await Promise.all([
    getComptesAvecSolde(),
    getCategories(),
    getTransactions({
      compteId: compte,
      categorieId: categorie,
      mois: mois ? `${mois}-01` : undefined,
      date,
      recherche: q,
    }),
  ]);

  // Filtre "jour" posé depuis /budget/calendrier (choix retenu plutôt qu'un
  // panneau inline sous le calendrier — cf. rapport : réutilise directement
  // le filtrage déjà en place ici, sans dupliquer l'affichage d'une liste de
  // transactions à deux endroits). "Effacer" retire uniquement `date`, les
  // autres filtres éventuellement actifs restent appliqués.
  const parametresSansDate = new URLSearchParams();
  if (compte) parametresSansDate.set("compte", compte);
  if (categorie) parametresSansDate.set("categorie", categorie);
  if (mois) parametresSansDate.set("mois", mois);
  if (q) parametresSansDate.set("q", q);
  const hrefSansDate = parametresSansDate.toString()
    ? `/budget/transactions?${parametresSansDate}`
    : "/budget/transactions";

  return (
    <>
      {date && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-alt px-3 py-2 text-[13px] text-ink">
          <span>
            Transactions du{" "}
            {new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <Link href={hrefSansDate} className="font-semibold text-ink-2">
            Effacer ✕
          </Link>
        </div>
      )}
      <TransactionsFilters comptes={comptes} categories={categories} />
      <AddTransactionToggle comptes={comptes} categories={categories} />
      <TransactionsList
        transactions={transactions}
        comptes={comptes}
        categories={categories}
        compteFiltre={compte}
      />
    </>
  );
}

// Extrait de l'ancien loading.tsx : filtres, bouton d'ajout, liste.
function TransactionsSkeleton() {
  return (
    <>
      <div className="flex gap-2 overflow-x-hidden">
        <Skeleton className="h-9 w-24 rounded-2xl" />
        <Skeleton className="h-9 w-28 rounded-2xl" />
        <Skeleton className="h-9 w-20 rounded-2xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <ListItemSkeletonGroup count={6} withSubtitle />
    </>
  );
}
