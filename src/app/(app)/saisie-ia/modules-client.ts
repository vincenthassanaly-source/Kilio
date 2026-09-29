import type { TypeElement } from "@/lib/saisie-ia/types";
import type { ElementDe, ModuleIAClient } from "./module-client";
import { moduleCoursesClient } from "./module-courses";
import { moduleNotesClient } from "./module-notes";
import { moduleTachesClient } from "./module-taches";

// Modules branchés sur « Ajouter avec l'IA » côté client, dans l'ordre du
// sélecteur de type. Le type `Record` force à déclarer une facette pour chaque
// type d'élément du moteur.
export const MODULES_CLIENT: { [K in TypeElement]: ModuleIAClient<ElementDe<K>> } = {
  tache: moduleTachesClient,
  course: moduleCoursesClient,
  note: moduleNotesClient,
};

/**
 * Module d'un élément. Le registre est typé par type d'élément (chaque facette
 * ne reçoit que le sien) ; la barre, elle, manipule des éléments de tous les
 * types : ce point d'accès unique porte la seule correspondance non vérifiée
 * par le compilateur (l'élément et son module ont le même `type`).
 */
export function moduleClient(type: TypeElement): ModuleIAClient {
  return MODULES_CLIENT[type] as unknown as ModuleIAClient;
}

export const TYPES_ELEMENT = Object.keys(MODULES_CLIENT) as TypeElement[];

/** Module du repli sans IA (« Créer … avec ce texte »). */
export const MODULE_PAR_DEFAUT: ModuleIAClient = moduleClient("tache");

// Un seul module branché : ses textes. Plusieurs : des textes neutres.
export const TEXTES_SAISIE =
  TYPES_ELEMENT.length === 1
    ? moduleClient(TYPES_ELEMENT[0]).saisie
    : {
        invite: "Décris ce que tu veux ajouter",
        label: "Décris ce que tu veux ajouter",
        placeholder: "Ex. : dentiste jeudi 14h, lait et œufs, idée de cadeau",
      };
