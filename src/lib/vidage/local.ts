"use client";

import { enregistrerFeuille, type FeuilleVidage } from "@/app/actions/vidage";
import { shiftDate } from "@/lib/date/iso";
import { aujourdhuiParis } from "@/lib/date/paris";
import { isNetworkError } from "@/lib/network";
import type { Trait } from "./traits";

// Copie locale des feuilles (Dexie, voir lib/offline/db.ts) : chaque trait est
// écrit sur le téléphone AVANT tout envoi, pour qu'une coupure réseau ou la
// fermeture de l'app ne fasse rien perdre. Le serveur reçoit ensuite la feuille
// entière (voir synchroniserFeuilles, déclenchée par VidageSync).

export type FeuilleLocale = {
  jour: string;
  traits: Trait[];
  hauteur: number;
  modifie_le: string;
  a_envoyer: 0 | 1;
  erreur?: string;
};

/** Émis après chaque écriture locale en attente d'envoi : voir VidageSync. */
export const EVENEMENT_FEUILLE_EN_ATTENTE = "kilio:vidage-en-attente";
/**
 * Émis quand au moins une feuille vient d'arriver sur le serveur, QUEL QUE SOIT
 * l'appelant de synchroniserFeuilles (synchro de fond ou envoi de l'aperçu en
 * quittant la feuille) : le calendrier de relecture se rafraîchit dessus.
 */
export const EVENEMENT_FEUILLES_ENVOYEES = "kilio:vidage-envoyees";

// Une feuille déjà envoyée n'est gardée localement que quelques jours (lecture
// hors ligne des dernières soirées) ; le serveur garde tout.
const JOURS_CONSERVES = 7;

// Dexie est chargé à la demande (comme lib/musculation/brouillon.ts).
async function base() {
  return (await import("@/lib/offline/db")).db;
}

// `modifie_le` sert à détecter une édition arrivée PENDANT un envoi : deux
// écritures dans la même milliseconde ne doivent jamais porter la même valeur.
let derniere = "";
function maintenantUnique(): string {
  let iso = new Date().toISOString();
  if (iso <= derniere) iso = new Date(new Date(derniere).getTime() + 1).toISOString();
  derniere = iso;
  return iso;
}

export async function lireFeuilleLocale(jour: string): Promise<FeuilleLocale | null> {
  try {
    return ((await (await base()).vidage_feuilles.get(jour)) as FeuilleLocale | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Écrit la feuille sur le téléphone et la marque « à envoyer ». */
export async function ecrireFeuilleLocale(jour: string, traits: Trait[], hauteur: number): Promise<void> {
  await (await base()).vidage_feuilles.put({ jour, traits, hauteur, modifie_le: maintenantUnique(), a_envoyer: 1 });
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_FEUILLE_EN_ATTENTE));
}

/**
 * Garde en cache la version du serveur pour une lecture hors ligne. Sans effet
 * si des modifications locales n'ont pas encore été envoyées : elles priment.
 */
export async function memoriserFeuilleServeur(feuille: FeuilleVidage): Promise<void> {
  try {
    const db = await base();
    const existante = await db.vidage_feuilles.get(feuille.jour);
    if (existante?.a_envoyer === 1) return;
    await db.vidage_feuilles.put({
      jour: feuille.jour,
      traits: feuille.traits,
      hauteur: feuille.hauteur,
      modifie_le: feuille.updatedAt ?? maintenantUnique(),
      a_envoyer: 0,
    });
  } catch {
    // Le cache est facultatif : sans lui, la feuille reste lisible en ligne.
  }
}

export type SourceFeuille = { traits: Trait[]; hauteur: number; source: "local" | "serveur" | "vide" };

/**
 * Quelle version afficher ? Des modifications locales non envoyées priment sur
 * le serveur (sinon on les écraserait) ; sinon le serveur ; sinon le cache
 * local (hors ligne) ; sinon une feuille vide.
 */
export function choisirFeuille(
  local: FeuilleLocale | null,
  serveur: FeuilleVidage | null,
  hauteurVide: number
): SourceFeuille {
  if (local && local.a_envoyer === 1) return { traits: local.traits, hauteur: local.hauteur, source: "local" };
  if (serveur) return { traits: serveur.traits, hauteur: serveur.hauteur, source: "serveur" };
  if (local) return { traits: local.traits, hauteur: local.hauteur, source: "local" };
  return { traits: [], hauteur: hauteurVide, source: "vide" };
}

export async function compterFeuillesEnAttente(): Promise<number> {
  try {
    return (await (await base()).vidage_feuilles.toArray()).filter((f) => f.a_envoyer === 1).length;
  } catch {
    return 0;
  }
}

export type ResultatEnvoi = { envoyees: number; restantes: number; refus: string[] };

// Les envois s'enchaînent (voir lib/musculation/brouillon.ts) : deux
// déclencheurs simultanés ne doivent pas envoyer la même feuille deux fois.
let derniereFile: Promise<unknown> = Promise.resolve();

/**
 * Envoie les feuilles modifiées, de la plus ancienne à la plus récente.
 *  - Succès : la feuille n'est plus « à envoyer », sauf si elle a été modifiée
 *    pendant l'envoi (elle repartira au prochain passage).
 *  - Erreur réseau : on s'arrête, tout reste en attente.
 *  - Refus du serveur : la feuille RESTE sur le téléphone avec le message.
 * L'envoi remplace la feuille entière : le renvoyer est sans danger.
 */
export function synchroniserFeuilles(): Promise<ResultatEnvoi> {
  const resultat = derniereFile.then(envoyerEnAttente, envoyerEnAttente);
  derniereFile = resultat;
  return resultat;
}

async function envoyerEnAttente(): Promise<ResultatEnvoi> {
  let envoyees = 0;
  const refus: string[] = [];
  const db = await base();
  const enAttente = (await db.vidage_feuilles.orderBy("jour").toArray()).filter((f) => f.a_envoyer === 1);

  for (const feuille of enAttente) {
    try {
      const resultat = await enregistrerFeuille(feuille.jour, feuille.traits as Trait[], feuille.hauteur);
      if (resultat.ok) {
        const courante = await db.vidage_feuilles.get(feuille.jour);
        if (courante && courante.modifie_le === feuille.modifie_le) {
          await db.vidage_feuilles.update(feuille.jour, { a_envoyer: 0, erreur: undefined });
        }
        envoyees += 1;
      } else {
        await db.vidage_feuilles.update(feuille.jour, { erreur: resultat.error });
        refus.push(resultat.error);
      }
    } catch (erreur) {
      if (!isNetworkError(erreur)) {
        await db.vidage_feuilles.update(feuille.jour, { erreur: "Le serveur n'a pas pu enregistrer la feuille." });
      }
      break;
    }
  }

  await purgerAnciennes();
  if (envoyees > 0 && typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_FEUILLES_ENVOYEES));
  return { envoyees, restantes: await compterFeuillesEnAttente(), refus };
}

async function purgerAnciennes(): Promise<void> {
  try {
    const db = await base();
    const limite = shiftDate(aujourdhuiParis(), -JOURS_CONSERVES);
    const anciennes = (await db.vidage_feuilles.toArray()).filter((f) => f.a_envoyer === 0 && f.jour < limite);
    for (const f of anciennes) await db.vidage_feuilles.delete(f.jour);
  } catch {
    // Nettoyage facultatif.
  }
}
