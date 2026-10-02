import Dexie, { type Table } from "dexie";

// File d'attente d'écriture offline : une action = un appel de Server
// Action différé (module + nom de fonction + arguments), rejoué dans
// l'ordre à la reconnexion par flushQueue() (voir queue.ts).
type PendingAction = {
  id?: number;
  module: string;
  action_name: string;
  payload: unknown[];
  created_at: string;
  // Nombre d'échecs non réseau déjà comptabilisés (voir flush-policy.ts,
  // SEUIL_ABANDON_TENTATIVES) — absent tant qu'aucun échec non réseau n'a eu
  // lieu (équivalent à 0). Champ non indexé : aucun bump de version Dexie
  // nécessaire pour l'ajouter, Dexie stocke l'objet entier quel que soit le
  // schéma déclaré ci-dessous.
  tentatives?: number;
};

// Copie locale en lecture du module Pharmacie (un seul enregistrement, clé
// "snapshot") : permet de consulter et de réviser sans réseau.
type CacheLecture = { cle: string; valeur: unknown; enregistre_le: string };

// Module Sport : séance en cours (un seul enregistrement, clé "courant") et
// séances terminées en attente d'envoi. Volontairement HORS de la file
// générique `pending_actions` : celle-ci abandonne une action après quelques
// échecs (flush-policy.ts), ce qui ferait perdre toutes les séries d'une
// séance. Ici rien n'est supprimé tant que le serveur n'a pas confirmé.
type BrouillonSport = { cle: string; valeur: import("@/lib/sport/seance").Brouillon };
type SeanceAEnvoyer = {
  id: string;
  payload: import("@/lib/sport/seance").SeancePayload;
  cree_le: string;
  /** Dernier refus du serveur (la séance reste en attente, jamais supprimée). */
  erreur?: string;
};

class OfflineDB extends Dexie {
  pending_actions!: Table<PendingAction, number>;
  cache_lecture!: Table<CacheLecture, string>;
  sport_brouillon!: Table<BrouillonSport, string>;
  sport_a_envoyer!: Table<SeanceAEnvoyer, string>;

  constructor() {
    super("kilio-offline");
    this.version(1).stores({
      pending_actions: "++id, created_at",
    });
    this.version(2).stores({
      pending_actions: "++id, created_at",
      cache_lecture: "cle",
    });
    this.version(3).stores({
      pending_actions: "++id, created_at",
      cache_lecture: "cle",
      sport_brouillon: "cle",
      sport_a_envoyer: "id, cree_le",
    });
  }
}

export const db = new OfflineDB();
