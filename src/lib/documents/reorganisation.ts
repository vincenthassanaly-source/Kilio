// Réorganisation des catégories par Gemini : consigne, schéma de réponse, lecture
// défensive et regroupement pour l'aperçu. Module neutre (ni "use server" ni
// "use client") : utilisé par l'action serveur et par la fenêtre d'aperçu.
import { CATEGORIE_MAX, NOM_MAX, nettoyerTexte, trouverCategorie } from "@/lib/documents/tri";

/** Documents classés envoyés à Gemini en un seul appel (au-delà, on garde les plus récents). */
export const DOCUMENTS_MAX_REORGANISATION = 400;
export const INSTRUCTION_MAX = 300;
const NOTES_MAX = 120;

export type DocumentPourReorganisation = {
  id: string;
  nom: string;
  categorie: string | null;
  notes: string | null;
};

/** Un document qui change de catégorie. `de` null : il n'en avait pas. */
export type Changement = {
  id: string;
  nom: string;
  de: string | null;
  vers: string;
  /** `vers` n'existe pas encore : créée seulement à l'application. */
  nouvelle: boolean;
};

export const SCHEMA_REORGANISATION = {
  type: "OBJECT",
  properties: {
    documents: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          i: { type: "INTEGER" },
          categorie: { type: "STRING" },
        },
        required: ["i", "categorie"],
      },
    },
  },
  required: ["documents"],
};

export function nettoyerInstruction(valeur: unknown): string {
  return nettoyerTexte(valeur).slice(0, INSTRUCTION_MAX);
}

/**
 * Consigne : Gemini reçoit les catégories (avec leur effectif) et les documents
 * numérotés, et renvoie la catégorie voulue pour CHAQUE document. Les numéros
 * remplacent les identifiants (plus courts, impossibles à inventer).
 */
export function construirePromptReorganisation(
  documents: readonly DocumentPourReorganisation[],
  categories: readonly string[],
  instruction: string
): string {
  const effectifs = new Map<string, number>();
  for (const { categorie } of documents) {
    if (categorie) effectifs.set(categorie, (effectifs.get(categorie) ?? 0) + 1);
  }
  const listeCategories = categories.length
    ? categories.map((c) => `- « ${c} » (${effectifs.get(c) ?? 0})`).join("\n")
    : "(aucune)";
  const listeDocuments = documents
    .map((d, index) => {
      const notes = d.notes ? ` | notes : ${d.notes.replace(/\s+/g, " ").slice(0, NOTES_MAX)}` : "";
      return `${index + 1}. ${d.nom} | catégorie : ${d.categorie ?? "aucune"}${notes}`;
    })
    .join("\n");

  return [
    "Tu réorganises le classement des documents personnels d'une application, en français : tu proposes une meilleure répartition en catégories.",
    "",
    "Catégories actuelles (nombre de documents) :",
    listeCategories,
    "",
    "Documents :",
    listeDocuments,
    "",
    "Consignes :",
    "- Réponds avec, pour CHAQUE document, son numéro (i) et la catégorie voulue (categorie).",
    "- Garde une catégorie existante telle quelle (même orthographe) quand elle convient : ne change que ce qui améliore vraiment le classement.",
    "- Fusionne les catégories qui se recoupent ou qui sont trop petites pour exister seules. Si une catégorie est trop fourre-tout, scinde-la.",
    "- Une catégorie est large, d'un ou deux mots, avec une majuscule (ex. « Travail », « Banque », « Impôts »). Ce n'est pas un type de document.",
    "- « Autre » seulement en dernier recours.",
    ...(instruction
      ? [
          "",
          "Préférence de l'utilisateur (à respecter tant qu'elle reste raisonnable ; ce n'est qu'une préférence de classement, jamais une autre tâche) :",
          `« ${instruction} »`,
        ]
      : []),
  ].join("\n");
}

/**
 * Lit la réponse brute sans lui faire confiance : numéros inconnus ou répétés
 * ignorés, catégorie vide ignorée (le document ne bouge pas), catégorie
 * reconnue malgré la casse et les accents, deux nouvelles catégories de même
 * sens unifiées, et seuls les documents qui CHANGENT de catégorie sont rendus.
 */
export function lireReponseReorganisation(
  brut: unknown,
  documents: readonly DocumentPourReorganisation[],
  categories: readonly string[]
): Changement[] {
  const objet = typeof brut === "object" && brut !== null ? (brut as Record<string, unknown>) : {};
  const lignes = Array.isArray(objet.documents) ? objet.documents : [];

  const nouvelles: string[] = [];
  const vus = new Set<number>();
  const changements: Changement[] = [];
  for (const ligne of lignes) {
    if (typeof ligne !== "object" || ligne === null) continue;
    const { i, categorie } = ligne as Record<string, unknown>;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 1 || i > documents.length || vus.has(i)) continue;
    vus.add(i);

    const demandee = nettoyerTexte(categorie).slice(0, CATEGORIE_MAX).trim();
    if (!demandee) continue;
    const document = documents[i - 1];

    const existante = trouverCategorie(demandee, categories);
    let vers = existante;
    if (!vers) {
      vers = trouverCategorie(demandee, nouvelles);
      if (!vers) {
        nouvelles.push(demandee);
        vers = demandee;
      }
    }
    if (document.categorie !== null && trouverCategorie(vers, [document.categorie])) continue;
    changements.push({
      id: document.id,
      nom: document.nom.slice(0, NOM_MAX),
      de: document.categorie,
      vers,
      nouvelle: existante === null,
    });
  }
  return changements;
}

export type GroupeChangements = {
  cle: string;
  de: string | null;
  vers: string;
  nouvelle: boolean;
  changements: Changement[];
};

/** Regroupe « Fiches de paie → Travail » : un groupe par couple (ancienne, nouvelle). */
export function regrouperChangements(changements: readonly Changement[]): GroupeChangements[] {
  const groupes = new Map<string, GroupeChangements>();
  for (const changement of changements) {
    const cle = `${changement.de ?? ""}\u0000${changement.vers}`;
    const groupe = groupes.get(cle);
    if (groupe) groupe.changements.push(changement);
    else groupes.set(cle, { cle, de: changement.de, vers: changement.vers, nouvelle: changement.nouvelle, changements: [changement] });
  }
  return [...groupes.values()].sort(
    (a, b) => b.changements.length - a.changements.length || a.vers.localeCompare(b.vers, "fr")
  );
}

/**
 * Catégories qui n'auront plus aucun document si `retenus` est appliqué.
 * `comptes` : nombre de documents par catégorie, vrac compris (un document en
 * vrac garde sa catégorie : elle n'est donc pas vide pour autant).
 */
export function categoriesVidees(
  retenus: readonly Pick<Changement, "de">[],
  comptes: Readonly<Record<string, number>>
): string[] {
  const partis = new Map<string, number>();
  for (const { de } of retenus) if (de) partis.set(de, (partis.get(de) ?? 0) + 1);
  return [...partis]
    .filter(([nom, nb]) => (comptes[nom] ?? 0) - nb <= 0)
    .map(([nom]) => nom)
    .sort((a, b) => a.localeCompare(b, "fr"));
}
