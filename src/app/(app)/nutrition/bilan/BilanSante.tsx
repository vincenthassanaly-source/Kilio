import { connection } from "next/server";
import { getMesuresRecentes, getSyntheseSemaine } from "@/app/actions/sante";
import { aujourdhuiParis } from "@/lib/date/paris";
import { card, errorText } from "@/lib/ui";
import { SectionBilan } from "./BilanVues";
import { PeseeForm } from "./PeseeForm";
import { SyntheseSemaine } from "./SyntheseSemaine";

// Synthèse de la semaine et pesée, en tête du Bilan. Sous <Suspense> dans
// page.tsx : dépend de « aujourd'hui » (donnée de requête, d'où `connection()`).
export async function BilanSante() {
  await connection();
  const aujourdhui = aujourdhuiParis();

  let donnees;
  try {
    donnees = await Promise.all([getSyntheseSemaine(aujourdhui), getMesuresRecentes(5)]);
  } catch (erreur) {
    // Message brut du driver jamais affiché (loggé pour le diagnostic).
    console.error("BilanSante: échec de chargement", erreur);
    return (
      <p role="alert" className={errorText}>
        Impossible de charger la synthèse de la semaine. Réessaie dans un instant.
      </p>
    );
  }
  const [synthese, mesures] = donnees;

  return (
    <>
      <SectionBilan titre="Cette semaine">
        <SyntheseSemaine synthese={synthese} />
      </SectionBilan>
      <SectionBilan titre="Pesée">
        <div className={card}>
          <PeseeForm today={aujourdhui} mesures={mesures} />
        </div>
      </SectionBilan>
    </>
  );
}
