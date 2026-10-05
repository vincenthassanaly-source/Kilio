import type { SuiviNutrition } from "@/app/actions/objectifs";
import { TransitionLink } from "@/components/TransitionLink";
import { BandeSemaine, CalendrierMois, LegendeStatuts, LigneSerie, ResumeTaux } from "@/app/(app)/nutrition/bilan/BilanVues";
import { ResumeJour } from "@/app/(app)/nutrition/journal/ResumeJour";
import { card, linkButton, metaText, nameText } from "@/lib/ui";

// Suivi d'un objectif Nutrition : aucune saisie ici, tout vient du Journal.
// Un jour est réussi quand ses kcal sont sous la cible (repos ou
// entraînement) ; les macros sont affichées pour information seulement.
export function ObjectifSuiviNutrition({ suivi }: { suivi: SuiviNutrition }) {
  if (!suivi.aDesCibles) {
    return (
      <div className={`${card} flex flex-col items-start gap-2`}>
        <p className={nameText}>Aucune cible définie.</p>
        <p className="text-sm text-ink-2 text-pretty">
          Définis tes cibles de kcal et de macros (repos et entraînement) dans le Journal : l&apos;objectif s&apos;en
          sert pour juger chaque jour.
        </p>
        <TransitionLink href="/nutrition/journal" className={linkButton}>
          Ouvrir le Journal ›
        </TransitionLink>
      </div>
    );
  }

  const { jours, serie, taux7, taux30 } = suivi;
  const aujourdhui = jours[jours.length - 1];
  const { cible } = aujourdhui;
  const semaine = jours.slice(-7);
  const mois = jours.slice(-30);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <p className={metaText}>
          Aujourd&apos;hui · {aujourdhui.jourType === "entrainement" ? "jour d'entraînement" : "jour de repos"}
        </p>
        <ResumeJour
          consomme={aujourdhui.consomme}
          cible={
            cible && {
              kcal: cible.kcal,
              proteines: cible.proteines,
              glucides: cible.glucides ?? 0,
              lipides: cible.lipides ?? 0,
            }
          }
        />
        <TransitionLink href="/nutrition/journal" className={linkButton}>
          Saisir mes repas ›
        </TransitionLink>
      </section>

      <div className={`${card} flex flex-col gap-4`}>
        <BandeSemaine jours={semaine} />
        <div className="flex flex-col gap-1.5">
          <ResumeTaux {...taux7} periode="7 jours" />
          <LigneSerie jours={serie.jours} tronquee={serie.tronquee} />
        </div>
      </div>

      <div className={`${card} flex flex-col gap-4`}>
        <CalendrierMois jours={mois} />
        <LegendeStatuts />
        <ResumeTaux {...taux30} periode="30 jours" />
        <p className={metaText}>
          Jour réussi : kcal sous la cible. Les jours sans repas saisi ne comptent pas.
        </p>
      </div>
    </div>
  );
}
