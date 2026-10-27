import { screenTitle } from "@/lib/ui";
import { ReglagesForm } from "./ReglagesForm";
import { BackLink } from "@/components/BackLink";

// Shell serveur : les réglages sont chargés côté client (TanStack Query)
// dans ReglagesForm, avec un skeleton pendant isLoading.
export default function ReglagesVintedPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/vinted">Vinted</BackLink>
        <h1 className={screenTitle}>Réglages Vinted</h1>
      </div>
      <ReglagesForm />
    </div>
  );
}
