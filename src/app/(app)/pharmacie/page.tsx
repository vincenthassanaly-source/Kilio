import { PharmacieAccueil } from "./PharmacieAccueil";
import { screenTitle } from "@/lib/ui";
import { OngletsPharmacie } from "./OngletsPharmacie";

export default function PharmaciePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className={screenTitle}>Pharmacie</h1>
      <OngletsPharmacie actif="cours" />
      <PharmacieAccueil />
    </div>
  );
}
