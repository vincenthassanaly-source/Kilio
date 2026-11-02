// Cache court en mémoire pour les propositions de Gemini (assistant des notes,
// de la Revue…) : même demande, mêmes données → on réutilise la réponse au lieu
// de rappeler Gemini. Un cache par processus serveur : au pire il est vide après
// un redémarrage ou sur une autre instance, et l'on rappelle simplement Gemini.
import { createHash } from "node:crypto";

export type CacheCourt<T> = {
  lire: (cle: string) => T | null;
  ecrire: (cle: string, valeur: T) => void;
};

export function creerCacheCourt<T>(dureeMs: number, tailleMax: number): CacheCourt<T> {
  const entrees = new Map<string, { expire: number; valeur: T }>();
  return {
    lire(cle) {
      const entree = entrees.get(cle);
      if (!entree) return null;
      if (entree.expire < Date.now()) {
        entrees.delete(cle);
        return null;
      }
      return entree.valeur;
    },
    ecrire(cle, valeur) {
      if (entrees.size >= tailleMax) {
        const plusAncienne = entrees.keys().next().value;
        if (plusAncienne !== undefined) entrees.delete(plusAncienne);
      }
      entrees.set(cle, { expire: Date.now() + dureeMs, valeur });
    },
  };
}

/** Clé de cache : empreinte stable de plusieurs morceaux de texte. */
export function empreinte(...parties: string[]): string {
  return createHash("sha256").update(parties.join("\u0000")).digest("hex");
}
