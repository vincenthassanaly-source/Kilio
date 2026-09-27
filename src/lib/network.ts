// Une erreur réseau (offline réel, ou fetch qui échoue avant même d'atteindre
// le serveur) se distingue d'une erreur métier renvoyée par le serveur (ex.
// validation) : la première déclenche une mise en file/un message hors ligne,
// la seconde doit continuer à s'afficher normalement. Utilisé à la fois par
// la file offline (`lib/offline/queue.ts`) et par le wrapper de Server Action
// (`lib/actions/runAction.ts`) — une seule définition pour éviter la dérive.
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof Error) {
    return /failed to fetch|fetch failed|networkerror|load failed/i.test(error.message);
  }
  return false;
}
