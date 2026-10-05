import { connection } from "next/server";
import { TransitionLink } from "@/components/TransitionLink";
import { createAdminClient } from "@/lib/supabase/admin";
import { aujourdhuiParis } from "@/lib/date/paris";
import { shiftDate } from "@/lib/date/iso";
import {
  construireBilan,
  serieEnCours,
  tauxReussite,
  type CiblesJour,
  type JourType,
} from "@/lib/nutrition/bilan";
import { getDatesEntrainement } from "@/app/actions/journal";
import { estJourType } from "@/lib/nutrition/planning";
import { card, errorText, linkButton } from "@/lib/ui";
import {
  BandeSemaine,
  CalendrierMois,
  DetailJours,
  LegendeStatuts,
  LigneSerie,
  ResumeTaux,
  SectionBilan,
  carteBilan,
} from "./BilanVues";

// Fenêtre chargée : assez large pour que la série ne soit pas tronquée trop
// tôt, assez courte pour rester loin de la limite de 1000 lignes par requête
// Supabase (quelques repas par jour).
const NB_JOURS_FENETRE = 60;
const NB_JOURS_SEMAINE = 7;
const NB_JOURS_MOIS = 30;

// Données du Bilan, sous <Suspense> dans page.tsx : dépendent de « aujourd'hui »
// (donnée de requête, d'où `connection()`), jamais figées au build.
export async function BilanContenu() {
  await connection();
  const aujourdhui = aujourdhuiParis();
  const debut = shiftDate(aujourdhui, -(NB_JOURS_FENETRE - 1));
  const supabase = createAdminClient();

  const [objectifs, repas, datesEntrainement] = await Promise.all([
    supabase.from("objectifs_nutritionnels").select("*"),
    supabase
      .from("journal_repas")
      .select(
        "date, quantite, aliment:aliments(*), recette:recettes(id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g)))"
      )
      .gte("date", debut)
      .lte("date", aujourdhui),
    getDatesEntrainement(debut, aujourdhui),
  ]);

  const erreur = objectifs.error ?? repas.error;
  if (erreur) {
    // Message brut du driver jamais affiché (loggé pour le diagnostic).
    console.error("BilanContenu: échec de chargement", erreur);
    return (
      <p role="alert" className={errorText}>
        Impossible de charger le bilan. Réessaie dans un instant.
      </p>
    );
  }

  const cibles: Record<JourType, CiblesJour | null> = { repos: null, entrainement: null };
  for (const o of objectifs.data ?? []) {
    if (estJourType(o.jour_type)) cibles[o.jour_type] = { kcal: o.kcal_cible, proteines: o.proteines_cible_g };
  }

  if (!cibles.repos && !cibles.entrainement) {
    return (
      <div className={`${card} flex flex-col items-start gap-2`}>
        <p className="text-[15px] font-bold text-ink">Aucun objectif défini.</p>
        <p className="text-sm text-ink-2 text-pretty">
          Définis tes objectifs de kcal et de protéines dans le Journal pour suivre les jours dans les clous.
        </p>
        <TransitionLink href="/nutrition/journal" className={linkButton}>
          Ouvrir le Journal
        </TransitionLink>
      </div>
    );
  }

  const jours = construireBilan({
    aujourdhui,
    nbJours: NB_JOURS_FENETRE,
    entrees: repas.data ?? [],
    datesEntrainement,
    cibles,
  });
  const semaine = jours.slice(-NB_JOURS_SEMAINE);
  const mois = jours.slice(-NB_JOURS_MOIS);
  const serie = serieEnCours(jours);
  const taux7 = tauxReussite(semaine);
  const taux30 = tauxReussite(mois);

  return (
    <>
      <SectionBilan titre="7 derniers jours">
        <div className={carteBilan}>
          <BandeSemaine jours={semaine} />
          <div className="flex flex-col gap-1.5">
            <ResumeTaux {...taux7} periode="7 jours" />
            <LigneSerie jours={serie.jours} tronquee={serie.tronquee} />
          </div>
        </div>
      </SectionBilan>

      <SectionBilan titre="30 derniers jours">
        <div className={carteBilan}>
          <CalendrierMois jours={mois} />
          <LegendeStatuts />
          <ResumeTaux {...taux30} periode="30 jours" />
        </div>
      </SectionBilan>

      <SectionBilan titre="Détail de la semaine">
        <DetailJours jours={semaine} />
      </SectionBilan>
    </>
  );
}
