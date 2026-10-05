import { addDays, format } from "date-fns";
import { calculerProchaineOccurrence } from "@/lib/date/recurrence";
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
 * `@/lib/date/recurrence`) : cette fonction reste pure.
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
  /** Absente tant que la migration `duree_minutes` n'est pas appliquée. */
  duree_minutes?: number | null;
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

/**
 * Garde d'idempotence de `setTacheFait` pour les tâches récurrentes : cocher
 * une récurrente AVANCE l'échéance d'une occurrence, donc rejouer deux fois
 * la même coche (file hors ligne rejouée après une coche faite en ligne, double
 * envoi…) sauterait une occurrence. L'appelant transmet l'échéance qu'il voyait
 * à l'écran ; si le serveur en a déjà une autre, la coche a déjà été appliquée
 * (ou la tâche modifiée entre-temps) et ne doit pas être rejouée.
 *
 * Sans échéance observée (`undefined` : ancien appelant, action mise en file
 * avant ce correctif), aucune garde : comportement historique.
 */
export function cochageDejaApplique(
  tache: EtatRecurrence,
  fait: boolean,
  echeanceObservee: string | null | undefined
): boolean {
  if (!fait || !tache.recurrence_frequence || echeanceObservee === undefined) return false;
  return tache.echeance !== echeanceObservee;
}

export type EtatListeTaches = "chargement" | "erreur" | "liste";

/**
 * Ce que /taches et /agenda affichent selon l'état de la requête `taches`.
 * Une actualisation qui échoue (connexion faible, incident serveur) laisse les
 * données déjà en cache tout en passant la requête en erreur : l'erreur ne
 * doit remplacer la liste que s'il n'y a rien à montrer.
 */
export function etatListeTaches(requete: {
  isLoading: boolean;
  isError: boolean;
  aDesDonnees: boolean;
}): EtatListeTaches {
  if (requete.isLoading) return "chargement";
  if (!requete.aDesDonnees) return "erreur";
  return "liste";
}

/** Vrai quand la liste affichée est celle du cache alors que la dernière
 * actualisation a échoué : à signaler discrètement, sans masquer la liste. */
export function actualisationEchouee(requete: { isError: boolean; aDesDonnees: boolean }): boolean {
  return requete.isError && requete.aDesDonnees;
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
    tache.recurrence_fin !== null ||
    (tache.duree_minutes ?? null) !== null
  );
}

// --- Durée estimée -------------------------------------------------------

// Durées proposées par le formulaire (en minutes). Le serveur accepte tout
// entier entre 1 et DUREE_MAX_MINUTES : la liste ne sert qu'à la saisie.
export const DUREES_MINUTES = [15, 30, 45, 60, 90, 120, 180, 240] as const;
const DUREE_MAX_MINUTES = 1440;

/** « 45 min », « 1 h », « 1 h 30 » : libellé court d'une durée estimée. */
export function libelleDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Entier de minutes valide (1..DUREE_MAX_MINUTES), sinon `null`. */
export function parseDureeMinutes(brut: string): number | null {
  const texte = brut.trim();
  if (!texte) return null;
  const n = Number(texte);
  return Number.isInteger(n) && n >= 1 && n <= DUREE_MAX_MINUTES ? n : null;
}

// --- Tri et filtre par priorité --------------------------------------------

export type Priorite = Enums<"priorite_tache">;
export type OrdreTaches = "manuel" | "priorite" | "echeance";

const RANG_PRIORITE: Record<Priorite, number> = { haute: 0, moyenne: 1, basse: 2, aucune: 3 };

type AvecPriorite = { priorite: Priorite; echeance: string | null };

/**
 * Tri d'affichage des tâches actives. `manuel` conserve l'ordre reçu (celui
 * du glisser-déposer, calculé côté serveur). `priorite` : haute d'abord, puis
 * échéance la plus proche, sans échéance en dernier. `echeance` : date
 * croissante puis priorité. Le tri est stable : à critères égaux, l'ordre
 * manuel reste l'ordre de départage.
 */
export function trierTaches<T extends AvecPriorite>(taches: readonly T[], ordre: OrdreTaches): T[] {
  if (ordre === "manuel") return [...taches];
  const parEcheance = (a: T, b: T) =>
    a.echeance === b.echeance
      ? 0
      : a.echeance === null
        ? 1
        : b.echeance === null
          ? -1
          : a.echeance < b.echeance
            ? -1
            : 1;
  const parPriorite = (a: T, b: T) => RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite];
  return [...taches].sort(ordre === "priorite" ? (a, b) => parPriorite(a, b) || parEcheance(a, b) : (a, b) => parEcheance(a, b) || parPriorite(a, b));
}

/** Garde les tâches dont la priorité est cochée ; ensemble vide = pas de filtre. */
export function filtrerParPriorite<T extends { priorite: Priorite }>(
  taches: readonly T[],
  priorites: ReadonlySet<Priorite>
): T[] {
  return priorites.size === 0 ? [...taches] : taches.filter((t) => priorites.has(t.priorite));
}

// --- Report d'échéance ------------------------------------------------------

export type CibleReport = "aujourdhui" | "demain" | "semaine_prochaine";

/**
 * Date ISO d'un report rapide. « Semaine prochaine » = lundi prochain
 * (jamais aujourd'hui : un lundi, c'est le lundi suivant).
 */
export function dateReport(cible: CibleReport, today: string): string {
  const base = new Date(`${today}T00:00:00`);
  if (cible === "aujourdhui") return today;
  if (cible === "demain") return format(addDays(base, 1), "yyyy-MM-dd");
  const joursJusquauLundi = ((8 - base.getDay()) % 7) || 7;
  return format(addDays(base, joursJusquauLundi), "yyyy-MM-dd");
}
