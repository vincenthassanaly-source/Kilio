// Historique des séances : types, calculs de synthèse et conversions entre une
// séance enregistrée et ce que manipulent l'éditeur (brouillon) et les
// routines. Logique pure : aucun accès réseau ni React.
import { compteDansLeVolume, type ModeSaisie, type TypeSeance } from "./constantes";
import type { RoutineEntree, RoutineSerie } from "./routines";
import type { Brouillon, ExerciceBrouillon, SerieBrouillon } from "./seance";

export type EntrainementResume = {
  id: string;
  titre: string;
  /** AAAA-MM-JJ, heure de Paris. */
  date: string;
  dureeS: number;
  nbExercices: number;
  nbSeries: number;
  /** Tonnage (kg) : poids × reps des séries de travail. */
  volume: number;
};

export type EntrainementExerciceDetail = {
  /** Identifiant de la ligne `entrainement_exercices`, repris comme clé locale. */
  cle: string;
  exerciceId: string;
  nom: string;
  mode: ModeSaisie;
  reposS: number | null;
  series: RoutineSerie[];
};

export type EntrainementDetail = {
  id: string;
  titre: string;
  date: string;
  debutA: string;
  finA: string;
  dureeS: number;
  seanceId: string | null;
  routineId: string | null;
  /** Type de la séance planifiée d'origine, s'il y en a une. */
  typeSeance: TypeSeance | null;
  exercices: EntrainementExerciceDetail[];
};

// --- Synthèse -------------------------------------------------------------

/** Tonnage d'une liste de séries : hors échauffement, sans poids négatif (assistance). */
export function volumeDeSeries(series: readonly RoutineSerie[]): number {
  return series.reduce(
    (total, s) => (compteDansLeVolume(s.type) ? total + Math.max(0, s.poids ?? 0) * (s.reps ?? 0) : total),
    0,
  );
}

export function resumerEntrainement(
  base: { id: string; titre: string; date: string; dureeS: number },
  exercices: readonly { series: readonly RoutineSerie[] }[],
): EntrainementResume {
  return {
    ...base,
    nbExercices: exercices.length,
    nbSeries: exercices.reduce((n, e) => n + e.series.length, 0),
    volume: Math.round(exercices.reduce((v, e) => v + volumeDeSeries(e.series), 0)),
  };
}

// --- Conversions ----------------------------------------------------------

/**
 * Séance enregistrée → brouillon que l'éditeur sait modifier : toutes les
 * séries sont déjà faites (horodatées au début de la séance) et aucun repos
 * n'est en cours.
 */
export function brouillonDepuisEntrainement(
  detail: EntrainementDetail,
  genererId: () => string = () => crypto.randomUUID(),
): Brouillon {
  return {
    id: detail.id,
    nom: detail.titre,
    routineId: detail.routineId,
    seanceId: detail.seanceId,
    debutA: detail.debutA,
    repos: null,
    exercices: detail.exercices.map(
      (e): ExerciceBrouillon => ({
        cle: e.cle,
        exerciceId: e.exerciceId,
        nom: e.nom,
        mode: e.mode,
        reposS: e.reposS ?? 90,
        precedent: [],
        series: e.series.map(
          (s): SerieBrouillon => ({
            id: genererId(),
            type: s.type,
            poids: s.poids,
            reps: s.reps,
            duree: s.duree,
            distance: s.distance,
            fait: true,
            faitA: detail.debutA,
            reposPris: null,
          }),
        ),
      }),
    ),
  };
}

/** Routine reprenant les exercices et séries d'une séance (« enregistrer comme routine »). */
export function routineDepuisEntrainement(
  detail: EntrainementDetail,
  meta: { id?: string; nom: string; typeSeance: TypeSeance | null; dossierId: string | null },
): RoutineEntree {
  return {
    ...(meta.id ? { id: meta.id } : {}),
    nom: meta.nom,
    typeSeance: meta.typeSeance,
    dossierId: meta.dossierId,
    exercices: detail.exercices.map((e) => ({ exerciceId: e.exerciceId, reposS: e.reposS, series: e.series })),
  };
}

// --- Dates (heure de Paris) -----------------------------------------------

const FUSEAU = "Europe/Paris";

const partiesParis = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Décalage de Paris par rapport à UTC à cet instant, en millisecondes (+1 h ou +2 h). */
function decalageParisMs(instantMs: number): number {
  const p: Record<string, string> = {};
  for (const { type, value } of partiesParis.formatToParts(new Date(instantMs))) p[type] = value;
  const commeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return commeUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Instant (ISO UTC) correspondant à `date` (AAAA-MM-JJ) et `heure` (HH:MM) à
 * Paris. Tient compte du changement d'heure ; une heure inexistante (saut de
 * mars) est décalée d'une heure vers l'avant.
 */
export function instantParis(date: string, heure: string): string {
  const [a, m, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const local = Date.UTC(a, m - 1, j, h, mi);
  let instant = local - decalageParisMs(local);
  const corrige = local - decalageParisMs(instant);
  if (corrige !== instant) instant = corrige;
  return new Date(instant).toISOString();
}

/** Heure `HH:MM` de Paris d'un instant ISO. */
export function heureParisDe(iso: string): string {
  const p: Record<string, string> = {};
  for (const { type, value } of partiesParis.formatToParts(new Date(iso))) p[type] = value;
  return `${p.hour}:${p.minute}`;
}

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** « lundi 12 octobre » pour AAAA-MM-JJ. */
export function formaterDateLongue(date: string): string {
  const [a, m, j] = date.split("-").map(Number);
  return dateLongue.format(new Date(Date.UTC(a, m - 1, j)));
}

/** Durée affichée : 45 min → « 45 min », 4500 s → « 1 h 15 ». */
export function formaterDureeS(secondes: number): string {
  const minutes = Math.max(0, Math.round(secondes / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
