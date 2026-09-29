// Politique de décision de `flushQueue` (src/lib/offline/queue.ts), extraite
// en fonctions pures pour rester testable sans Dexie ni Server Actions — voir
// reports/2026-09-19-audit-module-courses.md (constats #13, #14, #15) pour le
// diagnostic complet. `flushQueue` se contente d'appliquer ces décisions.

import { estIdTemporaire } from "@/lib/courses/compute";

export type ActionEnAttente = {
  module: string;
  action_name: string;
  payload: unknown[];
  tentatives?: number;
};

/** Nombre d'échecs non réseau consécutifs avant qu'une action ne soit
 * abandonnée (retirée de la file) plutôt que retentée indéfiniment.
 * En dessous, on préfère arrêter le flush (préserver l'ordre de rejeu)
 * plutôt que de perdre une action qui pourrait n'être qu'un incident
 * serveur passager — le message d'une Server Action est masqué en
 * production (voir node_modules/next/dist/docs/.../error.md, "Errors
 * forwarded from Server Components show a generic message with an
 * identifier"), donc son texte ne permet pas de distinguer une erreur
 * permanente d'un incident transitoire. */
const SEUIL_ABANDON_TENTATIVES = 3;

export type DecisionAvantExecution = { type: "purger_immediat" } | { type: "executer" };

/** Une action `courses` ciblant un id `temp-...` (article créé hors ligne,
 * jamais confirmé par le serveur) ne peut jamais réussir : `courses_items.id`
 * est une colonne `uuid`, `.eq("id", "temp-...")` échoue systématiquement
 * (`22P02: invalid input syntax for type uuid`, vérifié en base). Court-
 * circuite l'appel réseau pour purger l'action tout de suite plutôt que
 * d'attendre `SEUIL_ABANDON_TENTATIVES` tentatives inutiles — c'est ce qui
 * débloque dès le premier flush une file déjà coincée par ce scénario.
 * `updateCourseItem` (renommage, lot B) est concerné au même titre que
 * `toggleCourseItem`/`deleteCourseItem` : son premier argument est aussi un
 * id ciblé par `.eq("id", ...)` — en pratique ce cas ne devrait jamais se
 * produire (le renommage est bloqué côté UI et sa `mutationFn` tant que
 * l'article reste `temp-`, voir CourseItemRow), cette purge n'est qu'une
 * défense en profondeur supplémentaire côté file. */
export function decisionAvantExecution(action: ActionEnAttente): DecisionAvantExecution {
  const ciblesTemporaireCourses = action.module === "courses"
    && (action.action_name === "toggleCourseItem"
      || action.action_name === "deleteCourseItem"
      || action.action_name === "updateCourseItem")
    && estIdTemporaire(action.payload[0]);

  return ciblesTemporaireCourses ? { type: "purger_immediat" } : { type: "executer" };
}

export type DecisionApresEchec =
  | { type: "reessayer_plus_tard"; tentatives: number }
  | { type: "abandonner_et_continuer" };

/** Décide quoi faire après l'échec d'exécution d'une action déjà envoyée au
 * serveur. Une erreur réseau garde le comportement existant (on s'arrête,
 * on retentera au prochain flush, sans incrémenter le compteur : ce n'est
 * pas un échec de l'action elle-même). Une erreur non réseau incrémente le
 * compteur ; en dessous du seuil on s'arrête aussi (ordre de rejeu
 * préservé), au seuil on abandonne l'action et on continue avec les
 * suivantes de la même file. */
export function decisionApresEchec(action: ActionEnAttente, estErreurReseau: boolean): DecisionApresEchec {
  if (estErreurReseau) {
    return { type: "reessayer_plus_tard", tentatives: action.tentatives ?? 0 };
  }

  const tentatives = (action.tentatives ?? 0) + 1;
  if (tentatives >= SEUIL_ABANDON_TENTATIVES) {
    return { type: "abandonner_et_continuer" };
  }
  return { type: "reessayer_plus_tard", tentatives };
}

/** Actions qui posent un état absolu sur une cible (premier argument) : seule
 * la dernière intention de l'utilisateur compte. Les garder toutes en file les
 * rejouerait dans l'ordre, ce qui n'est pas neutre pour une tâche récurrente
 * (cocher avance l'échéance) : coche puis décoche hors ligne devait laisser la
 * tâche intacte, pas avancée d'une occurrence. */
const ACTIONS_ETAT_ABSOLU = new Set(["taches.setTacheFait"]);

/** Ids des actions déjà en file rendues caduques par `nouvelle` (même action,
 * même cible) : à retirer avant d'ajouter `nouvelle`. */
export function idsActionsRemplacees(
  enAttente: readonly (ActionEnAttente & { id?: number })[],
  nouvelle: Pick<ActionEnAttente, "module" | "action_name" | "payload">
): number[] {
  if (!ACTIONS_ETAT_ABSOLU.has(`${nouvelle.module}.${nouvelle.action_name}`)) return [];
  return enAttente
    .filter(
      (a) =>
        a.id !== undefined &&
        a.module === nouvelle.module &&
        a.action_name === nouvelle.action_name &&
        a.payload[0] === nouvelle.payload[0]
    )
    .map((a) => a.id as number);
}
