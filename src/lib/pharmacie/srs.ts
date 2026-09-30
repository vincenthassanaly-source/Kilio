// Répétition espacée des cartes Pharmacie : SM-2 simplifié, 4 notes.
// Module neutre (ni "use server" ni "use client") : appelé par la Server
// Action `noterCarte` et par l'écran de révision (état optimistes).

export const NOTES_REVISION = ["a-revoir", "difficile", "bien", "facile"] as const;
export type NoteRevision = (typeof NOTES_REVISION)[number];

export function estNoteRevision(valeur: unknown): valeur is NoteRevision {
  return typeof valeur === "string" && (NOTES_REVISION as readonly string[]).includes(valeur);
}

export type EtatCarte = {
  echeance: string;
  intervalle_jours: number;
  facilite: number;
  repetitions: number;
  dernier_passage: string | null;
};

const FACILITE_MIN = 1.3;
const FACILITE_MAX = 3;
// Une carte « À revoir » revient dans la même séance, pas le lendemain.
const DELAI_A_REVOIR_MS = 10 * 60 * 1000;
const JOUR_MS = 24 * 60 * 60 * 1000;
// Au-delà de cet intervalle (jours), une carte compte comme acquise dans la
// barre de maîtrise d'une matière.
export const SEUIL_ACQUISE_JOURS = 7;

function arrondiFacilite(valeur: number): number {
  return Math.round(Math.min(FACILITE_MAX, Math.max(FACILITE_MIN, valeur)) * 100) / 100;
}

export function estAcquise(carte: Pick<EtatCarte, "intervalle_jours">): boolean {
  return carte.intervalle_jours >= SEUIL_ACQUISE_JOURS;
}

export function prochainEtatCarte(
  etat: Pick<EtatCarte, "intervalle_jours" | "facilite" | "repetitions">,
  note: NoteRevision,
  maintenant: Date
): EtatCarte {
  const dernier_passage = maintenant.toISOString();

  if (note === "a-revoir") {
    return {
      echeance: new Date(maintenant.getTime() + DELAI_A_REVOIR_MS).toISOString(),
      intervalle_jours: 0,
      facilite: arrondiFacilite(etat.facilite - 0.2),
      repetitions: 0,
      dernier_passage,
    };
  }

  let intervalle: number;
  let facilite = etat.facilite;

  if (note === "difficile") {
    facilite -= 0.15;
    intervalle = etat.repetitions === 0 ? 1 : Math.max(1, Math.round(etat.intervalle_jours * 1.2));
  } else if (note === "bien") {
    if (etat.repetitions === 0) intervalle = 1;
    else if (etat.repetitions === 1) intervalle = 3;
    else intervalle = Math.max(1, Math.round(etat.intervalle_jours * etat.facilite));
  } else {
    facilite += 0.15;
    if (etat.repetitions === 0) intervalle = 3;
    else if (etat.repetitions === 1) intervalle = 6;
    else intervalle = Math.max(1, Math.round(etat.intervalle_jours * etat.facilite * 1.3));
  }

  return {
    echeance: new Date(maintenant.getTime() + intervalle * JOUR_MS).toISOString(),
    intervalle_jours: intervalle,
    facilite: arrondiFacilite(facilite),
    repetitions: etat.repetitions + 1,
    dernier_passage,
  };
}
