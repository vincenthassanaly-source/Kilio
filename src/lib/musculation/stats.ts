// Statistiques de musculation : records, progression par exercice, résumé d'une
// période et répartition par muscle. Logique pure (aucun accès réseau ni
// React) : les Server Actions fournissent les séries, tout se teste directement.
import { compteDansLeVolume, type Muscle, type TypeSerie } from "./constantes";

/** Une série enregistrée, avec la séance et l'exercice auxquels elle appartient. */
export type SerieHistorique = {
  entrainementId: string;
  /** AAAA-MM-JJ, heure de Paris. */
  date: string;
  /** Instant de début de la séance (ISO) : départage deux séances le même jour. */
  debutA: string;
  exerciceId: string;
  type: TypeSerie;
  poids: number | null;
  reps: number | null;
  duree: number | null;
  distance: number | null;
};

export type ValeurRecord = { valeur: number; date: string };

export type RecordsExercice = {
  /** Charge la plus lourde soulevée (kg, lest compris pour le poids du corps). */
  poidsMax: ValeurRecord | null;
  /** 1RM estimé (Epley) le plus élevé. */
  e1rmMax: ValeurRecord | null;
  /** Meilleur poids × reps sur une série. */
  volumeSerieMax: ValeurRecord | null;
  /** Meilleur tonnage sur une séance. */
  volumeSeanceMax: ValeurRecord | null;
  repsMax: ValeurRecord | null;
  dureeMax: ValeurRecord | null;
  distanceMax: ValeurRecord | null;
};

export type TypeRecord = "poids" | "e1rm" | "reps" | "duree" | "distance";

export type MetriqueProgression = "e1rm" | "poids" | "volume";

/** Au-delà, l'estimation de Epley n'est plus fiable : pas de 1RM estimé. */
const REPS_MAX_E1RM = 12;

/** 1RM estimé (formule de Epley) ; `null` hors de 1 à 12 répétitions ou sans charge. */
export function e1rm(poids: number | null, reps: number | null): number | null {
  if (poids === null || reps === null || poids <= 0 || reps < 1 || reps > REPS_MAX_E1RM) return null;
  return Math.round(poids * (1 + reps / 30) * 10) / 10;
}

const arrondir = (n: number) => Math.round(n * 100) / 100;

/** Séries de travail seulement : l'échauffement ne fait jamais un record. */
function travail(series: readonly SerieHistorique[]): SerieHistorique[] {
  return series.filter((s) => compteDansLeVolume(s.type));
}

/** Plus ancien d'abord : à valeur égale, le record garde la date de sa première réalisation. */
function chronologique(series: readonly SerieHistorique[]): SerieHistorique[] {
  return [...series].sort((a, b) => Date.parse(a.debutA) - Date.parse(b.debutA));
}

function meilleur(courant: ValeurRecord | null, valeur: number | null, date: string): ValeurRecord | null {
  if (valeur === null || valeur <= 0) return courant;
  return !courant || valeur > courant.valeur ? { valeur: arrondir(valeur), date } : courant;
}

/** Tonnage d'une série ; une assistance (poids négatif) ne compte pas. */
function volumeSerie(s: Pick<SerieHistorique, "poids" | "reps">): number | null {
  if (s.reps === null || s.reps <= 0) return null;
  const poids = Math.max(0, s.poids ?? 0);
  return poids > 0 ? poids * s.reps : null;
}

export function calculerRecords(series: readonly SerieHistorique[]): RecordsExercice {
  const records: RecordsExercice = {
    poidsMax: null,
    e1rmMax: null,
    volumeSerieMax: null,
    volumeSeanceMax: null,
    repsMax: null,
    dureeMax: null,
    distanceMax: null,
  };
  const volumeParSeance = new Map<string, { volume: number; date: string }>();

  for (const s of chronologique(travail(series))) {
    records.poidsMax = meilleur(records.poidsMax, s.poids, s.date);
    records.e1rmMax = meilleur(records.e1rmMax, e1rm(s.poids, s.reps), s.date);
    records.repsMax = meilleur(records.repsMax, s.reps, s.date);
    records.dureeMax = meilleur(records.dureeMax, s.duree, s.date);
    records.distanceMax = meilleur(records.distanceMax, s.distance, s.date);
    const v = volumeSerie(s);
    records.volumeSerieMax = meilleur(records.volumeSerieMax, v, s.date);
    if (v !== null) {
      const total = volumeParSeance.get(s.entrainementId);
      volumeParSeance.set(s.entrainementId, { volume: (total?.volume ?? 0) + v, date: s.date });
    }
  }
  // Les séances sont parcourues dans l'ordre d'insertion, donc la plus ancienne d'abord.
  for (const { volume, date } of volumeParSeance.values()) {
    records.volumeSeanceMax = meilleur(records.volumeSeanceMax, volume, date);
  }
  return records;
}

// --- Progression ----------------------------------------------------------

export type PointProgression = { entrainementId: string; date: string; debutA: string; valeur: number };

/**
 * Une valeur par séance, de la plus ancienne à la plus récente : meilleur 1RM
 * estimé ou plus lourde charge de la séance, ou son tonnage sur l'exercice.
 * Les séances sans valeur pour cette métrique sont omises.
 */
export function progression(series: readonly SerieHistorique[], metrique: MetriqueProgression): PointProgression[] {
  const parSeance = new Map<string, PointProgression>();
  for (const s of travail(series)) {
    let valeur: number | null;
    if (metrique === "e1rm") valeur = e1rm(s.poids, s.reps);
    else if (metrique === "poids") valeur = s.poids !== null && s.poids > 0 ? s.poids : null;
    else valeur = volumeSerie(s);
    if (valeur === null) continue;

    const point = parSeance.get(s.entrainementId);
    if (!point) {
      parSeance.set(s.entrainementId, { entrainementId: s.entrainementId, date: s.date, debutA: s.debutA, valeur });
    } else {
      point.valeur = metrique === "volume" ? point.valeur + valeur : Math.max(point.valeur, valeur);
    }
  }
  return [...parSeance.values()]
    .map((p) => ({ ...p, valeur: arrondir(p.valeur) }))
    .sort((a, b) => Date.parse(a.debutA) - Date.parse(b.debutA));
}

export type StatsExercice = {
  nbSeances: number;
  records: RecordsExercice;
  progression: Record<MetriqueProgression, PointProgression[]>;
};

/** Tout ce qu'affiche la fiche statistique d'un exercice. */
export function statsExercice(series: readonly SerieHistorique[]): StatsExercice {
  return {
    nbSeances: new Set(series.map((s) => s.entrainementId)).size,
    records: calculerRecords(series),
    progression: {
      e1rm: progression(series, "e1rm"),
      poids: progression(series, "poids"),
      volume: progression(series, "volume"),
    },
  };
}

// --- Records battus en séance --------------------------------------------

type SerieEnCours = Pick<SerieHistorique, "type" | "poids" | "reps" | "duree" | "distance">;

function valeursDeSerie(s: SerieEnCours): Record<TypeRecord, number | null> {
  return {
    poids: s.poids !== null && s.poids > 0 ? s.poids : null,
    e1rm: e1rm(s.poids, s.reps),
    reps: s.reps !== null && s.reps > 0 ? s.reps : null,
    duree: s.duree !== null && s.duree > 0 ? s.duree : null,
    distance: s.distance !== null && s.distance > 0 ? s.distance : null,
  };
}

const CLE_RECORD: Record<TypeRecord, keyof RecordsExercice> = {
  poids: "poidsMax",
  e1rm: "e1rmMax",
  reps: "repsMax",
  duree: "dureeMax",
  distance: "distanceMax",
};

/**
 * Records battus par les séries, dans l'ordre de la séance. Une série bat un
 * record si elle dépasse strictement le meilleur connu (historique, puis
 * séries précédentes de la même séance). Sans record antérieur pour un type,
 * rien n'est signalé : la toute première fois n'est pas un « PR ».
 * Retourne, pour chaque série de travail, les types de records battus.
 */
export function recordsBattus(
  series: readonly SerieEnCours[],
  baseline: RecordsExercice | null | undefined,
): TypeRecord[][] {
  // Meilleure valeur connue par type : l'historique, puis les séries de la séance.
  const courant: Partial<Record<TypeRecord, number>> = {};
  const avecHistorique = new Set<TypeRecord>();
  for (const type of Object.keys(CLE_RECORD) as TypeRecord[]) {
    const v = baseline?.[CLE_RECORD[type]]?.valeur;
    if (v !== undefined && v > 0) {
      courant[type] = v;
      avecHistorique.add(type);
    }
  }

  return series.map((s) => {
    if (!compteDansLeVolume(s.type)) return [];
    const battus: TypeRecord[] = [];
    for (const [type, valeur] of Object.entries(valeursDeSerie(s)) as [TypeRecord, number | null][]) {
      if (valeur === null) continue;
      const reference = courant[type];
      if (reference !== undefined && valeur <= reference) continue;
      if (reference !== undefined && avecHistorique.has(type)) battus.push(type);
      courant[type] = valeur;
    }
    return battus;
  });
}

const LIBELLE_RECORD: Record<TypeRecord, string> = {
  poids: "charge",
  e1rm: "1RM estimé",
  reps: "répétitions",
  duree: "durée",
  distance: "distance",
};

/** « charge et 1RM estimé » : les records battus par une série, en une phrase. */
export function libelleRecords(types: readonly TypeRecord[]): string {
  const libelles = types.map((t) => LIBELLE_RECORD[t]);
  return libelles.length <= 1 ? (libelles[0] ?? "") : `${libelles.slice(0, -1).join(", ")} et ${libelles.at(-1)}`;
}

// --- Période --------------------------------------------------------------

export type SeancePeriode = { id: string; date: string; dureeS: number };
export type SeriePeriode = { entrainementId: string; muscle: Muscle; type: TypeSerie; poids: number | null; reps: number | null };

export type ResumePeriode = {
  nbSeances: number;
  dureeS: number;
  /** Séries de travail (échauffement exclu). */
  nbSeries: number;
  volume: number;
  /** Jours (AAAA-MM-JJ) où au moins une séance a eu lieu. */
  jours: string[];
  /** Séries de travail par muscle principal, du plus travaillé au moins travaillé. */
  parMuscle: { muscle: Muscle; nbSeries: number }[];
};

export function resumerPeriode(seances: readonly SeancePeriode[], series: readonly SeriePeriode[]): ResumePeriode {
  const parMuscle = new Map<Muscle, number>();
  let nbSeries = 0;
  let volume = 0;
  for (const s of series) {
    if (!compteDansLeVolume(s.type)) continue;
    nbSeries += 1;
    parMuscle.set(s.muscle, (parMuscle.get(s.muscle) ?? 0) + 1);
    volume += Math.max(0, s.poids ?? 0) * (s.reps ?? 0);
  }
  return {
    nbSeances: seances.length,
    dureeS: seances.reduce((n, s) => n + s.dureeS, 0),
    nbSeries,
    volume: Math.round(volume),
    jours: [...new Set(seances.map((s) => s.date))].sort(),
    parMuscle: [...parMuscle.entries()]
      .map(([muscle, n]) => ({ muscle, nbSeries: n }))
      .sort((a, b) => b.nbSeries - a.nbSeries || a.muscle.localeCompare(b.muscle)),
  };
}

// --- Bornes de période ----------------------------------------------------

export type TypePeriode = "semaine" | "mois";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function ajouterJours(date: string, n: number): string {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

/**
 * Bornes (incluses) de la semaine (lundi → dimanche) ou du mois qui contient
 * `date`, décalées de `decalage` périodes (négatif = passé).
 */
export function bornesPeriode(type: TypePeriode, date: string, decalage = 0): { debut: string; fin: string } {
  if (!ISO.test(date)) throw new Error("Date invalide.");
  const [a, m, j] = date.split("-").map(Number);
  if (type === "semaine") {
    const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
    const debut = ajouterJours(date, -((jourSemaine + 6) % 7) + decalage * 7);
    return { debut, fin: ajouterJours(debut, 6) };
  }
  const debut = new Date(Date.UTC(a, m - 1 + decalage, 1));
  const fin = new Date(Date.UTC(a, m + decalage, 0));
  return { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
}

/** Tous les jours d'une période, du premier au dernier. */
export function joursDePeriode(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let d = debut; d <= fin && jours.length < 400; d = ajouterJours(d, 1)) jours.push(d);
  return jours;
}
