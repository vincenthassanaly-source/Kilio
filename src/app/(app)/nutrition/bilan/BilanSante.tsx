import { connection } from "next/server";
import { getMesuresRecentes, getSyntheseSemaine } from "@/app/actions/sante";
import { aujourdhuiParis } from "@/lib/date/paris";
import { card } from "@/lib/ui";
import { SectionBilan } from "./BilanVues";
import { PeseeForm } from "./PeseeForm";
import { ReleveListe } from "./ReleveListe";
import { SyntheseSemaine } from "./SyntheseSemaine";
import { ErrorInlineRefresh } from "@/components/ErrorInlineRefresh";

// Synthèse de la semaine et pesée (saisie compacte datée du jour, puis
// derniers relevés supprimables), en tête du Bilan. Sous <Suspense> dans
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
    return <ErrorInlineRefresh message="Impossible de charger la synthèse de la semaine." />;
  }
  const [synthese, mesures] = donnees;

  return (
    <>
      <SectionBilan titre="Cette semaine">
        <SyntheseSemaine synthese={synthese} />
      </SectionBilan>
      <SectionBilan titre="Pesée">
        <div className={`${card} flex flex-col gap-3`}>
          <PeseeForm today={aujourdhui} mesures={mesures} compact />
          <ReleveListe mesures={mesures} />
        </div>
      </SectionBilan>
    </>
  );
}
