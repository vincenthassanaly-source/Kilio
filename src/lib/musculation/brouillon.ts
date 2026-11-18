"use client";

import { enregistrerEntrainement } from "@/app/actions/musculation";
import { isNetworkError } from "@/lib/network";
import { finPourDuree, type Brouillon, type EntrainementPayload } from "./seance";

// Stockage local de la séance (Dexie, voir lib/offline/db.ts) : la séance vit
// sur le téléphone pendant l'entraînement, puis est envoyée au serveur. Le
// réseau est souvent mauvais en salle — aucune série ne doit dépendre de lui.

const CLE_BROUILLON = "courant";

/** Émis quand le brouillon change (début, abandon, fin) : voir useBrouillonEnCours. */
export const EVENEMENT_BROUILLON = "kilio:musculation-brouillon";
/** Émis après CHAQUE écriture du brouillon (séance en direct comprise) : voir SeanceFlottante. */
export const EVENEMENT_BROUILLON_MAJ = "kilio:musculation-brouillon-maj";
/** Émis quand une séance terminée est mise en attente d'envoi (voir MusculationSync). */
export const EVENEMENT_SEANCE_EN_ATTENTE = "kilio:musculation-seance-en-attente";

// Dexie est chargé à la demande (comme lib/offline/queue.ts) : il n'alourdit
// pas le JS initial des écrans qui n'en ont pas besoin.
async function base() {
  return (await import("@/lib/offline/db")).db;
}

function signaler(evenement: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(evenement));
}

export async function lireBrouillon(): Promise<Brouillon | null> {
  try {
    return ((await (await base()).musculation_brouillon.get(CLE_BROUILLON))?.valeur as Brouillon | undefined) ?? null;
  } catch {
    return null;
  }
}

export type LectureBrouillon = { statut: "ok"; brouillon: Brouillon | null } | { statut: "erreur" };

/**
 * Comme `lireBrouillon`, mais distingue « aucune séance » d'une lecture qui
 * échoue (module Dexie non chargé hors ligne, base verrouillée un instant…) :
 * une erreur ne doit jamais être prise pour une séance absente. Quelques essais
 * avant de renoncer.
 */
export async function lireBrouillonSecurise(essais = 3, delaiMs = 400): Promise<LectureBrouillon> {
  for (let i = 0; i < essais; i += 1) {
    try {
      const lu = (await (await base()).musculation_brouillon.get(CLE_BROUILLON))?.valeur as Brouillon | undefined;
      return { statut: "ok", brouillon: lu ?? null };
    } catch {
      if (i < essais - 1) await new Promise((resolve) => setTimeout(resolve, delaiMs));
    }
  }
  return { statut: "erreur" };
}

/** Écrit le brouillon. `signal` : prévient les autres écrans (bannière « séance en cours »). */
export async function ecrireBrouillon(valeur: Brouillon, signal = false): Promise<void> {
  await (await base()).musculation_brouillon.put({ cle: CLE_BROUILLON, valeur });
  signaler(EVENEMENT_BROUILLON_MAJ);
  if (signal) signaler(EVENEMENT_BROUILLON);
}

export async function effacerBrouillon(): Promise<void> {
  await (await base()).musculation_brouillon.delete(CLE_BROUILLON);
  signaler(EVENEMENT_BROUILLON);
}

/**
 * Termine la séance en un seul geste atomique : la séance rejoint les envois en
 * attente ET le brouillon disparaît (jamais l'un sans l'autre, sinon une
 * séance pourrait être perdue ou terminée deux fois).
 */
export async function terminerSeance(payload: EntrainementPayload): Promise<void> {
  const db = await base();
  await db.transaction("rw", db.musculation_a_envoyer, db.musculation_brouillon, async () => {
    await db.musculation_a_envoyer.put({ id: payload.id, payload, cree_le: new Date().toISOString() });
    await db.musculation_brouillon.delete(CLE_BROUILLON);
  });
  signaler(EVENEMENT_BROUILLON);
  signaler(EVENEMENT_SEANCE_EN_ATTENTE);
}

async function compterSeancesEnAttente(): Promise<number> {
  try {
    return await (await base()).musculation_a_envoyer.count();
  } catch {
    return 0;
  }
}

export type SeanceRefusee = { id: string; nom: string; debutA: string; erreur: string };

/** Séances terminées que le serveur a refusées et qui attendent sur le téléphone. */
export async function lireSeancesRefusees(): Promise<SeanceRefusee[]> {
  try {
    const enAttente = await (await base()).musculation_a_envoyer.orderBy("cree_le").toArray();
    return enAttente
      .filter((seance) => seance.erreur)
      .map((seance) => {
        const payload = seance.payload as EntrainementPayload;
        return { id: seance.id, nom: payload.nom, debutA: payload.debutA, erreur: seance.erreur as string };
      });
  } catch {
    return [];
  }
}

/**
 * Corrige la durée d'une séance refusée (en minutes, 1 à 1440) puis la remet en
 * file d'envoi. `false` si la séance n'existe plus ou si la durée est invalide.
 */
export async function ajusterDureeSeanceEnAttente(id: string, minutes: number): Promise<boolean> {
  const db = await base();
  const seance = await db.musculation_a_envoyer.get(id);
  if (!seance) return false;
  const payload = seance.payload as EntrainementPayload;
  const fin = finPourDuree(payload.debutA, minutes);
  if (!fin) return false;
  await db.musculation_a_envoyer.put({ id: seance.id, cree_le: seance.cree_le, payload: { ...payload, finA: fin } });
  signaler(EVENEMENT_SEANCE_EN_ATTENTE);
  return true;
}

/** Supprime définitivement une séance en attente d'envoi (action explicite de l'utilisateur). */
export async function supprimerSeanceEnAttente(id: string): Promise<void> {
  await (await base()).musculation_a_envoyer.delete(id);
  signaler(EVENEMENT_SEANCE_EN_ATTENTE);
}

const MESSAGE_ERREUR_SERVEUR = "Le serveur n'a pas pu enregistrer la séance.";

/**
 * Au lancement de l'app : remet en file les séances bloquées par une erreur
 * serveur « technique » (typiquement une ancienne version de l'appli appelant
 * une Server Action disparue après un déploiement). Les refus explicites du
 * serveur (durée, exercice retiré…) restent, eux, à traiter par l'utilisateur.
 */
export async function rearmerSeancesEnErreurTechnique(): Promise<void> {
  try {
    const db = await base();
    const bloquees = await db.musculation_a_envoyer.filter((s) => s.erreur === MESSAGE_ERREUR_SERVEUR).toArray();
    for (const seance of bloquees) {
      await db.musculation_a_envoyer.update(seance.id, { erreur: undefined });
    }
  } catch {
    // Stockage local indisponible : rien à rejouer pour l'instant.
  }
}

export type ResultatEnvoi ={ envoyees: number; restantes: number; refus: string[] };

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
  const enAttente = await db.musculation_a_envoyer.orderBy("cree_le").toArray();
  for (const seance of enAttente) {
    try {
      const resultat = await enregistrerEntrainement(seance.payload as EntrainementPayload);
      if (resultat.ok) {
        await db.musculation_a_envoyer.delete(seance.id);
        envoyees += 1;
      } else {
        await db.musculation_a_envoyer.update(seance.id, { erreur: resultat.error });
        refus.push(resultat.error);
      }
    } catch (erreur) {
      if (!isNetworkError(erreur)) {
        // Remontée comme un refus : l'écran dit la vérité au lieu d'annoncer un
        // envoi « dès que le réseau revient » qui n'aura pas lieu.
        await db.musculation_a_envoyer.update(seance.id, { erreur: MESSAGE_ERREUR_SERVEUR });
        refus.push(MESSAGE_ERREUR_SERVEUR);
      }
      break;
    }
  }
  return { envoyees, restantes: await compterSeancesEnAttente(), refus };
}
