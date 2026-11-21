// Journal de diagnostic de la fin de repos : sert à savoir, sur l'appareil, ce qui a
// sonné ou non (bips de la page, notification push). Deux sources, deux stockages :
// la page écrit dans localStorage, le service worker (qui n'y a pas accès) dans le
// Cache `kilio-diag`. Les deux restent lisibles depuis la page.

const CLE_PAGE = "kilio-diag-repos";
const CACHE_PUSH = "kilio-diag";
const URL_PUSH = "/diag-repos.json";
const MAX_ENTREES = 20;

export type EtatAudio = AudioContextState | "interrupted" | "absent";

export type DiagnosticPage = {
  source: "page";
  a: string;
  audioAvant: EtatAudio;
  audioApres: EtatAudio;
  bips: boolean;
  vibration: boolean;
  visible: boolean;
};

export type DiagnosticPush = {
  source: "push";
  a: string;
  affichee: boolean;
  appVisible: boolean;
};

export type DiagnosticRepos = DiagnosticPage | DiagnosticPush;

export function ecrireDiagnosticRepos(entree: Omit<DiagnosticPage, "source" | "a">): void {
  try {
    const journal = [...lireDiagnosticRepos(), { source: "page" as const, a: new Date().toISOString(), ...entree }];
    window.localStorage.setItem(CLE_PAGE, JSON.stringify(journal.slice(-MAX_ENTREES)));
  } catch {
    // Pas de stockage (navigation privée, quota) : le diagnostic est facultatif.
  }
}

export function lireDiagnosticRepos(): DiagnosticPage[] {
  try {
    const brut = window.localStorage.getItem(CLE_PAGE);
    const valeur: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(valeur) ? (valeur as DiagnosticPage[]) : [];
  } catch {
    return [];
  }
}

/** Entrées écrites par le service worker (public/sw.js, `journaliserRepos`). */
export async function lireDiagnosticPush(): Promise<DiagnosticPush[]> {
  try {
    if (typeof caches === "undefined") return [];
    const cache = await caches.open(CACHE_PUSH);
    const reponse = await cache.match(URL_PUSH);
    const valeur: unknown = reponse ? await reponse.json() : [];
    return Array.isArray(valeur) ? (valeur as DiagnosticPush[]) : [];
  } catch {
    return [];
  }
}

/** Les deux journaux fusionnés, du plus récent au plus ancien. */
export async function lireDiagnosticComplet(): Promise<DiagnosticRepos[]> {
  const push = await lireDiagnosticPush();
  return [...lireDiagnosticRepos(), ...push].sort((x, y) => y.a.localeCompare(x.a));
}
