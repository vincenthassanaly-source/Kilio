"use client";

import { decisionApresEchec, decisionAvantExecution, idsActionsRemplacees } from "./flush-policy";
import { showToast } from "@/components/toast/toast-store";
import { setTacheFait, deleteTache } from "@/app/actions/taches";
import { toggleNoteItem, deleteNote } from "@/app/actions/notes";
import {
  createCourseItem,
  toggleCourseItem,
  deleteCourseItem,
  updateCourseItem,
  deleteCourseItems,
  restoreCourseItems,
  ajouterArticlesCourses,
} from "@/app/actions/courses";
import { enregistrerEntreeHabitude, supprimerHabitude } from "@/app/actions/habitudes";
import { isNetworkError } from "@/lib/network";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionFn = (...args: any[]) => Promise<unknown>;

// Mapping module + nom d'action -> Server Action à rejouer. Limité aux
// écritures haute fréquence des 4 modules du scope (cf. 2.4 du prompt de
// session) : Budget et Recettes ne sont volontairement pas couverts.
const ACTIONS: Record<string, Record<string, ActionFn>> = {
  taches: { setTacheFait, deleteTache },
  notes: { toggleNoteItem, deleteNote },
  courses: {
    createCourseItem,
    toggleCourseItem,
    deleteCourseItem,
    updateCourseItem,
    deleteCourseItems,
    restoreCourseItems,
    ajouterArticlesCourses,
  },
  habitudes: { enregistrerEntreeHabitude, supprimerHabitude },
};

// Dexie (~100 Ko) est chargé à la demande : `db.ts` ne fait plus partie du JS
// initial des routes. `preloadOfflineDb` (appelé au démarrage, voir
// useOnlineSync.ts) le télécharge une fois en ligne, ce qui le place dans le
// cache du service worker pour qu'`enqueueAction` fonctionne ensuite hors
// ligne.
export async function preloadOfflineDb() {
  return (await import("./db")).db;
}

// Ré-exportée pour compat : tous les appelants existants importent
// `isNetworkError` depuis ce fichier (`@/lib/offline/queue`).
export { isNetworkError };

// Évènement émis à chaque mise en file : useOnlineSync planifie alors des
// rejeux à intervalles croissants (une erreur réseau peut survenir alors que le
// navigateur se croit en ligne, auquel cas aucun évènement `online` ne viendra).
export const EVENEMENT_FILE_AJOUT = "kilio:offline-enqueued";

export async function enqueueAction(module: string, actionName: string, payload: unknown[]) {
  const db = await preloadOfflineDb();
  const nouvelle = { module, action_name: actionName, payload };
  // Un état absolu posé deux fois sur la même cible (coche puis décoche) ne
  // garde que la dernière intention : voir `idsActionsRemplacees`.
  await db.transaction("rw", db.pending_actions, async () => {
    const remplacees = idsActionsRemplacees(await db.pending_actions.toArray(), nouvelle);
    if (remplacees.length > 0) await db.pending_actions.bulkDelete(remplacees);
    await db.pending_actions.add({ ...nouvelle, created_at: new Date().toISOString() });
  });
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_FILE_AJOUT));
}

let flushing = false;

export type ResultatFlush = { synced: number; abandoned: number; restantes: number };

// Rejoue les actions en attente dans l'ordre d'ajout, en vidant la file au
// fur et à mesure. La décision après chaque échec vient de `flush-policy.ts`
// (fonctions pures, testées séparément) :
//   - erreur réseau -> on s'arrête (`break`), on retentera au prochain appel ;
//   - erreur non réseau sous le seuil -> idem, mais le compteur de tentatives
//     de CETTE action est persisté avant de s'arrêter ;
//   - erreur non réseau au seuil, ou action `courses` ciblant un id
//     temporaire jamais confirmé par le serveur -> l'action est retirée de
//     la file et on CONTINUE avec les suivantes (peuvent appartenir à
//     n'importe quel autre module : ne pas les laisser bloquées indéfiniment
//     par une action irrécupérable qui les précède).
// Voir reports/2026-09-19-audit-module-courses.md (#13/#14/#15) pour le
// diagnostic complet à l'origine de ce comportement.
//
// Renvoie le nombre d'actions rejouées avec succès et le nombre d'actions
// abandonnées : l'appelant s'en sert pour rafraîchir les données affichées
// dans les deux cas (un abandon peut laisser un article optimiste fantôme à
// l'écran, tout comme un refetch parti à la reconnexion peut avoir lu l'état
// serveur AVANT le rejeu).
export async function flushQueue(): Promise<ResultatFlush> {
  // Un rejeu est déjà en cours : on ne sait pas encore ce qu'il restera, on
  // suppose qu'il reste des actions pour que l'appelant retente plus tard.
  if (flushing) return { synced: 0, abandoned: 0, restantes: 1 };
  flushing = true;
  try {
    const db = await preloadOfflineDb();
    const pending = await db.pending_actions.orderBy("created_at").toArray();
    if (pending.length === 0) return { synced: 0, abandoned: 0, restantes: 0 };

    let synced = 0;
    let abandoned = 0;

    for (const action of pending) {
      if (decisionAvantExecution(action).type === "purger_immediat") {
        if (action.id !== undefined) await db.pending_actions.delete(action.id);
        abandoned++;
        console.warn(
          `[offline] action abandonnée (id temporaire jamais synchronisé) : ${action.module}.${action.action_name}`
        );
        continue;
      }

      const fn = ACTIONS[action.module]?.[action.action_name];
      if (!fn) {
        if (action.id !== undefined) await db.pending_actions.delete(action.id);
        continue;
      }

      try {
        await fn(...action.payload);
        if (action.id !== undefined) await db.pending_actions.delete(action.id);
        synced++;
      } catch (err) {
        const decision = decisionApresEchec(action, isNetworkError(err));

        if (decision.type === "abandonner_et_continuer") {
          if (action.id !== undefined) await db.pending_actions.delete(action.id);
          abandoned++;
          console.warn(
            `[offline] action abandonnée après ${action.tentatives ?? 0} échec(s) supplémentaire(s) : ${action.module}.${action.action_name}`
          );
          continue;
        }

        if (action.id !== undefined && decision.tentatives !== (action.tentatives ?? 0)) {
          await db.pending_actions.update(action.id, { tentatives: decision.tentatives });
        }
        break;
      }
    }

    if (synced > 0) {
      showToast(`${synced} action${synced > 1 ? "s" : ""} synchronisée${synced > 1 ? "s" : ""}`);
    }
    if (abandoned > 0) {
      showToast(
        abandoned > 1
          ? `${abandoned} actions hors ligne n'ont pas pu être synchronisées et ont été abandonnées.`
          : `1 action hors ligne n'a pas pu être synchronisée et a été abandonnée.`,
        5000
      );
    }

    return { synced, abandoned, restantes: await db.pending_actions.count() };
  } finally {
    flushing = false;
  }
}
