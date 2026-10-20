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

// Module Musculation : la séance en cours (un seul enregistrement, clé
// "courant") et les séances terminées pas encore reçues par le serveur.
// `valeur` / `payload` sont typés côté lib/musculation (Brouillon,
// EntrainementPayload) ; ici `unknown` pour ne pas coupler la base locale au module.
type MusculationBrouillon = { cle: string; valeur: unknown };
type MusculationAEnvoyer = { id: string; payload: unknown; cree_le: string; erreur?: string };

// Module « Vider ma tête » : une feuille manuscrite par jour, écrite localement
// à chaque trait puis envoyée au serveur. `a_envoyer` vaut 1 tant que la
// dernière version n'est pas partie (Dexie n'indexe pas les booléens). `traits`
// est typé côté lib/vidage (Trait[]) ; ici `unknown` comme pour la musculation.
type VidageFeuilleLocale = {
  jour: string;
  traits: unknown;
  hauteur: number;
  modifie_le: string;
  a_envoyer: 0 | 1;
  erreur?: string;
};

class OfflineDB extends Dexie {
  pending_actions!: Table<PendingAction, number>;
  cache_lecture!: Table<CacheLecture, string>;
  musculation_brouillon!: Table<MusculationBrouillon, string>;
  musculation_a_envoyer!: Table<MusculationAEnvoyer, string>;
  vidage_feuilles!: Table<VidageFeuilleLocale, string>;

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
    // Module Sport retiré : supprime ses deux tables locales (brouillon de
    // séance et file d'envoi) des navigateurs qui les avaient créées.
    this.version(4).stores({
      pending_actions: "++id, created_at",
      cache_lecture: "cle",
      sport_brouillon: null,
      sport_a_envoyer: null,
    });
    this.version(5).stores({
      pending_actions: "++id, created_at",
      cache_lecture: "cle",
      musculation_brouillon: "cle",
      musculation_a_envoyer: "id, cree_le",
    });
    this.version(6).stores({
      pending_actions: "++id, created_at",
      cache_lecture: "cle",
      musculation_brouillon: "cle",
      musculation_a_envoyer: "id, cree_le",
      vidage_feuilles: "jour",
    });
  }
}

export const db = new OfflineDB();
