// Chargement d'OpenCV.js (WASM) à la demande, côté navigateur uniquement.
//
// Le fichier (~10 Mo) est copié dans public/vendor/ par scripts/copier-opencv.mjs
// et servi en cache-first par le service worker : il n'est téléchargé qu'à la
// première ouverture du scanner, puis marche hors ligne. Il n'entre jamais dans
// le bundle principal. En cas d'échec, l'appelant retombe sur l'ancien pipeline.

export type Cv = typeof import("@techstark/opencv-js");

const URL_OPENCV = "/vendor/opencv.js";
/** Au-delà, on considère le chargement perdu (réseau coupé, mémoire insuffisante). */
const DELAI_MAX_MS = 45_000;

/** Enveloppe obligatoire : le module OpenCV est « thenable » (il a une méthode `then`). Une promesse
 *  résolue directement avec lui rappelle `then` à l'infini et fige la page. On ne la passe donc jamais
 *  à resolve() ni à `return` dans une fonction async. */
export type CvChargee = { cv: Cv };

let chargement: Promise<CvChargee> | null = null;
let pret: CvChargee | null = null;
/** Vrai si le dernier chargement a échoué (hors ligne, script introuvable, délai dépassé). */
let echec = false;

/** Vrai si le dernier chargement d'OpenCV a échoué et qu'aucun autre n'est en cours. */
export function openCvEnEchec(): boolean {
  return echec;
}

/** OpenCV si déjà chargé, sinon null : permet un chemin synchrone (détection en direct). */
export function openCvSiPret(): Cv | null {
  return pret ? pret.cv : null;
}

/**
 * Injection du script, gardée en mémoire : après un délai dépassé, le téléchargement continue, et
 * une nouvelle tentative attend ce même script au lieu d'en injecter un second (double
 * téléchargement de 10 Mo, double initialisation du WASM). Oubliée seulement si le script échoue.
 */
let injection: Promise<void> | null = null;

function injecterScript(): Promise<void> {
  injection ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = URL_OPENCV;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      injection = null;
      reject(new Error("OpenCV.js introuvable"));
    };
    document.head.appendChild(script);
  });
  return injection;
}

/** Attend l'initialisation du WASM. Le module renvoyé est lui-même « thenable » :
 *  on ne le passe donc jamais à resolve() (boucle infinie), on l'enveloppe. */
function attendreInitialisation(): Promise<CvChargee> {
  return new Promise((resolve, reject) => {
    const brut = (window as unknown as { cv?: unknown }).cv as
      | (Partial<Cv> & { then?: (cb: (m: Cv) => void) => void; onRuntimeInitialized?: () => void })
      | undefined;
    if (!brut) return reject(new Error("OpenCV.js n'a pas défini `cv`"));
    if (brut.Mat) return resolve({ cv: brut as Cv });
    if (typeof brut.then === "function") {
      brut.then((module) => resolve({ cv: module }));
      return;
    }
    brut.onRuntimeInitialized = () => resolve({ cv: brut as Cv });
  });
}

/** Charge OpenCV une seule fois ; réessaie au prochain appel si le chargement échoue. */
export function chargerOpenCv(): Promise<CvChargee> {
  if (pret) return Promise.resolve(pret);
  if (chargement) return chargement;
  echec = false;
  chargement = (async () => {
    let minuteur = 0;
    const delai = new Promise<never>((_, reject) => {
      minuteur = window.setTimeout(() => reject(new Error("OpenCV.js : délai dépassé")), DELAI_MAX_MS);
    });
    try {
      const chargee = await Promise.race([
        (async () => {
          if (!(window as unknown as { cv?: unknown }).cv) await injecterScript();
          return attendreInitialisation();
        })(),
        delai,
      ]);
      pret = chargee;
      return chargee;
    } catch (e) {
      chargement = null;
      echec = true;
      throw e;
    } finally {
      window.clearTimeout(minuteur);
    }
  })();
  return chargement;
}
