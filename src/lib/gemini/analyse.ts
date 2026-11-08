// Analyse Gemini d'un paquet d'éléments : pour chaque élément, une suggestion
// validée ou un échec classé (voir « Suggestion » dans GLOSSARY.md). Un seul
// endroit pour le timeout, le quota, le journal de durée, la borne de taille du
// paquet et l'isolation des échecs ; chaque feature ne fournit que ce qui lui
// est propre : la préparation d'un élément (lecture en base, image, prompt) et
// la lecture de la réponse.
//
// Le module n'écrit rien en base : la phase « appliquer » reste dans les
// actions. La boucle sur les paquets et la progression restent côté client.
//
// Discriminant `statut` et non `ok` : `runAction` prend toute réponse
// `{ ok: true, … }` pour son propre contrat `ActionResult`.

import { appelerGemini, MESSAGE_QUOTA_GEMINI, type AppelGemini, type ResultatGemini } from "@/lib/gemini/appel";

/** Un paquet entier doit tenir dans les 60 s de `maxDuration` des pages : téléchargement, puis Gemini. */
const TIMEOUT_DEFAUT_MS = 45_000;

export type EchecAnalyse = { statut: "echec"; erreur: string; quota: boolean };
export type ResultatAnalyse<S> = { statut: "ok"; suggestion: S } | EchecAnalyse;

/**
 * Ce que la feature prépare pour un élément. `refus` = échec métier sans appel
 * Gemini (« Élément introuvable. »). `contexte` est repassé tel quel à `lire`.
 */
type Preparation<C> =
  | { prompt: string; images?: AppelGemini["images"]; contexte: C }
  | { refus: string };

export type Analyse<E, C, S> = {
  /** Préfixe des journaux serveur, ex. `titrage-collection`. */
  etiquette: string;
  schema: unknown;
  /** Phrase d'échec : « Gemini n'a pas pu <verbe> (<détail>) », ex. `lire cet élément`. */
  verbe: string;
  /** Au-delà, tout le paquet est refusé sans rien lire ni appeler. */
  tailleMax: number;
  timeoutMs?: number;
  temperature?: number;
  /** Lecture en base, téléchargement d'image, prompt : propre à la feature. */
  preparer: (element: E) => Promise<Preparation<C>> | Preparation<C>;
  /** Valide la réponse brute. Lever = réponse illisible. */
  lire: (brut: unknown, contexte: C) => S;
};

/** Seam de test : l'appel Gemini, `appelerGemini` en production. */
export type DepsAnalyse = { gemini?: (appel: AppelGemini) => Promise<ResultatGemini> };

function echec(erreur: string, quota = false): EchecAnalyse {
  return { statut: "echec", erreur, quota };
}

async function analyserUn<E, C, S>(
  analyse: Analyse<E, C, S>,
  element: E,
  gemini: (appel: AppelGemini) => Promise<ResultatGemini>
): Promise<ResultatAnalyse<S>> {
  const debut = Date.now();
  const preparation = await analyse.preparer(element);
  if ("refus" in preparation) return echec(preparation.refus);

  const debutGemini = Date.now();
  const resultat = await gemini({
    prompt: preparation.prompt,
    images: preparation.images,
    schema: analyse.schema,
    timeoutMs: analyse.timeoutMs ?? TIMEOUT_DEFAUT_MS,
    temperature: analyse.temperature,
    etiquette: analyse.etiquette,
  });
  // Durées en journal : de quoi savoir, si c'est lent, si c'est la préparation ou Gemini.
  console.info(
    `[${analyse.etiquette}] préparation=${debutGemini - debut}ms gemini=${Date.now() - debutGemini}ms ${resultat.ok ? "ok" : resultat.code}`
  );
  if (!resultat.ok) {
    return resultat.code === "quota"
      ? echec(MESSAGE_QUOTA_GEMINI, true)
      : echec(`Gemini n'a pas pu ${analyse.verbe} (${resultat.detail})`);
  }

  try {
    return { statut: "ok", suggestion: analyse.lire(resultat.brut, preparation.contexte) };
  } catch {
    return echec(`Gemini n'a pas pu ${analyse.verbe} (réponse illisible)`);
  }
}

/**
 * Analyse un paquet d'éléments en parallèle : un résultat par élément, dans le
 * même ordre. Chaque élément échoue seul, sans entraîner les autres. Ne lève
 * jamais, même si `preparer` ou `lire` lèvent.
 */
export async function analyserPaquet<E, C, S>(
  analyse: Analyse<E, C, S>,
  elements: readonly E[],
  deps: DepsAnalyse = {}
): Promise<ResultatAnalyse<S>[]> {
  if (elements.length > analyse.tailleMax) return elements.map(() => echec("Trop d'éléments d'un coup."));
  const gemini = deps.gemini ?? appelerGemini;
  return Promise.all(
    elements.map((element) =>
      analyserUn(analyse, element, gemini).catch(() => echec("L'analyse a échoué de façon inattendue."))
    )
  );
}
