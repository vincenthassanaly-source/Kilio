import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDatesEntrainement } from "@/app/actions/journal";
import { getJoursLibres } from "@/app/actions/jours-libres";
import { CRENEAUX_MENU, joursDeLaSemaine } from "@/lib/menus/compute";
import { addNutrition, zeroNutrition, type Nutrition } from "@/lib/nutrition/compute";
import { jourTypePourDate } from "@/lib/nutrition/planning";
import { vueRepas } from "@/lib/nutrition/vue-repas";
import { semaineDe } from "@/lib/seances/compute";
import { card, linkButton } from "@/lib/ui";
import { CopierSemaineBouton } from "./CopierSemaineBouton";
import { EnvoyerCoursesBouton } from "./EnvoyerCoursesBouton";
import { JourMenu, type CreneauMenu } from "./JourMenu";
import { hrefSemaineMenus, lireSemaineMenus, type MenusSearchParams } from "./semaine";
import { ErrorInlineRefresh } from "@/components/ErrorInlineRefresh";

const FORMAT_JOUR_LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const FORMAT_JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

// Partie des Menus qui dépend de la semaine affichée (URL), rendue sous son
// propre <Suspense> par page.tsx.
export async function MenusSemaine({ searchParams }: { searchParams: MenusSearchParams }) {
  const { lundi, aujourdhui } = await lireSemaineMenus(searchParams);
  const jours = joursDeLaSemaine(lundi);
  const lundiCourant = semaineDe(aujourdhui).debut;

  const supabase = createAdminClient();
  const [{ data, error }, { data: objectifs }, datesEntrainement, joursLibres] = await Promise.all([
    supabase
      .from("menus_repas")
      .select(
        "id, date, moment, quantite, mange, aliment:aliments(*), recette:recettes(id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g)))"
      )
      .gte("date", jours[0])
      .lte("date", jours[6])
      .order("created_at"),
    supabase.from("objectifs_nutritionnels").select("*"),
    getDatesEntrainement(jours[0], jours[6]),
    getJoursLibres(jours[0], jours[6]),
  ]);

  if (error) {
    console.error("Menus de la semaine : lecture impossible", error);
    return <ErrorInlineRefresh message="Impossible de charger les menus de la semaine." />;
  }

  // Cible par type de jour (repos / entraînement) ; null si aucun objectif défini.
  const cibleDuType = (jourType: "repos" | "entrainement"): Nutrition | null => {
    const objectif = objectifs?.find((o) => o.jour_type === jourType);
    return objectif
      ? {
          kcal: objectif.kcal_cible,
          proteines: objectif.proteines_cible_g,
          glucides: objectif.glucides_cible_g,
          lipides: objectif.lipides_cible_g,
        }
      : null;
  };

  // Une entrée orpheline (aliment et recette supprimés) est ignorée par vueRepas.
  const repas = (data ?? []).flatMap((entree) => {
    const vue = vueRepas(entree);
    return vue
      ? [
          {
            date: entree.date,
            moment: entree.moment,
            mange: entree.mange,
            nutrition: vue.nutrition,
            planifie: { id: entree.id, label: vue.label, detail: vue.detail, kcal: vue.nutrition.kcal, mange: entree.mange },
          },
        ]
      : [];
  });

  const parJour = jours.map((date) => {
    const duJour = repas.filter((r) => r.date === date);
    const creneaux: CreneauMenu[] = CRENEAUX_MENU.map((moment) => ({
      moment,
      repas: duJour.filter((r) => r.moment === moment).map((r) => r.planifie),
    }));
    const prevu = duJour.reduce((somme, r) => addNutrition(somme, r.nutrition), zeroNutrition());
    const jourType = jourTypePourDate(date, datesEntrainement);
    return {
      date,
      creneaux,
      prevu,
      entraine: jourType === "entrainement",
      libre: joursLibres.includes(date),
      cible: cibleDuType(jourType),
      nb: duJour.length,
    };
  });

  const joursRemplis = parJour.filter((j) => j.nb > 0);
  const moyenneKcal =
    joursRemplis.length > 0 ? joursRemplis.reduce((somme, j) => somme + j.prevu.kcal, 0) / joursRemplis.length : null;
  const nbAVenir = repas.filter((r) => !r.mange).length;
  const semaineCourante = lundi === lundiCourant;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} flex flex-col gap-3`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink-3">Prévu sur la semaine</p>
            <p className="font-display text-[22px] font-semibold tabular-nums text-ink">
              {moyenneKcal === null ? "—" : Math.round(moyenneKcal).toLocaleString("fr-FR")}
              <span className="ml-1 font-sans text-sm font-semibold text-ink-2">kcal / jour</span>
            </p>
            <p className="text-xs text-ink-2">
              {repas.length === 0
                ? "Aucun repas planifié."
                : `${repas.length} repas sur ${joursRemplis.length} jour${joursRemplis.length > 1 ? "s" : ""}`}
            </p>
          </div>
          {!semaineCourante && (
            <Link href={hrefSemaineMenus(lundiCourant)} replace className={`${linkButton} shrink-0`}>
              Cette semaine
            </Link>
          )}
        </div>
        {repas.length === 0 && <CopierSemaineBouton lundi={lundi} />}
        <EnvoyerCoursesBouton lundi={lundi} nbAVenir={nbAVenir} />
      </div>

      {parJour.map((jour, index) => (
        <JourMenu
          key={jour.date}
          date={jour.date}
          jourLabel={FORMAT_JOUR_LONG.format(utc(jour.date))}
          jourCourt={FORMAT_JOUR_COURT.format(utc(jour.date))}
          estAujourdhui={jour.date === aujourdhui}
          defiler={jour.date === aujourdhui && index > 0}
          entraine={jour.entraine}
          libre={jour.libre}
          prevu={jour.prevu}
          cible={jour.cible}
          creneaux={jour.creneaux}
        />
      ))}
    </div>
  );
}
