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

export type ModuleIAClient = {
  type: TypeElement;
  libelles: LibellesModule;
  /** Textes de la saisie quand ce module est seul branché. */
  saisie: { invite: string; label: string; placeholder: string };
  titre: (element: ElementPropose) => string;
  /** Ce que le serveur reçoit à la validation. */
  versCreation: (element: ElementPropose) => ElementACreer;
  /** Détails d'une ligne de l'aperçu (moment, pastilles, avertissements). */
  Detail: ComponentType<{ element: ElementPropose }>;
  /**
   * Rend la proposition éditable dans le formulaire manuel quand elle
   * dépend d'une ressource encore à créer (ex. une nouvelle liste).
   */
  preparerEdition?: (element: ElementPropose) => Promise<ActionResult<ElementPropose>>;
  precharger?: () => void;
  Formulaire: ComponentType<{ edition: EditionFormulaire; onDone: (avertissement?: string) => void }>;
  /** Rafraîchit les données du module après création. */
  invalider: (queryClient: QueryClient) => void;
};
