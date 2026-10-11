import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compterExercices } from "@/lib/musculation/serveur";
import { card, cardTight, eyebrow, metaText, nameText, screenTitle, sectionTitle } from "@/lib/ui";
import { DemarrerSeance } from "./DemarrerSeance";
import { DernieresSeances } from "./DernieresSeances";
import { RoutinesSection } from "./RoutinesSection";

export default async function MusculationPage() {
  await connection();
  const nbExercices = await compterExercices(createAdminClient());

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Musculation</h1>
      <DemarrerSeance catalogueVide={nbExercices === 0} />
      <RoutinesSection />
      <DernieresSeances />
      <Link href="/musculation/stats" className={`${cardTight} flex flex-col gap-0.5`}>
        <span className={nameText}>Statistiques</span>
        <span className={metaText}>Records, progression par exercice, assiduité, répartition par muscle</span>
      </Link>
      {nbExercices === 0 ? (
        <section className={`${card} flex flex-col gap-1.5`}>
          <h2 className={sectionTitle}>Aucun exercice pour l&apos;instant</h2>
          <p className={eyebrow}>
            Le catalogue d&apos;exercices arrive bientôt. Dès qu&apos;il est ajouté, tu pourras démarrer une séance,
            créer des routines et suivre ta progression ici.
          </p>
        </section>
      ) : (
        <section className={`${card} flex flex-col gap-1.5`}>
          <h2 className={sectionTitle}>
            {nbExercices} exercice{nbExercices > 1 ? "s" : ""} au catalogue
          </h2>
          <p className={eyebrow}>Tes séances nourrissent les statistiques et les records.</p>
        </section>
      )}
    </div>
  );
}
