// Saisie en langage naturel : fonctions pures. Le prompt, le schéma de réponse
// de Gemini et surtout la normalisation de sa réponse : Gemini ne décide de
// rien qui ne soit revérifié ici (liste existante, rappel autorisé, date et
// heure valides). Voir src/app/actions/saisie.ts pour l'appel.

import { calculerHeureFin, DUREE_EVENEMENT_PAR_DEFAUT, HEURE_REGEX } from "@/lib/evenements/compute";
import { RAPPEL_MINUTES_VALEURS } from "@/lib/taches/compute";

type TypeElement = "tache" | "evenement";
export type FrequenceSaisie = "quotidien" | "hebdomadaire" | "mensuel" | "annuel";
type OrigineRappel = "demande" | "defaut" | "arrondi";

export type ElementSaisie = {
  /** Clé React stable côté aperçu. */
  cle: string;
  type: TypeElement;
  titre: string;
  /** AAAA-MM-JJ, « » si non précisée. */
  date: string;
  /** HH:MM, « » si aucune. */
  heure: string;
  heureProposee: boolean;
  touteLaJournee: boolean;
  dureeMinutes: number | null;
  /** Tâches uniquement. */
  listeId: string;
  listeDeduite: boolean;
  tagIds: string[];
  nouveauxTags: string[];
  sousTaches: string[];
  rappelMinutes: number | null;
  rappelOrigine: OrigineRappel | null;
  frequence: FrequenceSaisie | "";
  finRecurrence: string;
  notes: string;
};

type ListeRef = { id: string; nom: string };
type TagRef = { id: string; nom: string };

export type ContexteSaisie = {
  aujourdhui: string;
  heure: string;
  listes: ListeRef[];
  tags: TagRef[];
};

export const LONGUEUR_MAX_SAISIE = 600;
const MAX_ELEMENTS = 10;
const MAX_SOUS_TACHES = 10;
const MAX_TAGS_NOUVEAUX = 3;
export const HEURE_PROPOSEE_PAR_DEFAUT = "09:00";
const FREQUENCES: readonly FrequenceSaisie[] = ["quotidien", "hebdomadaire", "mensuel", "annuel"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const REGEX_DATE = /^\d{4}-\d{2}-\d{2}$/;

// --- Dates --------------------------------------------------------------------

function dateUtc(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

function dateValide(valeur: unknown): valeur is string {
  if (typeof valeur !== "string" || !REGEX_DATE.test(valeur)) return false;
  return dateUtc(valeur).toISOString().slice(0, 10) === valeur;
}

export function ajouterJours(iso: string, n: number): string {
  const d = dateUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function jourSemaine(iso: string): string {
  return JOURS[dateUtc(iso).getUTCDay()];
}

// --- Rappels ------------------------------------------------------------------

/** Valeur autorisée la plus proche ; à égalité, le délai le plus long. */
export function arrondirRappel(minutes: number): number {
  let meilleure: number = RAPPEL_MINUTES_VALEURS[0];
  for (const v of RAPPEL_MINUTES_VALEURS) {
    const ecart = Math.abs(v - minutes);
    const ecartMeilleure = Math.abs(meilleure - minutes);
    if (ecart < ecartMeilleure || (ecart === ecartMeilleure && v > meilleure)) meilleure = v;
  }
  return meilleure;
}

export function libelleRappel(minutes: number, touteLaJournee = false): string {
  if (minutes === 0) return "À l'heure";
  if (minutes === 1440) return touteLaJournee ? "La veille à 18 h" : "La veille";
  if (minutes === 60) return "1 h avant";
  return `${minutes} min avant`;
}

// --- Prompt et schéma ---------------------------------------------------------

export const SCHEMA_SAISIE = {
  type: "OBJECT",
  properties: {
    elements: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["tache", "evenement"] },
          titre: { type: "STRING" },
          date: { type: "STRING" },
          heure: { type: "STRING" },
          heure_proposee: { type: "BOOLEAN" },
          toute_la_journee: { type: "BOOLEAN" },
          duree_minutes: { type: "INTEGER" },
          liste_id: { type: "STRING" },
          tags: { type: "ARRAY", items: { type: "STRING" } },
          nouveaux_tags: { type: "ARRAY", items: { type: "STRING" } },
          sous_taches: { type: "ARRAY", items: { type: "STRING" } },
          rappel_demande: { type: "BOOLEAN" },
          rappel_delai_minutes: { type: "INTEGER" },
          recurrence: { type: "STRING", enum: ["aucune", ...FREQUENCES] },
          recurrence_fin: { type: "STRING" },
          notes: { type: "STRING" },
        },
        required: [
          "type",
          "titre",
          "date",
          "heure",
          "heure_proposee",
          "toute_la_journee",
          "duree_minutes",
          "liste_id",
          "tags",
          "nouveaux_tags",
          "sous_taches",
          "rappel_demande",
          "rappel_delai_minutes",
          "recurrence",
          "recurrence_fin",
          "notes",
        ],
      },
    },
  },
  required: ["elements"],
};

export function construirePrompt(texte: string, ctx: ContexteSaisie): string {
  // Calendrier déjà calculé : un modèle « lite » se trompe sur « jeudi
  // prochain » ou « dans 10 jours » s'il doit faire l'arithmétique lui-même.
  const calendrier = Array.from({ length: 15 }, (_, i) => {
    const iso = ajouterJours(ctx.aujourdhui, i);
    const repere = i === 0 ? " (aujourd'hui)" : i === 1 ? " (demain)" : i === 2 ? " (après-demain)" : "";
    return `- ${jourSemaine(iso)} ${iso}${repere}`;
  });
  const listes = ctx.listes.length ? ctx.listes.map((l) => `- ${l.id} | ${l.nom}`) : ["- (aucune)"];
  const tags = ctx.tags.length ? ctx.tags.map((t) => t.nom).join(", ") : "(aucun)";
  return [
    "Tu transformes une phrase en français en tâches et événements pour un agenda personnel.",
    `Nous sommes le ${jourSemaine(ctx.aujourdhui)} ${ctx.aujourdhui}, il est ${ctx.heure} (heure de Paris).`,
    "Calendrier des prochains jours :",
    ...calendrier,
    "Listes de tâches existantes (id | nom) :",
    ...listes,
    `Tags existants : ${tags}`,
    "",
    "Règles :",
    '- Un élément par chose à faire. Un rendez-vous, une réunion ou une activité à heure fixe est un "evenement" ; le reste est une "tache".',
    '- "date" : AAAA-MM-JJ d\'après le calendrier ci-dessus, ou "" si la phrase ne donne aucune date. Ne devine jamais une date.',
    '- "heure" : HH:MM (24 h). Si la phrase donne une heure, recopie-la et mets heure_proposee à false. Si elle n\'en donne pas mais qu\'il y a une date, choisis une heure plausible d\'après le sujet (appel ou démarche en milieu de matinée, sport en fin de journée, courses en fin d\'après-midi…) et mets heure_proposee à true. Sans date, mets "" et false.',
    '- toute_la_journee à true seulement pour une journée entière (anniversaire, jour férié, voyage) ; alors heure vaut "".',
    '- "duree_minutes" : durée annoncée en minutes, sinon 0.',
    '- "liste_id" : l\'id d\'UNE des listes ci-dessus qui correspond au sujet d\'une tâche, ou "" si aucune ne convient. N\'invente jamais d\'id. "" pour un événement.',
    '- "tags" : noms de tags existants qui correspondent. "nouveaux_tags" : uniquement les tags que la phrase écrit explicitement (#nom ou « tag nom »).',
    '- "sous_taches" : seulement si la phrase énumère des étapes d\'une même tâche ; sinon [].',
    '- rappel_demande à true seulement si la phrase demande un rappel (« rappelle-moi », « préviens-moi »…). rappel_delai_minutes : le délai demandé avant l\'heure, converti en minutes (2 h = 120, la veille = 1440), 0 si « à l\'heure » ou non précisé.',
    '- "recurrence" : aucune, quotidien, hebdomadaire, mensuel ou annuel (« tous les lundis » = hebdomadaire). "recurrence_fin" : AAAA-MM-JJ si une fin est donnée, sinon "".',
    '- "notes" : détail utile qui ne tient pas dans le titre, sinon "". Le titre est court, sans la date ni l\'heure.',
    "- Ne renvoie rien pour ce qui n'est ni une tâche ni un événement.",
    "",
    `Phrase : """${texte}"""`,
  ].join("\n");
}

// --- Normalisation ------------------------------------------------------------

type Brut = Record<string, unknown>;

function texte(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function liste(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function entier(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
}

function normaliserNom(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function listeParDefaut(listes: ListeRef[]): string {
  return (listes.find((l) => normaliserNom(l.nom) === "general") ?? listes[0])?.id ?? "";
}

function normaliserElement(brut: Brut, index: number, ctx: ContexteSaisie): ElementSaisie | null {
  const titre = texte(brut.titre, 200);
  if (!titre) return null;
  const type: TypeElement = brut.type === "evenement" ? "evenement" : "tache";
  const touteLaJournee = brut.toute_la_journee === true;

  const date = dateValide(brut.date) ? brut.date : "";
  let heure = typeof brut.heure === "string" && HEURE_REGEX.test(brut.heure.trim()) ? brut.heure.trim() : "";
  let heureProposee = brut.heure_proposee === true && heure !== "";

  if (touteLaJournee) {
    heure = "";
    heureProposee = false;
  } else if (type === "tache" && !date) {
    // Une heure sans date n'a pas de sens pour une tâche : pas de devinette.
    heure = "";
    heureProposee = false;
  } else if (date && !heure) {
    heure = HEURE_PROPOSEE_PAR_DEFAUT;
    heureProposee = true;
  }

  let dureeMinutes: number | null = null;
  const dureeBrute = entier(brut.duree_minutes);
  if (type === "evenement") {
    dureeMinutes = dureeBrute >= 1 && dureeBrute < 1440 ? dureeBrute : DUREE_EVENEMENT_PAR_DEFAUT;
    if (!touteLaJournee && heure) {
      const candidates = [dureeMinutes, 60, 30, 15];
      const ok = candidates.find((d) => calculerHeureFin(heure, d) !== null);
      if (ok === undefined) {
        heure = "23:00";
        dureeMinutes = 30;
      } else {
        dureeMinutes = ok;
      }
    }
  } else if (dureeBrute >= 1 && dureeBrute <= 1440) {
    dureeMinutes = dureeBrute;
  }

  let listeId = "";
  let listeDeduite = false;
  let tagIds: string[] = [];
  let nouveauxTags: string[] = [];
  let sousTaches: string[] = [];
  if (type === "tache") {
    const idListe = texte(brut.liste_id, 80);
    if (ctx.listes.some((l) => l.id === idListe)) {
      listeId = idListe;
      listeDeduite = true;
    } else {
      listeId = listeParDefaut(ctx.listes);
    }

    const parNom = new Map(ctx.tags.map((t) => [normaliserNom(t.nom), t.id]));
    const ids = new Set<string>();
    const nouveaux = new Set<string>();
    for (const nom of liste(brut.tags)) {
      const id = parNom.get(normaliserNom(nom));
      if (id) ids.add(id);
    }
    for (const nomBrut of liste(brut.nouveaux_tags)) {
      const nom = nomBrut.replace(/[,#]/g, "").trim().slice(0, 40);
      if (!nom) continue;
      const id = parNom.get(normaliserNom(nom));
      if (id) ids.add(id);
      else if (nouveaux.size < MAX_TAGS_NOUVEAUX) nouveaux.add(nom);
    }
    tagIds = [...ids];
    nouveauxTags = [...nouveaux];
    sousTaches = liste(brut.sous_taches)
      .map((s) => s.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, MAX_SOUS_TACHES);
  }

  let rappelMinutes: number | null = null;
  let rappelOrigine: OrigineRappel | null = null;
  const demande = brut.rappel_demande === true;
  const delai = Math.max(0, entier(brut.rappel_delai_minutes));
  if (touteLaJournee) {
    // Journée entière : seule « la veille » existe, et jamais par défaut.
    if (demande) {
      rappelMinutes = 1440;
      rappelOrigine = delai === 1440 ? "demande" : "arrondi";
    }
  } else if (heure) {
    if (demande) {
      rappelMinutes = arrondirRappel(delai);
      rappelOrigine = rappelMinutes === delai ? "demande" : "arrondi";
    } else {
      rappelMinutes = 0;
      rappelOrigine = "defaut";
    }
  }

  const frequence = FREQUENCES.find((f) => f === brut.recurrence) ?? "";
  const fin = dateValide(brut.recurrence_fin) ? brut.recurrence_fin : "";
  const finRecurrence = frequence && fin && (!date || fin >= date) ? fin : "";

  return {
    cle: `saisie-${index}`,
    type,
    titre,
    date,
    heure,
    heureProposee,
    touteLaJournee,
    dureeMinutes,
    listeId,
    listeDeduite,
    tagIds,
    nouveauxTags,
    sousTaches,
    rappelMinutes,
    rappelOrigine,
    frequence,
    finRecurrence,
    notes: texte(brut.notes, 1000),
  };
}

/** `null` si la réponse n'a pas la forme attendue ; sinon les éléments exploitables (peut être vide). */
export function normaliserReponse(brut: unknown, ctx: ContexteSaisie): ElementSaisie[] | null {
  const elements = (brut as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) return null;
  return elements
    .slice(0, MAX_ELEMENTS)
    .map((e, i) => (e && typeof e === "object" ? normaliserElement(e as Brut, i, ctx) : null))
    .filter((e): e is ElementSaisie => e !== null);
}

// --- Validation et conversion avant création ---------------------------------

/** Message d'erreur du premier champ requis manquant, ou `null`. */
export function erreurElement(e: ElementSaisie): string | null {
  if (!e.titre.trim()) return "Le titre est requis.";
  if (e.type === "evenement") {
    if (!e.date) return "La date est requise pour un événement.";
    if (!e.touteLaJournee && !e.heure) return "L'heure est requise pour un événement.";
  } else if (!e.listeId) {
    return "Aucune liste de tâches disponible.";
  }
  return null;
}

/** Champs du formulaire attendus par `createTache`. */
export function formDataTache(e: ElementSaisie): FormData {
  const f = new FormData();
  f.set("titre", e.titre.trim());
  f.set("liste_id", e.listeId);
  if (e.date) f.set("echeance", e.date);
  if (e.touteLaJournee) f.set("toute_la_journee", "on");
  else if (e.heure) f.set("heure", e.heure);
  if (e.dureeMinutes) f.set("duree_minutes", String(e.dureeMinutes));
  if (e.rappelMinutes !== null) f.set("rappel_minutes", String(e.rappelMinutes));
  if (e.frequence) {
    f.set("recurrence_frequence", e.frequence);
    if (e.finRecurrence) f.set("recurrence_fin", e.finRecurrence);
  }
  if (e.notes) f.set("notes", e.notes);
  for (const id of e.tagIds) f.append("tag_ids", id);
  if (e.nouveauxTags.length) f.set("nouveaux_tags", e.nouveauxTags.join(","));
  return f;
}

/** Entrée de `createEvenement`. */
export function inputEvenement(e: ElementSaisie) {
  return {
    titre: e.titre.trim(),
    date: e.date,
    heure: e.heure,
    dureeMinutes: e.dureeMinutes ?? DUREE_EVENEMENT_PAR_DEFAUT,
    notes: e.notes || null,
    toute_la_journee: e.touteLaJournee,
    rappelMinutes: e.rappelMinutes,
    recurrenceFrequence: e.frequence || null,
    recurrenceFin: e.frequence ? e.finRecurrence || null : null,
  };
}
