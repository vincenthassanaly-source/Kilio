import type { TypeElement } from "@/lib/saisie-ia/types";
import type { ModuleIAClient } from "./module-client";
import { moduleTachesClient } from "./module-taches";

// Modules branchés sur « Ajouter avec l'IA » côté client. Le type `Record`
// force à déclarer une facette pour chaque type d'élément du moteur.
export const MODULES_CLIENT: Record<TypeElement, ModuleIAClient> = {
  tache: moduleTachesClient,
};

/** Module du repli sans IA (« Créer … avec ce texte »). */
export const MODULE_PAR_DEFAUT: ModuleIAClient = moduleTachesClient;

const modules = Object.values(MODULES_CLIENT);

// Un seul module branché : ses textes. Plusieurs : des textes neutres.
export const TEXTES_SAISIE =
  modules.length === 1
    ? modules[0].saisie
    : {
        invite: "Décris ce que tu veux ajouter",
        label: "Décris ce que tu veux ajouter",
        placeholder: "Ex. : dentiste jeudi 14h, lait et œufs",
      };
