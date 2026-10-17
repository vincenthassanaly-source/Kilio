import { screenTitle } from "@/lib/ui";
import { VintedList } from "./VintedList";

// Shell serveur : les annonces sont chargées côté client via TanStack Query
// dans VintedList (même patron que /collection), avec un skeleton pendant
// isLoading.
export default function VintedPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Vinted</h1>
      <VintedList />
    </div>
  );
}
