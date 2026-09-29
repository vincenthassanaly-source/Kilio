import { calculerProchaineOccurrence } from "@/lib/budget/compute";
import type { Enums, Tables } from "@/lib/supabase/types";

// Onglets de vue de /taches (TachesView) : défini ici, dans un module pur,
// pour que les règles qui en dépendent (échéance par défaut) restent
// testables sans importer de composant.
export type VueTache = "aujourdhui" | "en_retard" | "semaine" | "toutes";

/**
 * Échéance à pré-remplir dans le formulaire de création selon l'onglet de
 * vue actif. « Aujourd'hui » et « 7 jours » filtrent sur l'échéance : sans
 * date, la tâche créée serait aussitôt masquée par le filtre qui l'a vue
 * naître. « En retard » et « Toutes » n'imposent aucune date.
 *
 * `today` est fourni par l'appelant (`aujourdhuiISO()` de
 * `@/lib/budget/compute`) : cette fonction reste pure.
 */
export function echeanceParDefaut(vue: VueTache, today: string): string | undefined {
  return vue === "aujourdhui" || vue === "semaine" ? today : undefined;
}

// Durée d'affichage du toast d'avertissement (plus long que le toast par
// défaut : le message tient sur deux lignes).
export const DUREE_TOAST_AVERTISSEMENT_MS = 6500;

/**
 * Avertissement affiché quand la tâche a bien été créée mais qu'une étape
 * secondaire (tags, images) a échoué. Renvoie `undefined` si tout a réussi.
 * La tâche existe : on ne parle jamais d'erreur bloquante ici, seulement de
 * ce qu'il reste à refaire.
 */
export function messageAvertissementCreation(echecs: {
  tags: boolean;
  images: boolean;
  plusieursImages?: boolean;
}): string | undefined {
  if (!echecs.tags && !echecs.images) return undefined;
  const tags = "l'enregistrement des tags";
  const images = echecs.plusieursImages ? "l'envoi des images" : "l'envoi de l'image";
  let detail: string;
  if (echecs.tags && echecs.images) detail = `${tags} et ${images} ont échoué`;
  else if (echecs.tags) detail = `${tags} a échoué`;
  else detail = `${images} a échoué`;
  return `Tâche créée, mais ${detail}. Rouvre la tâche pour réessayer.`;
}

/**
 * Message affiché dans le formulaire quand l'envoi n'a pas pu partir (hors
 * ligne ou erreur réseau). La saisie est conservée : seul le réessai reste
 * à faire.
 */
export function messageHorsLigne(edition: boolean): string {
  return edition
    ? "Connexion impossible : les modifications n'ont pas été enregistrées. Vérifie ta connexion et réessaie."
    : "Connexion impossible : la tâche n'a pas été enregistrée. Vérifie ta connexion et réessaie.";
}

/**
 * Texte de confirmation avant la suppression d'une liste. Une liste vide se
 * supprime avec une confirmation simple ; sinon le message annonce le nombre
 * exact de tâches (et combien sont déjà faites) et précise que la
 * suppression est définitive et emporte sous-tâches et images.
 */
export function messageSuppressionListe(nom: string, total: number, faites: number): string {
  if (total <= 0) return `Supprimer la liste « ${nom} » ?`;

  const tachesTxt = total === 1 ? "sa tâche" : `ses ${total} tâches`;
  let faitesTxt = "";
  if (faites > 0) {
    if (total === 1) faitesTxt = " (déjà faite)";
    else if (faites === total) faitesTxt = " (toutes faites)";
    else if (faites === 1) faitesTxt = " (dont 1 faite)";
    else faitesTxt = ` (dont ${faites} faites)`;
  }
  const emporte =
    total === 1
      ? "la tâche, ses sous-tâches et ses images seront supprimées"
      : "les tâches, leurs sous-tâches et leurs images seront supprimées";
  return `Supprimer la liste « ${nom} » et ${tachesTxt}${faitesTxt} ? Cette action est définitive : ${emporte}.`;
}

/** Libellé discret du nombre de tâches d'une liste (« 12 tâches »). */
export function libelleNombreTaches(total: number): string {
  if (total <= 0) return "Aucune tâche";
  return total === 1 ? "1 tâche" : `${total} tâches`;
}

// Valeurs de rappel acceptées par le serveur (parseTacheInput) et proposées
// par le formulaire. Ici plutôt que dans actions/taches.ts : un fichier
// "use server" ne peut exporter que des fonctions asynchrones.
export const RAPPEL_MINUTES_VALEURS = [5, 15, 30, 60, 1440] as const;

// Valeurs de départ d'un formulaire de création pré-rempli (saisie en langage
// naturel : « Modifier » une tâche proposée, ou création simple depuis un
// texte). Sans effet en édition, où `tache` fait foi.
export type TacheInitiale = {
  titre?: string;
  priorite?: Enums<"priorite_tache">;
  toute_la_journee?: boolean;
  heure_fin?: string | null;
  rappel_minutes?: number | null;
  recurrence_frequence?: Enums<"frequence_recurrence"> | null;
  recurrence_fin?: string | null;
  tagIds?: string[];
  nouveauxTags?: string[];
};

export type ChampsAvancesTache = Pick<
  Tables<"taches">,
  | "heure"
  | "heure_fin"
  | "rappel_minutes"
  | "notes"
  | "programme_jour"
  | "priorite"
  | "toute_la_journee"
  | "recurrence_frequence"
  | "recurrence_fin"
> & {
  images: readonly unknown[];
  tags: readonly unknown[];
};

/**
 * Vrai si au moins un des champs rangés sous « Plus d'options » du
 * formulaire de tâche est renseigné. En édition, le bloc est alors déplié
 * d'office : on ne cache jamais une valeur existante derrière un repli.
 */
export type EtatRecurrence = {
  echeance: string | null;
  recurrence_frequence: Enums<"frequence_recurrence"> | null;
  recurrence_fin: string | null;
};

export type ResultatCochage = {
  fait: boolean;
  echeance: string | null;
  /** Vrai si une occurrence a été avancée (les sous-tâches doivent être remises à zéro). */
  occurrenceAvancee: boolean;
};

/**
 * Calcule le nouvel état d'une tâche après un changement de case à cocher,
 * fonction pure partagée par le serveur (toggleTache/setTacheFait) et testée
 * indépendamment de Supabase.
 *
 * Décocher, ou cocher une tâche non récurrente : simple bascule de `fait`.
 *
 * Cocher une tâche récurrente : elle repart non cochée à sa prochaine
 * échéance. La prochaine échéance est calculée en boucle tant qu'elle ne
 * dépasse pas `today` (et non en un seul pas depuis `echeance`), pour qu'une
 * tâche en retard reparte directement sur une échéance future plutôt que de
 * rester en retard après chaque coche. Si cette échéance dépasse
 * `recurrence_fin`, la récurrence s'arrête et la tâche reste cochée.
 */
export function appliquerCochage(
  tache: EtatRecurrence,
  fait: boolean,
  today: string
): ResultatCochage {
  if (!fait || !tache.recurrence_frequence) {
    return { fait, echeance: tache.echeance, occurrenceAvancee: false };
  }

  let prochaine = tache.echeance ?? today;
  do {
    prochaine = calculerProchaineOccurrence(prochaine, tache.recurrence_frequence);
  } while (prochaine <= today);

  const recurrenceTerminee = tache.recurrence_fin !== null && prochaine > tache.recurrence_fin;
  if (recurrenceTerminee) {
    return { fait: true, echeance: tache.echeance, occurrenceAvancee: false };
  }
  return { fait: false, echeance: prochaine, occurrenceAvancee: true };
}

export function champsAvancesRenseignes(tache: ChampsAvancesTache): boolean {
  return (
    tache.heure !== null ||
    tache.heure_fin !== null ||
    tache.rappel_minutes !== null ||
    Boolean(tache.notes?.trim()) ||
    tache.programme_jour ||
    tache.images.length > 0 ||
    tache.priorite !== "aucune" ||
    tache.toute_la_journee ||
    tache.tags.length > 0 ||
    tache.recurrence_frequence !== null ||
    tache.recurrence_fin !== null
  );
}
