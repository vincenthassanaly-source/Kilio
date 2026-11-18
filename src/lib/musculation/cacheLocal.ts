"use client";

import { getExercices, getRoutine, getRoutines } from "@/app/actions/musculation";
import { urlPoster, urlVideo, type CleAnimation } from "./animations";

// Copie locale (Dexie, table `cache_lecture`) du catalogue d'exercices et des
// routines : en salle, le réseau est mauvais ou absent, et démarrer une routine
// ou choisir un exercice ne doit pas dépendre de lui. Le réseau reste la
// source de vérité : la copie ne sert que si le réseau échoue ou tarde trop.
// Toute erreur de stockage est avalée, la copie n'est qu'un repli de confort.

const PREFIXE = "musculation:";
/** Au-delà, on sert la copie locale sans attendre davantage le réseau. */
const DELAI_RESEAU_MS = 4_000;

async function base() {
  return (await import("@/lib/offline/db")).db;
}

async function lireCache<T>(cle: string): Promise<{ valeur: T } | null> {
  try {
    const ligne = await (await base()).cache_lecture.get(PREFIXE + cle);
    return ligne ? { valeur: ligne.valeur as T } : null;
  } catch {
    return null;
  }
}

async function ecrireCache(cle: string, valeur: unknown): Promise<void> {
  try {
    await (await base()).cache_lecture.put({ cle: PREFIXE + cle, valeur, enregistre_le: new Date().toISOString() });
  } catch {
    // Stockage indisponible : la copie locale est facultative.
  }
}

/**
 * Charge depuis le réseau et garde une copie locale. Si le réseau échoue ou
 * dépasse `delaiMs` et qu'une copie existe, elle est servie ; sans copie,
 * l'erreur réseau remonte comme avant.
 */
export async function avecCacheLocal<T>(
  cle: string,
  chargeur: () => Promise<T>,
  delaiMs = DELAI_RESEAU_MS,
): Promise<T> {
  const enCache = await lireCache<T>(cle);
  const reseau = chargeur().then(async (valeur) => {
    // `null` (introuvable) n'est pas une donnée à garder.
    if (valeur !== null && valeur !== undefined) await ecrireCache(cle, valeur);
    return valeur;
  });
  if (!enCache) return reseau;
  // Le réseau continue en tâche de fond : sa réponse met la copie à jour.
  reseau.catch(() => {});
  return Promise.race([
    reseau.catch(() => enCache.valeur),
    new Promise<T>((resolve) => setTimeout(() => resolve(enCache.valeur), delaiMs)),
  ]);
}

export function exercicesAvecCache() {
  return avecCacheLocal("exercices", getExercices);
}

export function routineAvecCache(id: string) {
  return avecCacheLocal(`routine:${id}`, () => getRoutine(id));
}

// --- Routines : liste, détail de chacune et animations ----------------------

const NB_ROUTINES_PRECHARGEES_MAX = 20;
const INTERVALLE_PRECHARGEMENT_MS = 10 * 60_000;
let dernierPrechargement = 0;

function connexionEconome(): boolean {
  const connexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connexion?.saveData === true;
}

/** Met en cache les animations (via le service worker, qui les garde) avec peu de requêtes à la fois. */
async function prechaufferAnimations(cles: CleAnimation[]): Promise<void> {
  const urls = [...new Set(cles)].flatMap((cle) => [urlPoster(cle), urlVideo(cle)]);
  const aFaire = [...urls];
  const travailleur = async () => {
    for (let url = aFaire.shift(); url; url = aFaire.shift()) {
      try {
        await fetch(url);
      } catch {
        return; // réseau perdu : inutile d'insister
      }
    }
  };
  await Promise.all([travailleur(), travailleur()]);
}

/**
 * Garde en local le détail de chaque routine et les animations de leurs
 * exercices, pour démarrer une séance hors ligne. Discret : une fois par
 * quelques minutes, jamais en mode économie de données.
 */
async function prechargerRoutines(ids: string[]): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.onLine || connexionEconome()) return;
  if (Date.now() - dernierPrechargement < INTERVALLE_PRECHARGEMENT_MS) return;
  dernierPrechargement = Date.now();
  const cles: CleAnimation[] = [];
  for (const id of ids.slice(0, NB_ROUTINES_PRECHARGEES_MAX)) {
    try {
      const routine = await getRoutine(id);
      if (!routine) continue;
      await ecrireCache(`routine:${id}`, routine);
      for (const exercice of routine.exercices) if (exercice.animation) cles.push(exercice.animation);
    } catch {
      return;
    }
  }
  await prechaufferAnimations(cles);
}

export async function routinesAvecCache() {
  const data = await avecCacheLocal("routines", getRoutines);
  void prechargerRoutines(data.routines.map((r) => r.id));
  return data;
}
