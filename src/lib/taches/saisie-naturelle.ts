import type { Enums } from "@/lib/supabase/types";
import { estDateValide, normaliserTexte, texteOuNull } from "@/lib/saisie-ia/outils";
import { RAPPEL_MINUTES_VALEURS } from "./compute";

// Saisie de tâches en langage naturel : logique pure (aucun réseau, aucune
// base) du module Tâches de « Ajouter avec l'IA », testée seule. Gemini
// propose, ce module vérifie : rien de ce qu'il renvoie n'atteint la base ni
// l'aperçu sans être revalidé ici (dates, heures, énumérations, rappels
// permis). Le moteur commun (lib/saisie-ia) compose prompt, schéma et
// questions de précision.

export const MAX_TACHES = 8;
const MAX_TITRE = 200;
const MAX_TAGS = 5;
const MAX_NOM = 40;

const PRIORITES: readonly Enums<"priorite_tache">[] = ["aucune", "basse", "moyenne", "haute"];
const FREQUENCES: readonly Enums<"frequence_recurrence">[] = ["quotidien", "hebdomadaire", "mensuel", "annuel"];
const HEURE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Le formulaire propose 5 min dès qu'une heure est saisie : la saisie
// naturelle applique le même défaut, visible et modifiable dans l'aperçu.
const RAPPEL_PAR_DEFAUT_MINUTES = 5;

export type ListeConnue = { id: string; nom: string };
export type TagConnu = { id: string; nom: string };

export type ContexteTaches = {
  listes: ListeConnue[];
  tags: TagConnu[];
  /**
   * Ce que Vincent a écrit (phrase + réponses aux précisions). Une liste ou un
   * tag n'est retenu que si son nom y figure : Gemini ne choisit jamais seul.
   */
  texte: string;
  /** Liste choisie dans Réglages ; null = pas de choix. */
  listeParDefautId: string | null;
};

const NOM_LISTE_REPLI = "Tâches";

function echapperRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Le nom figure dans le texte (mot entier, sans accents ni casse). */
function estCite(nom: string, texteNormalise: string): boolean {
  const n = normaliserTexte(nom);
  if (!n) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${echapperRegex(n)}(?![\\p{L}\\p{N}])`, "u").test(texteNormalise);
}

// Une tâche proposée, telle qu'affichée dans l'aperçu puis envoyée à la
// création. `listeId` OU `nouvelleListe` est renseigné (jamais les deux) ;
// `listeNom` sert à l'affichage dans les deux cas.
export type TachePropose = {
  titre: string;
  echeance: string | null;
  heure: string | null;
  heure_fin: string | null;
  toute_la_journee: boolean;
  priorite: Enums<"priorite_tache">;
  rappel_minutes: number | null;
  recurrence_frequence: Enums<"frequence_recurrence"> | null;
  recurrence_fin: string | null;
  listeId: string | null;
  nouvelleListe: string | null;
  listeNom: string;
  tagIds: string[];
  nouveauxTags: string[];
  tagNoms: string[];
  avertissements: string[];
};

// Champs réellement lus à la création : le reste de `TachePropose` (noms
// d'affichage, avertissements) n'a pas à transiter. Tout est revalidé par
// parseTacheInput (createTache) : une Server Function est joignable par un
// POST direct, on ne fait pas confiance à ce que le client renvoie.
export type TacheACreer = Pick<
  TachePropose,
  | "titre"
  | "echeance"
  | "heure"
  | "heure_fin"
  | "toute_la_journee"
  | "priorite"
  | "rappel_minutes"
  | "recurrence_frequence"
  | "recurrence_fin"
  | "listeId"
  | "nouvelleListe"
  | "tagIds"
  | "nouveauxTags"
>;

/** « 1 h avant », « 15 min avant », « la veille ». */
export function libelleRappel(minutes: number): string {
  if (minutes === 1440) return "la veille";
  if (minutes === 60) return "1 h avant";
  return `${minutes} min avant`;
}

const LIBELLES_REPETITION: Record<Enums<"frequence_recurrence">, string> = {
  quotidien: "Tous les jours",
  hebdomadaire: "Chaque semaine",
  mensuel: "Chaque mois",
  annuel: "Chaque année",
};

export function libelleRepetition(frequence: Enums<"frequence_recurrence">): string {
  return LIBELLES_REPETITION[frequence];
}

const formatJour = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** « jeu. 8 oct. · 14:00–15:00 », « ven. 9 oct. · toute la journée », « Sans date ». */
export function libelleQuand(
  tache: Pick<TachePropose, "echeance" | "heure" | "heure_fin" | "toute_la_journee">
): string {
  const jour = tache.echeance ? formatJour.format(new Date(`${tache.echeance}T12:00:00Z`)) : "Sans date";
  let moment: string | null = null;
  if (tache.toute_la_journee) moment = "toute la journée";
  else if (tache.heure) moment = tache.heure_fin ? `${tache.heure}–${tache.heure_fin}` : tache.heure;
  return moment ? `${jour} · ${moment}` : jour;
}

export type ResultatRappel = { valeur: number | null; avertissement: string | null };

/**
 * Ramène un rappel demandé (en minutes) à une valeur que le serveur accepte
 * (RAPPEL_MINUTES_VALEURS). Sans heure précise, seul « la veille » (1440) a
 * un sens pour une tâche sur toute la journée ; pour une tâche sans heure ni
 * « toute la journée », aucun rappel n'est possible.
 */
export function arrondirRappel(
  demande: number | null,
  contexte: { toute_la_journee: boolean; heure: string | null }
): ResultatRappel {
  if (demande === null || !Number.isFinite(demande) || demande <= 0) {
    // Aucun rappel demandé : défaut du formulaire quand une heure existe.
    if (!contexte.toute_la_journee && contexte.heure) {
      return { valeur: RAPPEL_PAR_DEFAUT_MINUTES, avertissement: null };
    }
    return { valeur: null, avertissement: null };
  }

  if (contexte.toute_la_journee) {
    if (demande >= 720) {
      return {
        valeur: 1440,
        avertissement:
          demande === 1440
            ? null
            : "Rappel ramené à la veille : seul choix pour une tâche sur toute la journée.",
      };
    }
    return {
      valeur: null,
      avertissement: "Rappel ignoré : une tâche sur toute la journée ne peut être rappelée que la veille.",
    };
  }

  if (!contexte.heure) {
    return { valeur: null, avertissement: "Rappel ignoré : il faut une heure précise pour être rappelé." };
  }

  let plusProche: number = RAPPEL_MINUTES_VALEURS[0];
  for (const valeur of RAPPEL_MINUTES_VALEURS) {
    if (Math.abs(valeur - demande) < Math.abs(plusProche - demande)) plusProche = valeur;
  }
  return {
    valeur: plusProche,
    avertissement:
      plusProche === demande
        ? null
        : `Rappel : ${libelleRappel(plusProche)} (le plus proche disponible).`,
  };
}

type BrutTache = Record<string, unknown>;

function interpreterTache(brut: BrutTache, ctx: ContexteTaches): TachePropose | null {
  const titre = texteOuNull(brut.titre, MAX_TITRE);
  if (!titre) return null;

  const avertissements: string[] = [];

  let echeance = texteOuNull(brut.date, 10);
  if (echeance && !estDateValide(echeance)) {
    avertissements.push("Date non reconnue : à renseigner dans « Modifier ».");
    echeance = null;
  }

  const toute_la_journee = brut.toute_la_journee === true;

  let heure = toute_la_journee ? null : texteOuNull(brut.heure, 5);
  if (heure && !HEURE_REGEX.test(heure)) {
    avertissements.push("Heure non reconnue : à renseigner dans « Modifier ».");
    heure = null;
  }

  let heure_fin = toute_la_journee || !heure ? null : texteOuNull(brut.heure_fin, 5);
  if (heure_fin && (!HEURE_REGEX.test(heure_fin) || heure_fin <= (heure ?? ""))) {
    avertissements.push("Heure de fin ignorée : elle doit être après l'heure de début.");
    heure_fin = null;
  }

  const priorite = PRIORITES.includes(brut.priorite as Enums<"priorite_tache">)
    ? (brut.priorite as Enums<"priorite_tache">)
    : "aucune";

  const rappelDemande = typeof brut.rappel_minutes === "number" ? brut.rappel_minutes : null;
  const rappel = arrondirRappel(rappelDemande, { toute_la_journee, heure });
  if (rappel.avertissement) avertissements.push(rappel.avertissement);

  let recurrence_frequence = FREQUENCES.includes(brut.recurrence_frequence as Enums<"frequence_recurrence">)
    ? (brut.recurrence_frequence as Enums<"frequence_recurrence">)
    : null;
  const recurrenceNonSupportee = texteOuNull(brut.recurrence_non_supportee, 60);
  if (recurrenceNonSupportee) {
    recurrence_frequence = null;
    avertissements.push(
      `Répétition « ${recurrenceNonSupportee} » non prise en charge : tâche créée sans répétition.`
    );
  }
  if (recurrence_frequence && !echeance) {
    recurrence_frequence = null;
    avertissements.push("Répétition ignorée : elle a besoin d'une date de départ.");
  }

  let recurrence_fin = recurrence_frequence ? texteOuNull(brut.recurrence_fin, 10) : null;
  if (recurrence_fin && (!estDateValide(recurrence_fin) || (echeance && recurrence_fin < echeance))) {
    avertissements.push("Fin de répétition ignorée : date invalide.");
    recurrence_fin = null;
  }

  const texteNormalise = normaliserTexte(ctx.texte);

  // Liste : correspondance sans accents ni casse ; sinon création à la
  // validation (jamais dans l'aperçu). Une liste n'est retenue que si Vincent
  // la nomme (sinon « acheter » finissait dans « Trucs à acheter »). Sans
  // liste citée : celle des Réglages, sinon une liste « Tâches » (existante
  // ou à créer).
  const listeProposee = texteOuNull(brut.liste, MAX_NOM);
  const listeDemandee = listeProposee && estCite(listeProposee, texteNormalise) ? listeProposee : null;
  let listeId: string | null = null;
  let nouvelleListe: string | null = null;
  let listeNom: string;
  const listeExistante = listeDemandee
    ? ctx.listes.find((l) => normaliserTexte(l.nom) === normaliserTexte(listeDemandee))
    : undefined;
  const listeParDefaut = ctx.listeParDefautId ? ctx.listes.find((l) => l.id === ctx.listeParDefautId) : undefined;
  const listeRepli = ctx.listes.find((l) => normaliserTexte(l.nom) === normaliserTexte(NOM_LISTE_REPLI));
  const listeChoisie = listeExistante ?? (listeDemandee ? undefined : (listeParDefaut ?? listeRepli));
  if (listeChoisie) {
    listeId = listeChoisie.id;
    listeNom = listeChoisie.nom;
  } else if (listeDemandee) {
    nouvelleListe = listeDemandee;
    listeNom = listeDemandee;
  } else {
    nouvelleListe = NOM_LISTE_REPLI;
    listeNom = NOM_LISTE_REPLI;
  }

  const tagIds: string[] = [];
  const nouveauxTags: string[] = [];
  const tagNoms: string[] = [];
  const dejaVus = new Set<string>();
  const tagsBruts = Array.isArray(brut.tags) ? brut.tags : [];
  for (const tagBrut of tagsBruts) {
    // Pas de virgule : `createTache` découpe les nouveaux tags sur ce signe.
    const nom = texteOuNull(typeof tagBrut === "string" ? tagBrut.replace(/[,#]/g, "") : null, MAX_NOM);
    // Un tag que Vincent n'a pas écrit est une déduction de Gemini : écarté.
    if (!nom || !estCite(nom, texteNormalise)) continue;
    const cle = normaliserTexte(nom);
    if (dejaVus.has(cle) || dejaVus.size >= MAX_TAGS) continue;
    dejaVus.add(cle);
    const existant = ctx.tags.find((t) => normaliserTexte(t.nom) === cle);
    if (existant) {
      tagIds.push(existant.id);
      tagNoms.push(existant.nom);
    } else {
      nouveauxTags.push(nom);
      tagNoms.push(nom);
    }
  }

  return {
    titre,
    echeance,
    heure,
    heure_fin,
    toute_la_journee,
    priorite,
    rappel_minutes: rappel.valeur,
    recurrence_frequence,
    recurrence_fin,
    listeId,
    nouvelleListe,
    listeNom,
    tagIds,
    nouveauxTags,
    tagNoms,
    avertissements,
  };
}

/** Revalide les tâches brutes de Gemini ; écarte celles sans titre. */
export function interpreterTaches(bruts: BrutTache[], ctx: ContexteTaches): TachePropose[] {
  return bruts.map((t) => interpreterTache(t, ctx)).filter((t): t is TachePropose => t !== null);
}

export function lignesContexteTaches(ctx: ContexteTaches): string[] {
  return [
    `Listes existantes (JSON) : ${JSON.stringify(ctx.listes.map((l) => l.nom))}`,
    `Tags existants (JSON) : ${JSON.stringify(ctx.tags.map((t) => t.nom))}`,
  ];
}

export const REGLES_TACHES = [
  "- Une tâche par action distincte ; le titre est court, à l'infinitif ou nominal, sans la date ni l'heure.",
  "- Toutes les propriétés sont obligatoires : quand une information est absente du texte, mets une chaîne vide (0 pour `rappel_minutes`, une liste vide pour `tags`), jamais null.",
  "- `date` : AAAA-MM-JJ, tirée du calendrier ci-dessus. Sans jour cité, chaîne vide. Pour une répétition, `date` est la première occurrence.",
  "- `heure` et `heure_fin` : HH:MM en 24 h. Une durée (« 1h ») donne `heure_fin`. Une heure relative (« dans une heure », « dans 30 min ») se calcule à partir de l'heure actuelle indiquée ci-dessus, avec `date` d'aujourd'hui (ou du lendemain si on passe minuit). Sans heure citée, chaîne vide. `toute_la_journee` vaut true seulement si Vincent le dit.",
  "- `rappel_minutes` : minutes avant l'heure (« la veille » = 1440, « 2 h avant » = 120). Sans rappel demandé, 0.",
  "- `priorite` : aucune, basse, moyenne ou haute (« urgent » = haute). Sans indice, aucune.",
  "- Répétition : `recurrence_frequence` vaut quotidien, hebdomadaire, mensuel ou annuel, sinon chaîne vide. Tout autre rythme (« tous les 15 jours ») : `recurrence_frequence` vide et `recurrence_non_supportee` reprend l'expression citée (sinon vide). `recurrence_fin` : AAAA-MM-JJ si une fin est citée, sinon chaîne vide.",
  "- `liste` : seulement si Vincent nomme une liste dans sa phrase (reprends l'orthographe d'une liste existante si elle correspond), sinon chaîne vide : ne la déduis jamais du sens (« acheter » ne veut pas dire une liste d'achats). `tags` : seulement ceux qu'il écrit, jamais déduits.",
  "- « Rappelle-moi … » est toujours UNE tâche (`taches`) avec son heure et son rappel, même si l'objet ressemble à un achat : n'alimente alors aucun autre tableau.",
] as const;

export const CAS_QUESTION_TACHES = [
  "un jour de la semaine cité qui est aujourd'hui (« jeudi » un jeudi)",
  "un rappel demandé sans heure",
  "une heure ambiguë matin/soir (« 8h »)",
  "aucun titre reconnaissable",
] as const;
