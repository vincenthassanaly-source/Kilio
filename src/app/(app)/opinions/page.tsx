import { screenTitle } from "@/lib/ui";
import { OpinionsView } from "./OpinionsView";

// Shell serveur : les idées sont chargées côté client via TanStack Query dans
// OpinionsView (même patron que /vinted), avec un skeleton pendant isLoading.
export default function OpinionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Opinions</h1>
      <OpinionsView />
    </div>
  );
}
