// Liens du Journal, partagés avec les composants client (JournalSwipeWrapper,
// JournalNavigationJour). Ce module ne doit importer aucune API serveur :
// `jour.ts` importe `next/server`, qui serait sinon embarqué en entier dans
// le JS du Journal (voir src/app/frontiere-client-serveur.test.ts).

/** Query d'un jour du Journal ; `from=bilan` fait revenir le retour au Bilan (voir `retourHistoriqueAutorise`). */
export const hrefJourJournal = (date: string, depuisBilan: boolean) =>
  `/nutrition/journal?date=${date}${depuisBilan ? "&from=bilan" : ""}`;
