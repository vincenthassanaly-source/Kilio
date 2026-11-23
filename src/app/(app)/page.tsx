import { Suspense } from "react";
import { DashboardHeaderSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { screenTitle } from "@/lib/ui";
import { AujourdhuiContenu } from "./_accueil/AujourdhuiContenu";
import { ChampAccueil } from "./ChampAccueil";
import { ReveilButton } from "./ReveilButton";
import { heureParis } from "@/lib/date/paris";
import { getToday } from "./today";

// Heure de Paris, pas celle du serveur (UTC sur Vercel) : « Bonjour » ne doit pas
// durer jusqu'à 14 h.
function greeting() {
  const h = Number(heureParis().slice(0, 2));
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
    // La date est le titre (ce qu'on vient chercher) ; la salutation passe en
    // petit au-dessus. `pr-12` : dégage le bouton Réveil posé en haut à droite.
    <header className="flex flex-col gap-0.5 pr-12">
      <p className="text-label font-medium text-ink-2">{greeting()}</p>
      <h1 className={`${screenTitle} first-letter:uppercase`}>{dateLabel}</h1>
    </header>
  );
}

function ContenuSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-[116px] w-full rounded-card" />
      <Skeleton className="h-[40vh] w-full rounded-2xl" />
      <ListItemSkeletonGroup count={3} />
    </div>
  );
}

// Coquille statique (instantanée, y compris au chargement initial) : la
// structure de la page, la barre de recherche et les skeletons. Seuls l'en-tête
// daté et le contenu du jour attendent la
// date (getToday) puis leurs requêtes, chacun sous son propre <Suspense>.
// Voir reports/2026-09-04-dashboard-streaming-par-section.md et
// reports/2026-09-24-navigation-instantanee-cache-components.md.
export default function AujourdhuiPage() {
  return (
    <div data-testid="dashboard-shell" className="relative flex flex-col gap-4">
      <Suspense fallback={<DashboardHeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>
      {/* Dans la coquille statique (hors Suspense) : le bouton est là dès le
          premier paint, aligné à droite de l'en-tête. */}
      <div className="absolute right-0 top-0">
        <ReveilButton />
      </div>

      <ChampAccueil />

      <PullToRefresh>
        <Suspense fallback={<ContenuSkeleton />}>
          <AujourdhuiContenu />
        </Suspense>
      </PullToRefresh>
    </div>
  );
}
