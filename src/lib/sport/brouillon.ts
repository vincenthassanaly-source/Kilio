"use client";

import { enregistrerSeance } from "@/app/actions/sport";
import { isNetworkError } from "@/lib/network";
import type { Brouillon, SeancePayload } from "./seance";

// Stockage local de la séance (Dexie, voir lib/offline/db.ts) : la séance vit
// sur le téléphone pendant l'entraînement, puis est envoyée au serveur. Le
// réseau est souvent mauvais en salle — aucune série ne doit dépendre de lui.

const CLE_BROUILLON = "courant";

/** Émis quand une séance terminée est mise en attente d'envoi (voir SportSync). */
export const EVENEMENT_SEANCE_EN_ATTENTE = "kilio:sport-seance-en-attente";

// Dexie est chargé à la demande (comme lib/offline/queue.ts) : il n'alourdit
// pas le JS initial des écrans qui n'en ont pas besoin.
async function base() {
  return (await import("@/lib/offline/db")).db;
}

export async function lireBrouillon(): Promise<Brouillon | null> {
  try {
    return (await (await base()).sport_brouillon.get(CLE_BROUILLON))?.valeur ?? null;
  } catch {
    return null;
  }
}

export async function ecrireBrouillon(valeur: Brouillon): Promise<void> {
  await (await base()).sport_brouillon.put({ cle: CLE_BROUILLON, valeur });
}

export async function effacerBrouillon(): Promise<void> {
  await (await base()).sport_brouillon.delete(CLE_BROUILLON);
}

/**
 * Termine la séance en un seul geste atomique : la séance rejoint les envois en
 * attente ET le brouillon disparaît (jamais l'un sans l'autre, sinon une
 * séance pourrait être perdue ou terminée deux fois).
 */
export async function terminerSeance(payload: SeancePayload): Promise<void> {
  const db = await base();
  await db.transaction("rw", db.sport_a_envoyer, db.sport_brouillon, async () => {
    await db.sport_a_envoyer.put({ id: payload.id, payload, cree_le: new Date().toISOString() });
    await db.sport_brouillon.delete(CLE_BROUILLON);
  });
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_SEANCE_EN_ATTENTE));
}

export async function compterSeancesEnAttente(): Promise<number> {
  try {
    return await (await base()).sport_a_envoyer.count();
  } catch {
    return 0;
  }
}

export type ResultatEnvoi = { envoyees: number; restantes: number; refus: string[] };

// Les envois s'enchaînent : fin de séance et synchronisation de fond peuvent
// partir en même temps, le second appel attend le premier puis traite ce qui
// reste (souvent rien) au lieu de répondre à tort que rien n'a été envoyé.
let derniereFile: Promise<unknown> = Promise.resolve();

/**
 * Envoie les séances terminées, de la plus ancienne à la plus récente.
 *  - Succès : la séance est retirée du téléphone.
 *  - Erreur réseau : on s'arrête, tout reste en attente.
 *  - Refus du serveur : la séance RESTE en attente avec le message (jamais
 *    supprimée), les suivantes continuent.
 * L'envoi est idempotent côté serveur : renvoyer une séance déjà reçue est sans effet.
 * `restantes === 0` signifie que tout est parti, que ce soit par cet appel ou
 * par un envoi concurrent.
 */
export function synchroniserSeances(): Promise<ResultatEnvoi> {
  const resultat = derniereFile.then(envoyerEnAttente, envoyerEnAttente);
  derniereFile = resultat;
  return resultat;
}

async function envoyerEnAttente(): Promise<ResultatEnvoi> {
  let envoyees = 0;
  const refus: string[] = [];
  const db = await base();
  const enAttente = await db.sport_a_envoyer.orderBy("cree_le").toArray();
  for (const seance of enAttente) {
    try {
      const resultat = await enregistrerSeance(seance.payload);
      if (resultat.ok) {
        await db.sport_a_envoyer.delete(seance.id);
        envoyees += 1;
      } else {
        await db.sport_a_envoyer.update(seance.id, { erreur: resultat.error });
        refus.push(resultat.error);
      }
    } catch (erreur) {
      if (!isNetworkError(erreur)) {
        await db.sport_a_envoyer.update(seance.id, { erreur: "Le serveur n'a pas pu enregistrer la séance." });
      }
      break;
    }
  }
  return { envoyees, restantes: await compterSeancesEnAttente(), refus };
}
