// Dernière vue choisie dans l'Agenda (Jour, Semaine, Mois, Liste), gardée dans
// le navigateur : une préférence par appareil, jamais en base. Le stockage peut
// manquer ou lever (navigation privée, données bloquées) : tout est silencieux.

export const CLE_VUE_AGENDA = "kilio-agenda-vue";

/** La vue mémorisée, si elle fait partie des vues valides ; sinon `null`. */
export function lireVueMemorisee<T extends string>(valides: readonly T[]): T | null {
  try {
    const valeur = window.localStorage.getItem(CLE_VUE_AGENDA);
    return valides.find((v) => v === valeur) ?? null;
  } catch {
    return null;
  }
}

/** Abonnement pour `useSyncExternalStore` : la vue peut changer depuis un autre onglet. */
export function abonnerVueMemorisee(surChangement: () => void): () => void {
  window.addEventListener("storage", surChangement);
  return () => window.removeEventListener("storage", surChangement);
}

export function memoriserVue(vue: string): void {
  try {
    window.localStorage.setItem(CLE_VUE_AGENDA, vue);
  } catch {
    // Pas de stockage : l'agenda s'ouvre simplement sur la vue Jour.
  }
}
