import { createAdminClient } from "@/lib/supabase/admin";
import {
  addNutrition,
  hasNutritionOverride,
  nutritionAliment,
  nutritionFromOverride,
  nutritionRecette,
  zeroNutrition,
} from "@/lib/nutrition/compute";
import { card, eyebrow, sectionTitle } from "@/lib/ui";
import { ObjectifForm } from "./ObjectifForm";
import { EntrainementToggle } from "./EntrainementToggle";
import { ResumeJour } from "./ResumeJour";
import { JournalEntriesList, type JournalEntryView } from "./JournalEntriesList";
import { JournalJourAnime } from "./JournalSwipeWrapper";
import { JourNavigation } from "./JournalNavigationJour";
import { AjoutRepasBouton } from "./AjoutRepasBouton";
import { lireJourJournal, type JournalSearchParams } from "./jour";
import { getDatesEntrainement } from "@/app/actions/journal";
import { jourTypePourDate } from "@/lib/nutrition/planning";

// Parties du Journal qui dépendent du jour affiché (URL ou date du jour),
// chacune rendue sous son propre <Suspense> par page.tsx.

export async function JournalDateLibelle({ searchParams }: { searchParams: JournalSearchParams }) {
  const { date } = await lireJourJournal(searchParams);
  const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return <p className={`${eyebrow} capitalize`}>{dateLabel}</p>;
}

export async function JournalJourNavigation({ searchParams }: { searchParams: JournalSearchParams }) {
  return <JourNavigation jour={await lireJourJournal(searchParams)} />;
}

export async function JournalJour({ searchParams }: { searchParams: JournalSearchParams }) {
  const { date } = await lireJourJournal(searchParams);
  const supabase = createAdminClient();

  const [{ data: objectifs }, datesEntrainement, { data: entries }] = await Promise.all([
    supabase.from("objectifs_nutritionnels").select("*"),
    getDatesEntrainement(date, date),
    supabase
      .from("journal_repas")
      .select(
        "*, aliment:aliments(*), recette:recettes(id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g)))"
      )
      .eq("date", date),
  ]);

  // Une entrée sans `aliment` ni `recette` est orpheline (référence supprimée
  // en base) : on l'ignore plutôt que de planter sur `entry.recette!` plus bas.
  const views: JournalEntryView[] = (entries ?? [])
    .filter((entry) => entry.aliment || entry.recette)
    .map((entry) => {
      if (entry.aliment) {
        const { quantite, aliment } = entry;
        // journal_repas.quantite est toujours en grammes/ml, y compris pour un
        // aliment "pièce" (converti avant l'insert via poids_unite_g) : on
        // affiche donc le poids réel, avec l'équivalent en pièces en rappel.
        const piecesEquivalent =
          aliment.unite === "piece" && aliment.poids_unite_g
            ? quantite / aliment.poids_unite_g
            : null;
        const detail =
          piecesEquivalent !== null
            ? `${quantite} g (≈ ${
                Number.isInteger(piecesEquivalent)
                  ? piecesEquivalent
                  : piecesEquivalent.toFixed(1)
              } pièce${piecesEquivalent > 1 ? "s" : ""})`
            : `${quantite} ${aliment.unite === "ml" ? "ml" : "g"}`;

        return {
          id: entry.id,
          moment: entry.moment,
          label: aliment.nom,
          detail,
          nutrition: nutritionAliment(aliment, quantite),
        };
      }

      const recette = entry.recette!;
      return {
        id: entry.id,
        moment: entry.moment,
        label: recette.nom,
        detail: `${entry.quantite} portion${entry.quantite > 1 ? "s" : ""}`,
        nutrition: hasNutritionOverride(recette)
          ? nutritionFromOverride(recette, entry.quantite)
          : nutritionRecette(recette.recette_ingredients, recette.portions, entry.quantite),
      };
    });

  const jourType = jourTypePourDate(date, datesEntrainement);
  const objectifRepos = objectifs?.find((o) => o.jour_type === "repos") ?? null;
  const objectifEntrainement = objectifs?.find((o) => o.jour_type === "entrainement") ?? null;
  const objectif = jourType === "entrainement" ? objectifEntrainement : objectifRepos;

  const consomme = views.reduce((acc, v) => addNutrition(acc, v.nutrition), zeroNutrition());
  const cible = objectif
    ? {
        kcal: objectif.kcal_cible,
        proteines: objectif.proteines_cible_g,
        glucides: objectif.glucides_cible_g,
        lipides: objectif.lipides_cible_g,
      }
    : null;

  return (
    <>
    <JournalJourAnime key={date} date={date}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Objectif ({jourType === "repos" ? "repos" : "entraînement"})</h2>
          <EntrainementToggle date={date} entraine={jourType === "entrainement"} />
          <ObjectifForm repos={objectifRepos} entrainement={objectifEntrainement} />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Résumé du jour</h2>
          <ResumeJour consomme={consomme} cible={cible} />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Repas du jour</h2>
          {views.length === 0 ? (
            <div className={`${card} flex flex-col items-center gap-2.5 py-8 text-center`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6">
                <line x1="5" y1="19" x2="5" y2="11" />
                <line x1="12" y1="19" x2="12" y2="5" />
                <line x1="19" y1="19" x2="19" y2="14" />
              </svg>
              <p className="text-[15px] font-bold text-ink">Aucun repas enregistré pour ce jour.</p>
              <AjoutRepasBouton date={date} variante="carte" />
            </div>
          ) : (
            <JournalEntriesList entries={views} />
          )}
        </div>
        {/* Réserve la place du bouton flottant pour ne jamais masquer la
            dernière entrée. */}
        <div aria-hidden="true" className="h-16" />
      </div>
    </JournalJourAnime>
    {/* Hors de JournalJourAnime : son glissement (transform) décalerait un
        élément `fixed` le temps de l'animation. */}
    <AjoutRepasBouton date={date} />
    </>
  );
}
