import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CRENEAUX_MENU, joursDeLaSemaine } from "@/lib/menus/compute";
import { vueRepas } from "@/lib/nutrition/vue-repas";
import { semaineDe } from "@/lib/seances/compute";
import { card, errorText, linkButton } from "@/lib/ui";
import { EnvoyerCoursesBouton } from "./EnvoyerCoursesBouton";
import { JourMenu, type CreneauMenu } from "./JourMenu";
import { hrefSemaineMenus, lireSemaineMenus, type MenusSearchParams } from "./semaine";

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
  const { data, error } = await supabase
    .from("menus_repas")
    .select(
      "id, date, moment, quantite, mange, aliment:aliments(*), recette:recettes(id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g)))"
    )
    .gte("date", jours[0])
    .lte("date", jours[6])
    .order("created_at");

  if (error) return <p className={errorText}>Erreur de chargement : {error.message}</p>;

  // Une entrée orpheline (aliment et recette supprimés) est ignorée par vueRepas.
  const repas = (data ?? []).flatMap((entree) => {
    const vue = vueRepas(entree);
    return vue
      ? [
          {
            date: entree.date,
            moment: entree.moment,
            mange: entree.mange,
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
    return { date, creneaux, kcal: duJour.reduce((somme, r) => somme + r.planifie.kcal, 0), nb: duJour.length };
  });

  const joursRemplis = parJour.filter((j) => j.nb > 0);
  const moyenneKcal =
    joursRemplis.length > 0 ? joursRemplis.reduce((somme, j) => somme + j.kcal, 0) / joursRemplis.length : null;
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
          kcal={jour.kcal}
          creneaux={jour.creneaux}
        />
      ))}
    </div>
  );
}
