import type { Enums } from "@/lib/supabase/types";
import { RAPPEL_MINUTES_VALEURS } from "./compute";

// Saisie de tâches en langage naturel : logique pure (aucun réseau, aucune
// base) partagée par l'action serveur et testée seule. Gemini propose, ce
// module vérifie : rien de ce qu'il renvoie n'atteint la base ni l'aperçu
// sans être revalidé ici (dates, heures, énumérations, rappels permis).

export const MAX_QUESTIONS = 2;
export const MAX_TEXTE = 500;
export const MAX_TACHES = 8;
const MAX_TITRE = 200;
const MAX_TAGS = 5;
const MAX_NOM = 40;
const MAX_CHOIX = 4;
const MAX_CHOIX_LONGUEUR = 40;

const PRIORITES: readonly Enums<"priorite_tache">[] = ["aucune", "basse", "moyenne", "haute"];
const FREQUENCES: readonly Enums<"frequence_recurrence">[] = ["quotidien", "hebdomadaire", "mensuel", "annuel"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Le formulaire propose 5 min dès qu'une heure est saisie : la saisie
// naturelle applique le même défaut, visible et modifiable dans l'aperçu.
const RAPPEL_PAR_DEFAUT_MINUTES = 5;

export type ListeConnue = { id: string; nom: string };
export type TagConnu = { id: string; nom: string };

export type ContexteSaisie = {
  /** Date du jour à Paris, `AAAA-MM-JJ`. */
  aujourdhui: string;
  listes: ListeConnue[];
  tags: TagConnu[];
};

export type PrecisionDonnee = { question: string; reponse: string };

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

export type ResultatInterpretation =
  | { statut: "taches"; taches: TachePropose[] }
  | { statut: "question"; question: string; choix: string[] }
  | { statut: "vide" };

export function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function estDateValide(valeur: string): boolean {
  if (!DATE_REGEX.test(valeur)) return false;
  const date = new Date(`${valeur}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valeur;
}

function texteOuNull(valeur: unknown, max: number): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.replace(/\s+/g, " ").trim();
  return propre ? propre.slice(0, max) : null;
}

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

function interpreterTache(brut: BrutTache, ctx: ContexteSaisie): TachePropose | null {
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

  // Liste : correspondance sans accents ni casse ; sinon création à la
  // validation (jamais dans l'aperçu). Sans liste citée, la première liste
  // (celle que le formulaire présélectionne).
  const listeDemandee = texteOuNull(brut.liste, MAX_NOM);
  let listeId: string | null = null;
  let nouvelleListe: string | null = null;
  let listeNom: string;
  const listeExistante = listeDemandee
    ? ctx.listes.find((l) => normaliserTexte(l.nom) === normaliserTexte(listeDemandee))
    : undefined;
  if (listeExistante) {
    listeId = listeExistante.id;
    listeNom = listeExistante.nom;
  } else if (listeDemandee) {
    nouvelleListe = listeDemandee;
    listeNom = listeDemandee;
  } else if (ctx.listes[0]) {
    listeId = ctx.listes[0].id;
    listeNom = ctx.listes[0].nom;
  } else {
    nouvelleListe = "Tâches";
    listeNom = "Tâches";
  }

  const tagIds: string[] = [];
  const nouveauxTags: string[] = [];
  const tagNoms: string[] = [];
  const dejaVus = new Set<string>();
  const tagsBruts = Array.isArray(brut.tags) ? brut.tags : [];
  for (const tagBrut of tagsBruts) {
    // Pas de virgule : `createTache` découpe les nouveaux tags sur ce signe.
    const nom = texteOuNull(typeof tagBrut === "string" ? tagBrut.replace(/[,#]/g, "") : null, MAX_NOM);
    if (!nom) continue;
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

/**
 * Transforme la réponse JSON de Gemini en résultat fiable. Une question n'est
 * retenue que si le quota de questions n'est pas épuisé (`questionsRestantes`)
 * ; sinon Gemini est censé avoir tranché, et seules les tâches comptent.
 */
export function interpreterReponse(
  brut: unknown,
  ctx: ContexteSaisie,
  questionsRestantes: number
): ResultatInterpretation {
  if (typeof brut !== "object" || brut === null) return { statut: "vide" };
  const { question, taches } = brut as { question?: unknown; taches?: unknown };

  const listeTaches = Array.isArray(taches)
    ? taches
        .filter((t): t is BrutTache => typeof t === "object" && t !== null)
        .slice(0, MAX_TACHES)
        .map((t) => interpreterTache(t, ctx))
        .filter((t): t is TachePropose => t !== null)
    : [];

  if (questionsRestantes > 0 && typeof question === "object" && question !== null) {
    const { texte, choix } = question as { texte?: unknown; choix?: unknown };
    const texteQuestion = texteOuNull(texte, 200);
    if (texteQuestion) {
      const choixValides = Array.isArray(choix)
        ? choix
            .map((c) => texteOuNull(c, MAX_CHOIX_LONGUEUR))
            .filter((c): c is string => c !== null)
            .slice(0, MAX_CHOIX)
        : [];
      return { statut: "question", question: texteQuestion, choix: choixValides };
    }
  }

  if (listeTaches.length === 0) return { statut: "vide" };
  return { statut: "taches", taches: listeTaches };
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function nomDuJour(dateIso: string): string {
  return JOURS[new Date(`${dateIso}T12:00:00Z`).getUTCDay()];
}

function ajouterJours(dateIso: string, jours: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

/**
 * Prompt de la saisie naturelle. Le calendrier des 14 prochains jours est
 * fourni tel quel : un petit modèle se trompe souvent sur « jeudi prochain »
 * quand on lui demande de calculer, jamais quand on lui donne la table.
 */
export function construirePrompt(input: {
  texte: string;
  precisions: PrecisionDonnee[];
  ctx: ContexteSaisie;
}): string {
  const { texte, precisions, ctx } = input;
  const questionsRestantes = Math.max(0, MAX_QUESTIONS - precisions.length);

  const calendrier = Array.from({ length: 14 }, (_, i) => {
    const date = ajouterJours(ctx.aujourdhui, i);
    return `${nomDuJour(date)} ${date}${i === 0 ? " (aujourd'hui)" : i === 1 ? " (demain)" : ""}`;
  }).join(", ");

  const lignes = [
    "Tu transformes une phrase de Vincent en tâches pour son app personnelle Kilio (fuseau Europe/Paris).",
    "",
    `Calendrier : ${calendrier}.`,
    `Listes existantes (JSON) : ${JSON.stringify(ctx.listes.map((l) => l.nom))}`,
    `Tags existants (JSON) : ${JSON.stringify(ctx.tags.map((t) => t.nom))}`,
    "",
    `Texte de Vincent : ${JSON.stringify(texte)}`,
  ];

  if (precisions.length > 0) {
    lignes.push("", "Précisions déjà obtenues (ne repose jamais ces questions) :");
    for (const p of precisions) {
      lignes.push(`- Question : ${JSON.stringify(p.question)} → Réponse : ${JSON.stringify(p.reponse)}`);
    }
  }

  lignes.push(
    "",
    "Règles :",
    "- Une tâche par action distincte ; le titre est court, à l'infinitif ou nominal, sans la date ni l'heure.",
    "- `date` : AAAA-MM-JJ, tirée du calendrier ci-dessus. Sans jour cité, null. Pour une répétition, `date` est la première occurrence.",
    "- `heure` et `heure_fin` : HH:MM en 24 h. Une durée (« 1h ») donne `heure_fin`. Sans heure citée, null. `toute_la_journee` vaut true seulement si Vincent le dit.",
    "- `rappel_minutes` : minutes avant l'heure (« la veille » = 1440, « 2 h avant » = 120). Sans rappel demandé, null.",
    "- `priorite` : aucune, basse, moyenne ou haute (« urgent » = haute). Sans indice, aucune.",
    "- Répétition : `recurrence_frequence` seulement pour quotidien, hebdomadaire, mensuel, annuel. Tout autre rythme (« tous les 15 jours ») : `recurrence_frequence` null et `recurrence_non_supportee` reprend l'expression citée.",
    "- `liste` : nom cité par Vincent (reprends l'orthographe d'une liste existante si elle correspond), sinon null. `tags` : seulement ceux cités.",
    "- N'invente aucune information absente du texte."
  );

  if (questionsRestantes > 0) {
    lignes.push(
      `- Tu peux poser UNE question de précision (il te reste ${questionsRestantes} question(s)), uniquement dans ces cas : (1) un jour de la semaine cité qui est aujourd'hui (« jeudi » un jeudi) ; (2) un rappel demandé sans heure ; (3) une heure ambiguë matin/soir (« 8h ») ; (4) aucun titre reconnaissable. Dans tous les autres cas, tranche sans demander.`,
      "- Pour poser une question : remplis `question` (`texte` court, `choix` de 2 à 4 réponses courtes) et laisse `taches` vide. Sinon `question` vaut null."
    );
  } else {
    lignes.push(
      "- Tu ne peux plus poser de question : choisis l'interprétation la plus probable. `question` vaut null."
    );
  }

  return lignes.join("\n");
}
