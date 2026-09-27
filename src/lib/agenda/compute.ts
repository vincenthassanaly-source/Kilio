import { heureToMinutes } from "@/app/(app)/agenda/date-utils";

// Fonctions pures de mise en page de la grille horaire (DayView/WeekView) :
// bornes temporelles d'un bloc et affectation des colonnes en cas de
// chevauchement. Aucune dépendance React/DOM ici (cf. TimeGrid.tsx pour la
// conversion en pixels, qui réutilise `getBlocInterval`).

// Un bloc avec heure de fin manquante ou incohérente (<= heure de début, ex.
// saisie invalide) dure 30 min par défaut — cohérent avec les pas de rappel
// existants (5/15/30 min).
const DEFAULT_TASK_DURATION_MINUTES = 30;

export type PlageHoraire = {
  heure: string | null;
  heure_fin: string | null;
};

export type BlocHoraire = PlageHoraire & { id: string };

export type IntervalleMinutes = { start: number; end: number };

// Bornes exactes utilisées pour le positionnement vertical d'un bloc
// (TimeGrid.getTacheBlockStyle) : seule source de vérité, réutilisée ici
// pour que le calcul des chevauchements retienne strictement les mêmes
// bornes que le rendu. `null` si le bloc n'a pas d'heure de début (jamais
// affiché dans la grille).
export function getBlocInterval(bloc: PlageHoraire): IntervalleMinutes | null {
  const start = heureToMinutes(bloc.heure);
  if (start === null) return null;

  const endRaw = heureToMinutes(bloc.heure_fin);
  const end = endRaw !== null && endRaw > start ? endRaw : start + DEFAULT_TASK_DURATION_MINUTES;

  return { start, end };
}

// "HH:MM" à partir de minutes depuis minuit — utilisé pour l'aria-label des
// blocs cliquables (toujours une plage complète, y compris quand
// `heure_fin` est absente : cf. getBlocInterval).
export function formatHeureHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type PositionColonne = { colonne: number; nbColonnes: number };

// Affecte une colonne à chaque bloc d'un même groupe de chevauchement
// (glouton, trié par heure de début) : un bloc reprend la première colonne
// déjà libérée (heure de fin <= son heure de début) du groupe, sinon en
// ouvre une nouvelle. `nbColonnes` est le nombre de colonnes réellement
// utilisées par CE groupe (pas un maximum théorique global), pour ne pas
// rétrécir un bloc qui ne chevauche en fait qu'une partie d'une chaîne plus
// longue (ex. A-B-C où A et C ne se chevauchent pas entre eux).
function affecterColonnes(
  groupe: (IntervalleMinutes & { id: string })[],
  resultat: Map<string, PositionColonne>
): void {
  const finsColonnes: number[] = [];
  const colonneParId = new Map<string, number>();

  for (const bloc of groupe) {
    let colonne = finsColonnes.findIndex((fin) => fin <= bloc.start);
    if (colonne === -1) {
      colonne = finsColonnes.length;
      finsColonnes.push(bloc.end);
    } else {
      finsColonnes[colonne] = bloc.end;
    }
    colonneParId.set(bloc.id, colonne);
  }

  const nbColonnes = finsColonnes.length;
  for (const bloc of groupe) {
    resultat.set(bloc.id, { colonne: colonneParId.get(bloc.id)!, nbColonnes });
  }
}

// Regroupe les blocs en chevauchement transitif (A-B-C où A chevauche B et B
// chevauche C, même si A et C ne se touchent pas) puis affecte les colonnes
// groupe par groupe. Les blocs sans heure de début sont ignorés (absents du
// résultat) ; à l'appelant de ne considérer que ceux qui en ont une, comme
// pour l'affichage du bloc lui-même (getTacheBlockStyle).
export function layoutChevauchements(blocs: BlocHoraire[]): Map<string, PositionColonne> {
  const intervalles = blocs
    .map((bloc) => {
      const interval = getBlocInterval(bloc);
      return interval ? { id: bloc.id, ...interval } : null;
    })
    .filter((v): v is IntervalleMinutes & { id: string } => v !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const resultat = new Map<string, PositionColonne>();
  let groupeCourant: (IntervalleMinutes & { id: string })[] = [];
  let finGroupeCourant = -Infinity;

  for (const intervalle of intervalles) {
    if (groupeCourant.length > 0 && intervalle.start >= finGroupeCourant) {
      affecterColonnes(groupeCourant, resultat);
      groupeCourant = [];
      finGroupeCourant = -Infinity;
    }
    groupeCourant.push(intervalle);
    finGroupeCourant = Math.max(finGroupeCourant, intervalle.end);
  }
  if (groupeCourant.length > 0) affecterColonnes(groupeCourant, resultat);

  return resultat;
}
