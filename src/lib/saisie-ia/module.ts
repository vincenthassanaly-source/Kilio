import type { ElementACreer, ElementPropose, IssueCreation, TypeElement } from "./types";

// Facette serveur d'un module branché sur « Ajouter avec l'IA ». Un module
// déclare son schéma, ses règles de prompt, sa revalidation et sa création ;
// le moteur (moteur.ts) et l'action serveur ne connaissent que cette forme.

export type ModulePrepare = {
  /** Lignes de contexte propres au module (listes existantes, aliments…). */
  lignesContexte: string[];
  /** Revalide les entrées brutes de Gemini ; écarte celles qui sont inexploitables. */
  interpreter(bruts: Record<string, unknown>[]): ElementPropose[];
};

export type ModuleIAServeur = {
  type: TypeElement;
  /** Clé du tableau de ce module dans la réponse JSON de Gemini. */
  cle: string;
  /** Pluriel, pour la phrase d'introduction du prompt (« tâches »). */
  libelle: string;
  /** Entrées lues au plus dans le tableau du module (avant filtrage). */
  max: number;
  /** Schéma d'une entrée : tout est obligatoire, jamais de `nullable`. */
  schemaElement: Record<string, unknown>;
  /** Règles de prompt propres au module. */
  regles: readonly string[];
  /** Cas où une question de précision est permise (numérotés par le moteur). */
  casQuestion: readonly string[];
  /**
   * Charge le contexte du module (lectures en base) puis rend le module prêt à
   * interpréter. `texte` : ce que Vincent a écrit (phrase + réponses aux
   * précisions), pour les modules qui n'acceptent que ce qu'il a nommé.
   */
  preparer(aujourdhui: string, texte: string): Promise<ModulePrepare>;
  /** Crée les éléments validés, dans l'ordre reçu ; un résultat par élément. */
  creer(elements: ElementACreer[]): Promise<IssueCreation[]>;
};
