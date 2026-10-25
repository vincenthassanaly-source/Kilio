import { Suspense } from "react";
import { screenTitle } from "@/lib/ui";
import { OngletsPharmacie } from "../OngletsPharmacie";
import { HuilesAccueil } from "./HuilesAccueil";

export default function HuilesEssentiellesPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className={screenTitle}>Pharmacie</h1>
      <OngletsPharmacie actif="huiles" />
      <Suspense>
        <HuilesAccueil />
      </Suspense>
    </div>
  );
}
