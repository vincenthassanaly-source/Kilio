import { Suspense } from "react";
import { NutritionSubNav } from "@/components/NutritionSubNav";
import { CardSkeleton } from "@/components/skeletons/CardSkeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { eyebrow, screenTitle } from "@/lib/ui";
import { MenusSemaine } from "./MenusSemaine";
import { MenusNavigation, MenusSemaineLibelle, NavigationSemaine } from "./NavigationSemaine";
import type { MenusSearchParams } from "./semaine";

// La page elle-même ne lit ni l'URL, ni la date, ni Supabase : sous-navigation,
// titre et cadre de navigation par semaine forment la coquille, instantanée au
// chargement comme au changement de semaine. Chaque partie qui dépend de la
// semaine affichée arrive en streaming sous son propre <Suspense>.
export default function MenusPage({ searchParams }: { searchParams: MenusSearchParams }) {
  return (
    <div className="flex flex-col gap-5">
      <NutritionSubNav />
      <div className="flex items-center justify-between">
        <div>
          <Suspense fallback={<p className={eyebrow}>&nbsp;</p>}>
            <MenusSemaineLibelle searchParams={searchParams} />
          </Suspense>
          <h1 className={screenTitle}>Menus</h1>
        </div>
        <Suspense fallback={<NavigationSemaine />}>
          <MenusNavigation searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <>
            <CardSkeleton withRing={false} />
            <ListItemSkeletonGroup count={4} />
          </>
        }
      >
        <MenusSemaine searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
