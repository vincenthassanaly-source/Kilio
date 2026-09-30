import { Suspense } from "react";
import { eyebrow } from "@/lib/ui";
import { DashboardHeaderSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { DashboardView } from "./DashboardView";
import { PullToRefresh } from "@/components/PullToRefresh";
import { getToday } from "./today";

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

async function DashboardHeader() {
  const date = await getToday();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <header className="flex flex-col gap-0.5">
      <p className={`${eyebrow} capitalize`}>{dateLabel}</p>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink">{greeting(new Date())}</h1>
      </div>
    </header>
  );
}

// Coquille statique (instantanée, y compris au chargement initial) : la
// structure de la page, la barre de recherche et les skeletons de chaque
// carte. Seuls l'en-tête daté et les cartes attendent la date du jour
// (getToday) puis leur requête, chacun sous son propre <Suspense> :
// chaque carte apparaît dès que SA requête est prête, sans attendre les
// autres. Voir reports/2026-09-04-dashboard-streaming-par-section.md et
// reports/2026-09-24-navigation-instantanee-cache-components.md.
export default function DashboardPage() {
  return (
    <div data-testid="dashboard-shell" className="flex flex-col gap-4">
      <Suspense fallback={<DashboardHeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>

      <GlobalSearchBar />

      <PullToRefresh>
        <DashboardView />
      </PullToRefresh>
    </div>
  );
}
