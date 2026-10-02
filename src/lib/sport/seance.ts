// Logique pure de la séance en direct : état du brouillon (stocké dans Dexie
// pendant la séance), minuteur de repos et construction de l'envoi au serveur.
// Aucune dépendance à React, à Dexie ni au réseau : tout se teste directement.
// Les horodatages sont des chaînes ISO ; `now` est toujours passé par
// l'appelant pour que les calculs restent déterministes.

export type TypeMesure = "poids_reps" | "reps" | "duree" | "poids_duree";

/** Série réalisée lors de la dernière séance, affichée en repère et préremplie. */
export type SeriePrecedente = { poids: number | null; reps: number | null; duree: number | null };

export type SerieBrouillon = {
  id: string;
  poids: number | null;
  reps: number | null;
  /** Durée en secondes (exercices à la durée). */
  duree: number | null;
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
  image: string | null;
  typeMesure: TypeMesure;
  /** Repos prévu après chaque série, en secondes. */
  reposS: number;
  series: SerieBrouillon[];
  precedent: SeriePrecedente[];
};

export type Repos = { debutA: string; finA: string; dureeS: number; exerciceCle: string };

export type Brouillon = {
  id: string;
  nom: string;
  routineId: string | null;
  debutA: string;
  exercices: ExerciceBrouillon[];
  repos: Repos | null;
};

export type NouvelExercice = {
  exerciceId: string;
  nom: string;
  image: string | null;
  typeMesure: TypeMesure;
  reposS: number;
  nbSeries: number;
  precedent: SeriePrecedente[];
  /** Répétitions visées (routine) : utilisées quand il n'y a pas d'historique. */
  repsCible?: number | null;
};

export type SeancePayload = {
  id: string;
  nom: string;
  routineId: string | null;
  debutA: string;
  finA: string;
  series: {
    id: string;
    exerciceId: string;
    position: number;
    ordre: number;
    poids: number | null;
    reps: number | null;
    duree: number | null;
    reposPris: number | null;
    faitA: string;
  }[];
};

export const REPOS_PAR_DEFAUT_S = 90;
const REPOS_MIN_S = 5;
const REPOS_PRIS_MAX_S = 7200;

type GenererId = () => string;
const uuid: GenererId = () => crypto.randomUUID();

const ms = (iso: string) => new Date(iso).getTime();

// --- Création -------------------------------------------------------------

function serieVide(modele: SeriePrecedente | undefined, id: string): SerieBrouillon {
  return {
    id,
    poids: modele?.poids ?? null,
    reps: modele?.reps ?? null,
    duree: modele?.duree ?? null,
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
    image: source.image,
    typeMesure: source.typeMesure,
    reposS: source.reposS,
    precedent: source.precedent,
    series: Array.from({ length: nb }, (_, i) => {
      const serie = serieVide(source.precedent[i] ?? source.precedent.at(-1), genererId());
      const avecReps = source.typeMesure === "poids_reps" || source.typeMesure === "reps";
      return avecReps && serie.reps === null && source.repsCible ? { ...serie, reps: source.repsCible } : serie;
    }),
  };
}

export function creerBrouillon(
  entree: { nom: string; routineId: string | null; maintenant: string; exercices: NouvelExercice[] },
  genererId: GenererId = uuid,
): Brouillon {
  return {
    id: genererId(),
    nom: entree.nom,
    routineId: entree.routineId,
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
  champs: Partial<Pick<SerieBrouillon, "poids" | "reps" | "duree">>,
): Brouillon {
  return surExercice(b, cle, (e) => ({
    ...e,
    series: e.series.map((s) => (s.id === serieId ? { ...s, ...champs } : s)),
  }));
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

/** Tonnage de la séance : somme poids × répétitions des séries faites. */
export function volumeTotal(b: Brouillon): number {
  return b.exercices.reduce(
    (total, e) => total + e.series.reduce((v, s) => (s.fait ? v + (s.poids ?? 0) * (s.reps ?? 0) : v), 0),
    0,
  );
}

/**
 * Ce qu'on envoie au serveur : uniquement les séries faites, renumérotées sans
 * trou. `null` si rien n'a été validé (une séance vide n'est pas enregistrée).
 */
export function versPayload(b: Brouillon, finA: string): SeancePayload | null {
  const series: SeancePayload["series"] = [];
  b.exercices.forEach((e, position) => {
    e.series
      .filter((s) => s.fait && s.faitA)
      .forEach((s, ordre) => {
        series.push({
          id: s.id,
          exerciceId: e.exerciceId,
          position,
          ordre,
          poids: s.poids,
          reps: s.reps,
          duree: s.duree,
          reposPris: s.reposPris,
          faitA: s.faitA!,
        });
      });
  });
  if (series.length === 0) return null;
  return { id: b.id, nom: b.nom, routineId: b.routineId, debutA: b.debutA, finA, series };
}

// --- Saisie et affichage --------------------------------------------------

/** « 82,5 » ou « 82.5 » → 82.5 ; vide ou invalide → null ; jamais négatif. */
export function lireNombre(texte: string): number | null {
  const nettoye = texte.trim().replace(",", ".");
  if (nettoye === "") return null;
  const valeur = Number(nettoye);
  return Number.isFinite(valeur) && valeur >= 0 ? valeur : null;
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

// --- Validation côté serveur ----------------------------------------------
// Une Server Action reçoit des données non fiables : tout est revérifié ici
// avant d'écrire en base (les contraintes SQL ne sont que le dernier filet).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_EXERCICE = /^[\w.\-()' ]{1,120}$/;
const NB_SERIES_MAX = 400;
const DUREE_SEANCE_MAX_MS = 24 * 3600 * 1000;

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function entierDans(valeur: unknown, min: number, max: number): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= min && valeur <= max;
}

function nullOuEntier(valeur: unknown, min: number, max: number): boolean {
  return valeur === null || entierDans(valeur, min, max);
}

function dateIso(valeur: unknown): valeur is string {
  return typeof valeur === "string" && !Number.isNaN(Date.parse(valeur));
}

function nomValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.trim().length >= 1 && valeur.trim().length <= 80;
}

/** `null` si l'envoi est valide, sinon le message à renvoyer à l'appelant. */
export function validerPayload(payload: unknown): string | null {
  if (!estObjet(payload)) return "Séance invalide.";
  const { id, nom, routineId, debutA, finA, series } = payload;
  if (typeof id !== "string" || !UUID.test(id)) return "Identifiant de séance invalide.";
  if (!nomValide(nom)) return "Le nom de la séance est invalide.";
  if (routineId !== null && (typeof routineId !== "string" || !UUID.test(routineId))) return "Routine invalide.";
  if (!dateIso(debutA) || !dateIso(finA)) return "Dates de séance invalides.";
  if (ms(finA) < ms(debutA) || ms(finA) - ms(debutA) > DUREE_SEANCE_MAX_MS) return "Durée de séance invalide.";
  if (!Array.isArray(series) || series.length < 1 || series.length > NB_SERIES_MAX) {
    return "La séance doit contenir entre 1 et 400 séries.";
  }

  const vus = new Set<string>();
  for (const serie of series) {
    if (!estObjet(serie)) return "Série invalide.";
    if (typeof serie.id !== "string" || !UUID.test(serie.id) || vus.has(serie.id)) return "Identifiant de série invalide.";
    vus.add(serie.id);
    if (typeof serie.exerciceId !== "string" || !ID_EXERCICE.test(serie.exerciceId)) return "Exercice invalide.";
    if (!entierDans(serie.position, 0, 99) || !entierDans(serie.ordre, 0, 99)) return "Rang de série invalide.";
    const { poids } = serie;
    if (poids !== null && (typeof poids !== "number" || !Number.isFinite(poids) || poids < 0 || poids > 1000)) {
      return "Poids invalide (0 à 1000 kg).";
    }
    if (!nullOuEntier(serie.reps, 0, 1000)) return "Répétitions invalides (0 à 1000).";
    if (!nullOuEntier(serie.duree, 0, 86400)) return "Durée invalide.";
    if (!nullOuEntier(serie.reposPris, 0, 7200)) return "Repos invalide.";
    if (!dateIso(serie.faitA)) return "Horodatage de série invalide.";
  }
  return null;
}

export type RoutineEntree = {
  id?: string;
  nom: string;
  exercices: { exerciceId: string; nbSeries: number; repsCible: number | null; reposS: number }[];
};

export function validerRoutine(routine: unknown): string | null {
  if (!estObjet(routine)) return "Routine invalide.";
  const { id, nom, exercices } = routine;
  if (id !== undefined && (typeof id !== "string" || !UUID.test(id))) return "Identifiant de routine invalide.";
  if (!nomValide(nom)) return "Le nom de la routine est requis (80 caractères maximum).";
  if (!Array.isArray(exercices) || exercices.length < 1 || exercices.length > 40) {
    return "Une routine contient entre 1 et 40 exercices.";
  }
  for (const exercice of exercices) {
    if (!estObjet(exercice)) return "Exercice invalide.";
    if (typeof exercice.exerciceId !== "string" || !ID_EXERCICE.test(exercice.exerciceId)) return "Exercice invalide.";
    if (!entierDans(exercice.nbSeries, 1, 20)) return "Le nombre de séries doit être compris entre 1 et 20.";
    if (!nullOuEntier(exercice.repsCible, 1, 200)) return "Les répétitions visées doivent être comprises entre 1 et 200.";
    if (!entierDans(exercice.reposS, 0, 1800)) return "Le repos doit être compris entre 0 et 30 minutes.";
  }
  return null;
}
