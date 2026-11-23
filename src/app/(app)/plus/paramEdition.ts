/** Paramètre d'URL qui ouvre Plus directement en mode édition (lien de Réglages). */
export const PARAM_EDITION = "edition";

/** Lien « Personnaliser la navigation » : Plus, déjà en mode édition. */
export const HREF_PLUS_EDITION = `/plus?${PARAM_EDITION}=1`;

/**
 * Lit puis retire `?edition=1` de l'URL courante : vrai si Plus doit s'ouvrir
 * en mode édition. Le paramètre est effacé (replaceState, sans navigation)
 * pour qu'un rechargement ou un retour sur /plus ne relance pas le mode
 * édition sans appui long.
 */
export function consommerParamEdition(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get(PARAM_EDITION) !== "1") return false;
  url.searchParams.delete(PARAM_EDITION);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}
