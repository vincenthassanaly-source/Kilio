// État d'une séance de révision Pharmacie (file des cartes, cartes faites,
// bilan par note). Module neutre : l'écran de révision l'utilise pour avancer
// d'une carte et pour revenir en arrière (« Annuler » du toast).

import { NOTES_REVISION, type EtatCarte, type NoteRevision } from "./srs";

export type BilanRevision = Record<NoteRevision, number>;

export type EtatSeance = {
  /** Identifiants des cartes restantes, la carte affichée en tête. */
  file: string[];
  /** Cartes terminées (toute note sauf « À revoir »). */
  fait: number;
  bilan: BilanRevision;
};

export function bilanVide(): BilanRevision {
  return Object.fromEntries(NOTES_REVISION.map((n) => [n, 0])) as BilanRevision;
}

export function seanceInitiale(file: string[]): EtatSeance {
  return { file, fait: 0, bilan: bilanVide() };
}

/**
 * Note la carte en tête de file : « À revoir » la renvoie en fin de séance,
 * les autres notes la retirent. L'état reçu n'est pas modifié, ce qui permet
 * de le garder tel quel pour l'annulation.
 */
export function noterEnTete(etat: EtatSeance, note: NoteRevision): EtatSeance {
  if (etat.file.length === 0) return etat;
  const [tete, ...reste] = etat.file;
  return {
    file: note === "a-revoir" ? [...reste, tete] : reste,
    fait: note === "a-revoir" ? etat.fait : etat.fait + 1,
    bilan: { ...etat.bilan, [note]: etat.bilan[note] + 1 },
  };
}

/** Champs SM-2 d'une carte : ceux que la note modifie et que l'annulation restaure. */
export function etatSm2(carte: EtatCarte): EtatCarte {
  return {
    echeance: carte.echeance,
    intervalle_jours: carte.intervalle_jours,
    facilite: carte.facilite,
    repetitions: carte.repetitions,
    dernier_passage: carte.dernier_passage,
  };
}
