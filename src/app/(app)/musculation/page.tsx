import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compterExercices } from "@/lib/musculation/serveur";
import { cardTight, metaText, nameText, screenTitle } from "@/lib/ui";
import { DemarrerSeance } from "./DemarrerSeance";
import { DernieresSeances } from "./DernieresSeances";
import { RoutinesSection } from "./RoutinesSection";
import { SeancesBloquees } from "./SeancesBloquees";

export default async function MusculationPage() {
  await connection();
  const nbExercices = await compterExercices(createAdminClient());

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Musculation</h1>
      <SeancesBloquees />
      <DemarrerSeance catalogueVide={nbExercices === 0} />
      <RoutinesSection catalogueVide={nbExercices === 0} />
      <DernieresSeances />
      <Link href="/musculation/stats" className={`${cardTight} flex flex-col gap-0.5`}>
        <span className={nameText}>Statistiques</span>
        <span className={metaText}>Records, progression par exercice, assiduité, répartition par muscle</span>
      </Link>
    </div>
  );
}
