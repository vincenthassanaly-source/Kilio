import type { ComponentType } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { ActionResult } from "@/lib/actions/result";
import type { ElementACreer, ElementPropose, TypeElement } from "@/lib/saisie-ia/types";

// Facette client d'un module branché sur « Ajouter avec l'IA » : comment
// afficher ses propositions dans l'aperçu, comment les corriger (formulaire
// manuel du module, pré-rempli) et comment le dire à l'utilisateur. La barre
// (SaisieIABarre) ne connaît que cette forme.

export type EditionFormulaire = {
  /** Proposition à corriger ; null pour la création simple depuis le texte brut. */
  element: ElementPropose | null;
  /** Titre à pré-remplir quand il n'y a pas de proposition. */
  titre: string;
};

export type LibellesModule = {
  /** Aperçu d'une seule proposition de ce module. */
  verifier: string;
  aValider: (n: number) => string;
  creer: (n: number) => string;
  aucuneRetenue: string;
  creee: (n: number) => string;
  /** Repli sans IA : ouvre le formulaire manuel avec le texte saisi. */
  creationSimple: string;
  titreFormulaire: string;
};

/** L'élément proposé d'un type donné. */
export type ElementDe<T extends TypeElement> = Extract<ElementPropose, { type: T }>;

export type ModuleIAClient<E extends ElementPropose = ElementPropose> = {
  type: E["type"];
  libelles: LibellesModule;
  /** Nom du type dans le sélecteur de chaque ligne (« Tâche », « Course »…). */
  nomType: string;
  /**
   * Convertit une proposition d'un autre type en proposition de ce type, à
   * partir de son seul titre (sélecteur de type d'une ligne de l'aperçu).
   */
  depuisTitre: (titre: string) => E;
  /** Textes de la saisie quand ce module est seul branché. */
  saisie: { invite: string; label: string; placeholder: string };
  titre: (element: E) => string;
  /**
   * La ligne est-elle cochée au départ ? Faux pour une proposition
   * incomplète (rien n'est créé tant que l'utilisateur ne l'a pas précisée) ;
   * vrai par défaut.
   */
  retenueParDefaut?: (element: E) => boolean;
  /** Ce que le serveur reçoit à la validation. */
  versCreation: (element: E) => ElementACreer;
  /** Détails d'une ligne de l'aperçu (moment, pastilles, avertissements). */
  Detail: ComponentType<{ element: E }>;
  /**
   * Rend la proposition éditable dans le formulaire manuel quand elle
   * dépend d'une ressource encore à créer (ex. une nouvelle liste).
   */
  preparerEdition?: (element: E) => Promise<ActionResult<E>>;
  precharger?: () => void;
  Formulaire: ComponentType<{ edition: EditionFormulaire; onDone: (avertissement?: string) => void }>;
  /** Rafraîchit les données du module après création. */
  invalider: (queryClient: QueryClient) => void;
};
