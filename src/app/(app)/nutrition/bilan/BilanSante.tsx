import { connection } from "next/server";
import { getMesuresRecentes, getSyntheseSemaine } from "@/app/actions/sante";
import { aujourdhuiParis } from "@/lib/date/paris";
import { card, primaryButton } from "@/lib/ui";
import { TransitionLink } from "@/components/TransitionLink";
import { SectionBilan } from "./BilanVues";
import { ReleveListe } from "./ReleveListe";
import { SyntheseSemaine } from "./SyntheseSemaine";
import { ErrorInlineRefresh } from "@/components/ErrorInlineRefresh";

// Où l'on saisit une pesée : la carte « Pesée de la semaine » d'Aujourd'hui
// (`?peser=1` la fait apparaître même si un relevé est récent, voir PeseeCard).
// Le Bilan ne fait que consulter (et corriger un relevé erroné via la liste).
const HREF_PESER = "/?peser=1";

// Synthèse de la semaine et lien de pesée, en tête du Bilan. Sous <Suspense> dans
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
          <p className="text-small leading-snug text-ink-2 text-pretty">
            Poids et tour de taille se saisissent depuis Aujourd&apos;hui ; le Bilan les affiche.
          </p>
          <TransitionLink href={HREF_PESER} className={`${primaryButton} inline-flex min-h-11 items-center self-start`}>
            Peser
          </TransitionLink>
          <ReleveListe mesures={mesures} />
        </div>
      </SectionBilan>
    </>
  );
}
