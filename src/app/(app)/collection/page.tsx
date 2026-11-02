import { screenTitle } from "@/lib/ui";
import { CollectionsGrid } from "./CollectionsGrid";

// « Réorganiser » appelle Gemini une fois sur toute la collection (jusqu'à 50 s) :
// au-delà du plafond par défaut d'une fonction.
export const maxDuration = 60;

// Shell serveur : les collections sont chargées côté client via TanStack
// Query dans CollectionsGrid (voir /taches, même patron), qui affiche un
// skeleton pendant isLoading.
export default function CollectionPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Collection</h1>
      <CollectionsGrid />
    </div>
  );
}
