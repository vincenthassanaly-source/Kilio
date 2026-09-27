"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { showErrorToast } from "@/components/toast/toast-store";
import { isNetworkError } from "@/lib/network";
import { isActionFailure, type ActionResult } from "./result";

// Message affiché quand la requête n'a même pas atteint le serveur.
export const MESSAGE_HORS_LIGNE = "Pas de connexion : rien n'a été enregistré. Réessaie une fois en ligne.";
const MESSAGE_GENERIQUE = "L'enregistrement a échoué. Réessaie.";

// Alias : appelants existants de ce fichier (DocumentForm, AddPhotoButton).
export const estErreurReseau = isNetworkError;

export type RunActionOptions = {
  /** Message de repli quand l'action lève (message masqué en production). */
  erreur?: string;
  /** Restaure la saisie ou l'état optimiste après un échec. */
  onError?: (message: string) => void;
  /** N'affiche pas de toast (l'appelant affiche l'erreur en ligne). */
  silencieux?: boolean;
};

/**
 * Appelle une Server Action sans jamais laisser une exception remonter à
 * l'error boundary (constat T1). Accepte aussi bien une action qui respecte
 * le contrat `ActionResult` qu'une action historique qui lève (celles
 * rejouées par la file hors ligne, `lib/offline/queue.ts`, qui s'appuie sur
 * l'exception pour décider d'un rejeu) : dans les deux cas, l'échec est
 * normalisé en `{ ok: false, error }`, annoncé par un toast `role="alert"`,
 * et `onError` permet à l'appelant de remettre la saisie en place.
 */
export async function runAction<T = undefined>(
  action: () => Promise<ActionResult<T> | T>,
  options: RunActionOptions = {}
): Promise<ActionResult<T>> {
  let resultat: ActionResult<T>;
  try {
    const valeur = await action();
    resultat = isActionFailure(valeur)
      ? valeur
      : valeur && typeof valeur === "object" && (valeur as { ok?: unknown }).ok === true
        ? (valeur as ActionResult<T>)
        : { ok: true, data: valeur as T };
  } catch (err) {
    // `redirect()` appelé côté Server Action lève une erreur signal
    // (NEXT_REDIRECT) qui doit remonter jusqu'au framework pour que la
    // navigation ait lieu — la laisser tomber dans le catch générique la
    // transformerait en un faux échec alors que l'action a réussi
    // (CLICK-PATH-201/701).
    if (isRedirectError(err)) throw err;
    resultat = {
      ok: false,
      error: estErreurReseau(err) ? MESSAGE_HORS_LIGNE : (options.erreur ?? MESSAGE_GENERIQUE),
    };
  }

  if (!resultat.ok) {
    if (!options.silencieux) showErrorToast(resultat.error);
    options.onError?.(resultat.error);
  }
  return resultat;
}
