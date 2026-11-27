import { screenTitle } from "@/lib/ui";
import { FilmsView } from "./FilmsView";

// Shell serveur : le titre est statique (coquille instantanée) ; les films, la
// liste et les plateformes sont chargés côté client via TanStack Query.
export default function FilmsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Films</h1>
      <FilmsView />
    </div>
  );
}
