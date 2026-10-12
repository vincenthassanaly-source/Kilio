// Logique pure de la séance en direct : état du brouillon (stocké dans Dexie
// pendant la séance), minuteur de repos et construction de l'envoi au serveur.
// Aucune dépendance à React, à Dexie ni au réseau : tout se teste directement.
// Les horodatages sont des chaînes ISO ; `now` est toujours passé par
// l'appelant pour que les calculs restent déterministes.
import {
  CHAMPS_PAR_MODE,
  compteDansLeVolume,
  estTypeSerie,
  type ModeSaisie,
  type TypeSeance,
  type TypeSerie,
} from "./constantes";
import { estTypeSeance } from "@/lib/seances/compute";
import type { CleAnimation } from "./animations";
import type { RecordsExercice } from "./stats";

/** Série réalisée lors de la dernière séance, affichée en repère et préremplie. */
export type SeriePrecedente = {
  poids: number | null;
  reps: number | null;
  duree: number | null;
  distance: number | null;
  /** Vitesse en km/h (marche). */
  vitesse?: number | null;
};

export type SerieBrouillon = {
  id: string;
  type: TypeSerie;
  /** Charge en kg (lest ajouté si l'exercice est au poids du corps, négatif = assistance). */
  poids: number | null;
  reps: number | null;
  /** Durée en secondes. */
  duree: number | null;
  /** Distance en mètres. */
  distance: number | null;
  /** Vitesse en km/h (absente des anciens brouillons). */
  vitesse?: number | null;
  fait: boolean;
  faitA: string | null;
  /** Repos pris APRÈS cette série, connu quand la série suivante est validée. */
  reposPris: number | null;
};

export type ExerciceBrouillon = {
  /** Identifiant local : un même exercice peut figurer deux fois dans une séance. */
  cle: string;
  exerciceId: string;
  nom: string;
  mode: ModeSaisie;
  /** Repos prévu après chaque série, en secondes. */
  reposS: number;
  series: SerieBrouillon[];
  precedent: SeriePrecedente[];
  /** Records connus avant la séance : permet d'annoncer un nouveau record. Absent des anciens brouillons. */
  records?: RecordsExercice | null;
  /** Animation de l'exercice. Absente des anciens brouillons. */
  animation?: CleAnimation | null;
};

export type Repos = { debutA: string; finA: string; dureeS: number; exerciceCle: string };

export type Brouillon = {
  id: string;
  nom: string;
  routineId: string | null;
  /** Type (Push / Pull / Legs) choisi pour une séance libre. Absent des anciens brouillons. */
  typeSeance?: TypeSeance | null;
  debutA: string;
  exercices: ExerciceBrouillon[];
  repos: Repos | null;
};

export type NouvelExercice = {
  exerciceId: string;
  nom: string;
  mode: ModeSaisie;
  reposS: number;
  nbSeries: number;
  precedent: SeriePrecedente[];
  records?: RecordsExercice | null;
  animation?: CleAnimation | null;
};

export type EntrainementPayload = {
  id: string;
  nom: string;
  routineId: string | null;
  /** Type choisi à la fin d'une séance libre ; pour une routine, le serveur reprend celui de la routine. */
  typeSeance: TypeSeance | null;
  debutA: string;
  finA: string;
  exercices: {
    cle: string;
    exerciceId: string;
    reposS: number;
    series: {
      id: string;
      type: TypeSerie;
      poids: number | null;
      reps: number | null;
      duree: number | null;
      distance: number | null;
      vitesse?: number | null;
    }[];
  }[];
};

export const REPOS_PAR_DEFAUT_S = 90;
const REPOS_MIN_S = 5;
const REPOS_PRIS_MAX_S = 7200;

type GenererId = () => string;
const uuid: GenererId = () => crypto.randomUUID();

const ms = (iso: string) => new Date(iso).getTime();

// --- Création -------------------------------------------------------------

function serieVide(modele: SeriePrecedente | undefined, id: string, type: TypeSerie = "normale"): SerieBrouillon {
  return {
    id,
    type,
    poids: modele?.poids ?? null,
    reps: modele?.reps ?? null,
    duree: modele?.duree ?? null,
    distance: modele?.distance ?? null,
    vitesse: modele?.vitesse ?? null,
    fait: false,
    faitA: null,
    reposPris: null,
  };
}

/**
 * Exercice prêt à saisir : chaque série reprend celle de même rang de la
 * dernière séance (sinon la dernière connue), pour que valider soit un seul tap.
 */
export function creerExerciceBrouillon(source: NouvelExercice, genererId: GenererId = uuid): ExerciceBrouillon {
  const nb = Math.max(1, source.nbSeries);
  return {
    cle: genererId(),
    exerciceId: source.exerciceId,
    nom: source.nom,
    mode: source.mode,
    reposS: source.reposS,
    precedent: source.precedent,
    records: source.records ?? null,
    animation: source.animation ?? null,
    series: Array.from({ length: nb }, (_, i) =>
      serieVide(source.precedent[i] ?? source.precedent.at(-1), genererId()),
    ),
  };
}

export function creerBrouillon(
  entree: {
    nom: string;
    routineId: string | null;
    maintenant: string;
    exercices: NouvelExercice[];
  },
  genererId: GenererId = uuid,
): Brouillon {
  return {
    id: genererId(),
    nom: entree.nom,
    routineId: entree.routineId,
    typeSeance: null,
    debutA: entree.maintenant,
    exercices: entree.exercices.map((e) => creerExerciceBrouillon(e, genererId)),
    repos: null,
  };
}

// --- Édition --------------------------------------------------------------

function surExercice(b: Brouillon, cle: string, f: (e: ExerciceBrouillon) => ExerciceBrouillon): Brouillon {
  return { ...b, exercices: b.exercices.map((e) => (e.cle === cle ? f(e) : e)) };
}

export function ajouterExercice(b: Brouillon, source: NouvelExercice, genererId: GenererId = uuid): Brouillon {
  return { ...b, exercices: [...b.exercices, creerExerciceBrouillon(source, genererId)] };
}

export function retirerExercice(b: Brouillon, cle: string): Brouillon {
  const repos = b.repos?.exerciceCle === cle ? null : b.repos;
  return { ...b, exercices: b.exercices.filter((e) => e.cle !== cle), repos };
}

/**
 * Remplace un exercice par un autre du catalogue, à la même place. La clé locale,
 * le nombre de séries et leur type sont conservés ; valeurs et cases cochées
 * repartent de la dernière séance du nouvel exercice. Un repos en cours n'est pas touché.
 */
export function remplacerExercice(b: Brouillon, cle: string, source: NouvelExercice, genererId: GenererId = uuid): Brouillon {
  return surExercice(b, cle, (ancien) => {
    const nouveau = creerExerciceBrouillon(source, genererId);
    return {
      ...nouveau,
      cle: ancien.cle,
      series: ancien.series.map((s, i) => serieVide(source.precedent[i] ?? source.precedent.at(-1), s.id, s.type)),
    };
  });
}

/** Décale un exercice d'un cran vers le haut (-1) ou le bas (1) ; sans effet aux extrémités. */
export function deplacerExercice(b: Brouillon, cle: string, sens: -1 | 1): Brouillon {
  const index = b.exercices.findIndex((e) => e.cle === cle);
  const cible = index + sens;
  if (index === -1 || cible < 0 || cible >= b.exercices.length) return b;
  const exercices = [...b.exercices];
  [exercices[index], exercices[cible]] = [exercices[cible], exercices[index]];
  return { ...b, exercices };
}

/** Nouvelle série : copie les valeurs de la dernière série de l'exercice. */
export function ajouterSerie(b: Brouillon, cle: string, genererId: GenererId = uuid): Brouillon {
  return surExercice(b, cle, (e) => {
    const derniere = e.series.at(-1);
    return { ...e, series: [...e.series, serieVide(derniere ?? e.precedent.at(-1), genererId())] };
  });
}

export function retirerSerie(b: Brouillon, cle: string, serieId: string): Brouillon {
  return surExercice(b, cle, (e) =>
    e.series.length <= 1 ? e : { ...e, series: e.series.filter((s) => s.id !== serieId) },
  );
}

/** Repos prévu après chaque série de cet exercice (0 à 30 min, par pas libres). */
export function ajusterReposExercice(b: Brouillon, cle: string, deltaS: number): Brouillon {
  return surExercice(b, cle, (e) => ({ ...e, reposS: Math.min(1800, Math.max(0, e.reposS + deltaS)) }));
}

export function modifierSerie(
  b: Brouillon,
  cle: string,
  serieId: string,
  champs: Partial<Pick<SerieBrouillon, "poids" | "reps" | "duree" | "distance" | "vitesse" | "type">>,
): Brouillon {
  return surExercice(b, cle, (e) => {
    const index = e.series.findIndex((s) => s.id === serieId);
    // Un poids saisi se répercute sur les séries suivantes non faites (échauffements exclus).
    const repercute = "poids" in champs && index >= 0 && (champs.type ?? e.series[index].type) !== "echauffement";
    return {
      ...e,
      series: e.series.map((s, i) => {
        if (s.id === serieId) return { ...s, ...champs };
        if (repercute && i > index && !s.fait && s.type !== "echauffement") return { ...s, poids: champs.poids ?? null };
        return s;
      }),
    };
  });
}

/**
 * Coche ou décoche une série.
 *  - Cocher horodate la série, renseigne le repos pris après la série
 *    précédente du même exercice et lance le minuteur de repos prévu.
 *  - Décocher efface l'horodatage et annule le minuteur qu'avait lancé cette série.
 */
export function basculerSerie(b: Brouillon, cle: string, serieId: string, maintenant: string): Brouillon {
  const exercice = b.exercices.find((e) => e.cle === cle);
  const serie = exercice?.series.find((s) => s.id === serieId);
  if (!exercice || !serie) return b;

  if (serie.fait) {
    const lanceeParCetteSerie = b.repos?.exerciceCle === cle && b.repos.debutA === serie.faitA;
    // Le repos de la série précédente se terminait sur celle-ci : il redevient inconnu.
    const precedente = derniereFaite(exercice, serieId);
    const corrige = surExercice(b, cle, (e) => ({
      ...e,
      series: e.series.map((s) => {
        if (s.id === serieId) return { ...s, fait: false, faitA: null, reposPris: null };
        if (precedente && s.id === precedente.id) return { ...s, reposPris: null };
        return s;
      }),
    }));
    return lanceeParCetteSerie ? { ...corrige, repos: null } : corrige;
  }

  const precedente = derniereFaite(exercice, serieId);
  const reposPris = precedente?.faitA
    ? Math.min(REPOS_PRIS_MAX_S, Math.max(0, Math.round((ms(maintenant) - ms(precedente.faitA)) / 1000)))
    : null;

  const coche = surExercice(b, cle, (e) => ({
    ...e,
    series: e.series.map((s) => {
      if (s.id === serieId) return { ...s, fait: true, faitA: maintenant };
      if (precedente && s.id === precedente.id) return { ...s, reposPris };
      return s;
    }),
  }));

  if (exercice.reposS <= 0) return { ...coche, repos: null };
  return {
    ...coche,
    repos: {
      debutA: maintenant,
      finA: new Date(ms(maintenant) + exercice.reposS * 1000).toISOString(),
      dureeS: exercice.reposS,
      exerciceCle: cle,
    },
  };
}

/** Série déjà faite la plus récente de l'exercice, hors `exceptId`. */
function derniereFaite(exercice: ExerciceBrouillon, exceptId: string): SerieBrouillon | null {
  let meilleure: SerieBrouillon | null = null;
  for (const s of exercice.series) {
    if (s.id === exceptId || !s.fait || !s.faitA) continue;
    if (!meilleure || ms(s.faitA) > ms(meilleure.faitA!)) meilleure = s;
  }
  return meilleure;
}

// --- Minuteur de repos ----------------------------------------------------

export function ajusterRepos(b: Brouillon, deltaS: number): Brouillon {
  if (!b.repos) return b;
  const dureeS = Math.max(REPOS_MIN_S, b.repos.dureeS + deltaS);
  const finA = new Date(ms(b.repos.debutA) + dureeS * 1000).toISOString();
  return { ...b, repos: { ...b.repos, dureeS, finA } };
}

export function terminerRepos(b: Brouillon): Brouillon {
  return b.repos ? { ...b, repos: null } : b;
}

/** Secondes restantes (0 une fois écoulé). */
export function resteRepos(repos: Repos, maintenant: string): number {
  return Math.max(0, Math.ceil((ms(repos.finA) - ms(maintenant)) / 1000));
}

// --- Synthèse -------------------------------------------------------------

export function compterSeries(b: Brouillon): { faites: number; total: number } {
  const total = b.exercices.reduce((n, e) => n + e.series.length, 0);
  const faites = b.exercices.reduce((n, e) => n + e.series.filter((s) => s.fait).length, 0);
  return { faites, total };
}

/**
 * Tonnage de la séance : somme poids × répétitions des séries faites, hors
 * échauffement. Un poids négatif (assistance) ne compte pas comme du volume.
 */
export function volumeTotal(b: Brouillon): number {
  return b.exercices.reduce(
    (total, e) =>
      total +
      e.series.reduce(
        (v, s) => (s.fait && compteDansLeVolume(s.type) ? v + Math.max(0, s.poids ?? 0) * (s.reps ?? 0) : v),
        0,
      ),
    0,
  );
}

/**
 * Libellé de la colonne « Série » : les séries d'échauffement s'affichent « É »
 * et ne comptent pas dans la numérotation des séries de travail.
 */
export function libelleSerie(series: readonly SerieBrouillon[], index: number): string {
  const serie = series[index];
  if (serie.type === "echauffement") return "É";
  const rang = series.slice(0, index + 1).filter((s) => s.type !== "echauffement").length;
  return String(rang);
}

/**
 * Ce qu'on envoie au serveur : uniquement les séries faites, dans l'ordre,
 * regroupées par exercice. `null` si rien n'a été validé (une séance vide n'est
 * pas enregistrée).
 */
export function versPayload(b: Brouillon, finA: string): EntrainementPayload | null {
  const exercices: EntrainementPayload["exercices"] = [];
  for (const e of b.exercices) {
    const series = e.series
      .filter((s) => s.fait && s.faitA)
      .map((s) => ({
        id: s.id,
        type: s.type,
        poids: s.poids,
        reps: s.reps,
        duree: s.duree,
        distance: s.distance,
        vitesse: s.vitesse ?? null,
      }));
    if (series.length > 0) exercices.push({ cle: e.cle, exerciceId: e.exerciceId, reposS: e.reposS, series });
  }
  if (exercices.length === 0) return null;
  return {
    id: b.id,
    nom: b.nom,
    routineId: b.routineId,
    typeSeance: b.routineId ? null : (b.typeSeance ?? null),
    debutA: b.debutA,
    finA,
    exercices,
  };
}

// --- Saisie et affichage --------------------------------------------------

/** « 82,5 » ou « 82.5 » → 82.5 ; vide ou invalide → null ; négatif accepté si `signe`. */
export function lireNombre(texte: string, signe = false): number | null {
  const nettoye = texte.trim().replace(",", ".");
  if (nettoye === "" || nettoye === "-") return null;
  const valeur = Number(nettoye);
  if (!Number.isFinite(valeur)) return null;
  return valeur >= 0 || signe ? valeur : null;
}

/** 90 → « 1:30 », 5 → « 0:05 ». */
export function formaterMinutes(secondes: number): string {
  const total = Math.max(0, Math.round(secondes));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Durée de séance : 45 min → « 45 min », 75 min → « 1 h 15 ». */
export function formaterDureeSeance(debutA: string, finA: string): string {
  const minutes = Math.max(0, Math.round((ms(finA) - ms(debutA)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Poids affiché sans zéro inutile : 80 → « 80 », 82.5 → « 82,5 ». */
export function formaterPoids(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace(".", ",");
}

/** Repère « Précédent » d'une série, selon les champs du mode de saisie. */
export function libellePrecedent(mode: ModeSaisie, p: SeriePrecedente | undefined): string {
  if (!p) return "–";
  const parties: string[] = [];
  for (const champ of CHAMPS_PAR_MODE[mode]) {
    if (champ === "poids_kg" && p.poids !== null) parties.push(formaterPoids(p.poids));
    if (champ === "reps" && p.reps !== null) parties.push(String(p.reps));
    if (champ === "duree_s" && p.duree !== null) parties.push(`${p.duree} s`);
    if (champ === "distance_m" && p.distance !== null) parties.push(`${formaterPoids(p.distance)} m`);
    if (champ === "vitesse_kmh" && p.vitesse != null) parties.push(`${formaterPoids(p.vitesse)} km/h`);
  }
  if (parties.length === 0) return "–";
  const poidsEtReps = mode === "poids_reps" || mode === "poids_corps_reps";
  return poidsEtReps && parties.length === 2 ? `${parties[0]} × ${parties[1]}` : parties.join(" · ");
}

// --- Validation côté serveur ----------------------------------------------
// Une Server Action reçoit des données non fiables : tout est revérifié ici
// avant d'écrire en base (les contraintes SQL ne sont que le dernier filet).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NB_EXERCICES_MAX = 60;
const NB_SERIES_MAX = 400;
const DUREE_SEANCE_MAX_MS = 24 * 3600 * 1000;

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function estUuid(valeur: unknown): valeur is string {
  return typeof valeur === "string" && UUID.test(valeur);
}

function entierDans(valeur: unknown, min: number, max: number): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= min && valeur <= max;
}

function nullOuEntier(valeur: unknown, min: number, max: number): boolean {
  return valeur === null || entierDans(valeur, min, max);
}

function nullOuNombre(valeur: unknown, min: number, max: number): boolean {
  return valeur === null || (typeof valeur === "number" && Number.isFinite(valeur) && valeur >= min && valeur <= max);
}

function dateIso(valeur: unknown): valeur is string {
  return typeof valeur === "string" && !Number.isNaN(Date.parse(valeur));
}

/** `null` si l'envoi est valide, sinon le message à renvoyer à l'appelant. */
export function validerPayload(payload: unknown): string | null {
  if (!estObjet(payload)) return "Séance invalide.";
  const { id, nom, routineId, typeSeance, debutA, finA, exercices } = payload;
  if (!estUuid(id)) return "Identifiant de séance invalide.";
  if (typeof nom !== "string" || nom.trim().length < 1 || nom.trim().length > 80) return "Le nom de la séance est invalide.";
  if (routineId !== null && !estUuid(routineId)) return "Routine invalide.";
  // Absent des envois en attente créés avant ce champ : traité comme « aucun type ».
  if (typeSeance != null && !(typeof typeSeance === "string" && estTypeSeance(typeSeance))) return "Type de séance invalide.";
  if (!dateIso(debutA) || !dateIso(finA)) return "Dates de séance invalides.";
  if (ms(finA) < ms(debutA) || ms(finA) - ms(debutA) > DUREE_SEANCE_MAX_MS) return "Durée de séance invalide.";
  if (!Array.isArray(exercices) || exercices.length < 1 || exercices.length > NB_EXERCICES_MAX) {
    return "La séance doit contenir entre 1 et 60 exercices.";
  }

  const cles = new Set<string>();
  const idsSeries = new Set<string>();
  for (const exercice of exercices) {
    if (!estObjet(exercice)) return "Exercice invalide.";
    if (!estUuid(exercice.cle) || cles.has(exercice.cle)) return "Identifiant d'exercice invalide.";
    cles.add(exercice.cle);
    if (!estUuid(exercice.exerciceId)) return "Exercice invalide.";
    if (!entierDans(exercice.reposS, 0, 1800)) return "Repos invalide.";
    const { series } = exercice;
    if (!Array.isArray(series) || series.length < 1) return "Un exercice doit contenir au moins une série.";
    for (const serie of series) {
      if (!estObjet(serie)) return "Série invalide.";
      if (!estUuid(serie.id) || idsSeries.has(serie.id)) return "Identifiant de série invalide.";
      idsSeries.add(serie.id);
      if (idsSeries.size > NB_SERIES_MAX) return "La séance contient trop de séries (400 maximum).";
      if (!estTypeSerie(serie.type)) return "Type de série invalide.";
      if (!nullOuNombre(serie.poids, -500, 1000)) return "Poids invalide (−500 à 1000 kg).";
      if (!nullOuEntier(serie.reps, 0, 1000)) return "Répétitions invalides (0 à 1000).";
      if (!nullOuEntier(serie.duree, 0, 86400)) return "Durée invalide.";
      if (!nullOuNombre(serie.distance, 0, 1_000_000)) return "Distance invalide.";
      if (serie.vitesse !== undefined && !nullOuNombre(serie.vitesse, 0, 100)) return "Vitesse invalide (0 à 100 km/h).";
    }
  }
  return null;
}
