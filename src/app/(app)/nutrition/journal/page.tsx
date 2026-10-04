import { Suspense } from "react";
import { eyebrow, screenTitle } from "@/lib/ui";
import { NutritionSubNav } from "@/components/NutritionSubNav";
import { JournalSwipeWrapper } from "./JournalSwipeWrapper";
import { JourNavigation } from "./JournalNavigationJour";
import { JournalJourSkeleton } from "./JournalJourSkeleton";
import { JournalDateLibelle, JournalJour, JournalJourNavigation } from "./JournalJour";
import type { JournalSearchParams } from "./jour";

// La page elle-même ne lit ni l'URL, ni la date, ni Supabase : sous-navigation,
// titre et cadre de navigation par jour forment la coquille, instantanée au
// chargement comme au changement de jour. Chaque partie qui dépend du jour
// affiché arrive en streaming sous son propre <Suspense>.
export default function JournalPage({ searchParams }: { searchParams: JournalSearchParams }) {
  return (
    <JournalSwipeWrapper>
      <div className="flex flex-col gap-5">
        <NutritionSubNav />
        <div className="flex items-center justify-between">
          <div>
            <Suspense fallback={<p className={eyebrow}>&nbsp;</p>}>
              <JournalDateLibelle searchParams={searchParams} />
            </Suspense>
            <h1 className={screenTitle}>Journal</h1>
          </div>
          <Suspense fallback={<JourNavigation />}>
            <JournalJourNavigation searchParams={searchParams} />
          </Suspense>
        </div>

        <Suspense fallback={<JournalJourSkeleton />}>
          <JournalJour searchParams={searchParams} />
        </Suspense>
      </div>
    </JournalSwipeWrapper>
  );
}
