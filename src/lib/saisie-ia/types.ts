import type { TacheACreer, TachePropose } from "@/lib/taches/saisie-naturelle";

// Saisie « Ajouter avec l'IA » multi-modules : types partagés entre le client
// (aperçu) et le serveur (analyse, création). Chaque module branché sur la
// barre ajoute ici une variante à `ElementPropose` et à `ElementACreer` ; le
// reste du moteur est générique.

export const MAX_QUESTIONS = 2;
export const MAX_TEXTE = 500;
/** Éléments proposés au plus par saisie, tous modules confondus. */
export const MAX_ELEMENTS = 8;

export type PrecisionDonnee = { question: string; reponse: string };

// Ce que l'aperçu affiche : la proposition revalidée, avec ses libellés
// d'affichage et ses avertissements.
export type ElementPropose = { type: "tache"; donnees: TachePropose };

// Ce qui est renvoyé au serveur à la validation : seulement les champs lus à
// la création, tous revalidés côté serveur.
export type ElementACreer = { type: "tache"; donnees: TacheACreer };

export type TypeElement = ElementPropose["type"];

export type ResultatInterpretation =
  | { statut: "elements"; elements: ElementPropose[] }
  | { statut: "question"; question: string; choix: string[] }
  | { statut: "vide" };

// Issue de la création d'un élément, telle que la rend un module ; l'action
// serveur y ajoute `index` (position dans la requête).
export type IssueCreation =
  | { ok: true; id: string; avertissement?: string }
  | { ok: false; message: string };

export type ResultatCreation = IssueCreation & { index: number };
