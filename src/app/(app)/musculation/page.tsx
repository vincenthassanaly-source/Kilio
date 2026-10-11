import { connection } from "next/server";
import { compterExercices } from "@/lib/musculation/serveur";
import { card, eyebrow, screenTitle, sectionTitle } from "@/lib/ui";

export default async function MusculationPage() {
  await connection();
  const nbExercices = await compterExercices();

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Musculation</h1>
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
          <p className={eyebrow}>Séances, routines et statistiques arrivent dans les prochaines étapes.</p>
        </section>
      )}
    </div>
  );
}
