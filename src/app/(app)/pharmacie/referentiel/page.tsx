import { Suspense } from "react";
import { screenTitle } from "@/lib/ui";
import { OngletsPharmacie } from "../OngletsPharmacie";
import { PharmacieSkeleton } from "../EtatSnapshot";
import { ReferentielAccueil } from "./ReferentielAccueil";

export default function ReferentielPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className={screenTitle}>Pharmacie</h1>
      <OngletsPharmacie actif="referentiel" />
      <Suspense fallback={<PharmacieSkeleton />}>
        <ReferentielAccueil />
      </Suspense>
    </div>
  );
}
