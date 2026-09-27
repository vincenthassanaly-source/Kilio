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

class OfflineDB extends Dexie {
  pending_actions!: Table<PendingAction, number>;

  constructor() {
    super("kilio-offline");
    this.version(1).stores({
      pending_actions: "++id, created_at",
    });
  }
}

export const db = new OfflineDB();
