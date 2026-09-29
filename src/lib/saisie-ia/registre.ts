import { moduleCourses } from "@/lib/courses/saisie-module";
import { moduleNotes } from "@/lib/notes/saisie-module";
import { moduleTaches } from "@/lib/taches/saisie-module";
import type { ModuleIAServeur } from "./module";

// Modules branchés sur « Ajouter avec l'IA » côté serveur. Brancher un module :
// écrire sa facette (`ModuleIAServeur`), l'ajouter ici, puis sa facette client
// (app/(app)/saisie-ia/modules-client.tsx).
export const MODULES_SERVEUR: readonly ModuleIAServeur[] = [moduleTaches, moduleCourses, moduleNotes];
