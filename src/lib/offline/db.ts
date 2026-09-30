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

class OfflineDB extends Dexie {
  pending_actions!: Table<PendingAction, number>;
  cache_lecture!: Table<CacheLecture, string>;

  constructor() {
    super("kilio-offline");
    this.version(1).stores({
      pending_actions: "++id, created_at",
    });
    this.version(2).stores({
      pending_actions: "++id, created_at",
      cache_lecture: "cle",
    });
  }
}

export const db = new OfflineDB();
