import { PharmacieSkeleton } from "./EtatSnapshot";
import { screenTitle } from "@/lib/ui";

export default function PharmacieLoading() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className={screenTitle}>Pharmacie</h1>
      <PharmacieSkeleton />
    </div>
  );
}
