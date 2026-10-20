// Historique annuler / rétablir de la feuille. Fonctions pures : chaque
// opération renvoie un nouvel état (ou le même objet si elle ne change rien),
// ce qui se range directement dans un useReducer / useState.
import type { Trait } from "./traits";

type Action =
  | { type: "ajout"; trait: Trait }
  // `retires` est trié par indice croissant : l'annulation réinsère dans cet ordre.
  | { type: "gomme"; retires: Array<{ indice: number; trait: Trait }> };

export type Historique = { traits: Trait[]; passe: Action[]; futur: Action[] };

/** Les traits de départ (déjà enregistrés) ne sont pas annulables. */
export function historiqueVide(traits: Trait[] = []): Historique {
  return { traits, passe: [], futur: [] };
}

export const peutAnnuler = (h: Historique) => h.passe.length > 0;
export const peutRetablir = (h: Historique) => h.futur.length > 0;

export function ajouter(h: Historique, trait: Trait): Historique {
  return { traits: [...h.traits, trait], passe: [...h.passe, { type: "ajout", trait }], futur: [] };
}

export function gommer(h: Historique, indices: number[]): Historique {
  const uniques = [...new Set(indices)].filter((i) => i >= 0 && i < h.traits.length).sort((a, b) => a - b);
  if (uniques.length === 0) return h;
  const retires = uniques.map((indice) => ({ indice, trait: h.traits[indice] }));
  const garde = new Set(uniques);
  return {
    traits: h.traits.filter((_, i) => !garde.has(i)),
    passe: [...h.passe, { type: "gomme", retires }],
    futur: [],
  };
}

function appliquer(traits: Trait[], action: Action): Trait[] {
  if (action.type === "ajout") return [...traits, action.trait];
  const retires = new Set(action.retires.map((r) => r.indice));
  return traits.filter((_, i) => !retires.has(i));
}

function inverser(traits: Trait[], action: Action): Trait[] {
  if (action.type === "ajout") return traits.slice(0, -1);
  const resultat = [...traits];
  for (const { indice, trait } of action.retires) resultat.splice(indice, 0, trait);
  return resultat;
}

export function annuler(h: Historique): Historique {
  const action = h.passe[h.passe.length - 1];
  if (!action) return h;
  return { traits: inverser(h.traits, action), passe: h.passe.slice(0, -1), futur: [...h.futur, action] };
}

export function retablir(h: Historique): Historique {
  const action = h.futur[h.futur.length - 1];
  if (!action) return h;
  return { traits: appliquer(h.traits, action), passe: [...h.passe, action], futur: h.futur.slice(0, -1) };
}
