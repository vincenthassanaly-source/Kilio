import { BackLink } from "@/components/BackLink";
import { screenTitle } from "@/lib/ui";
import { PlateformesView } from "./PlateformesView";

// Shell serveur : titre et retour statiques ; la liste des plateformes se charge côté client.
export default function PlateformesPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/films">Films</BackLink>
      <h1 className={screenTitle}>Mes plateformes</h1>
      <PlateformesView />
    </div>
  );
}
