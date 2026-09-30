import type { Enums } from "@/lib/supabase/types";
import { normaliserTexte, texteOuNull } from "@/lib/saisie-ia/outils";

// Module Notes de « Ajouter avec l'IA » : logique pure (aucun réseau, aucune
// base). Gemini propose une note (texte ou checklist), ce module la revalide
// avant l'aperçu comme avant la création.

export const MAX_NOTES_PROPOSEES = 3;
const MAX_TITRE = 100;
const MAX_CONTENU = 2000;
const MAX_ITEMS = 30;
const MAX_ITEM = 200;
const MAX_TAGS = 5;
const MAX_NOM_TAG = 40;

export type TagConnuNote = { id: string; nom: string };

export type NotePropose = {
  titre: string;
  type: Enums<"note_type">;
  /** Texte de la note ; vide pour une checklist (le contenu est dans `items`). */
  contenu: string;
  items: string[];
  tagIds: string[];
  nouveauxTags: string[];
  tagNoms: string[];
  avertissements: string[];
};

/** Tag ajouté d'office aux notes qui sont des idées (filtre `#idées` dans Notes). */
export const TAG_IDEES = "idées";

// Le modèle signale les idées (`idee`, y compris les tournures « et si »,
// « il faudrait »…) ; le mot « idée » en tête du titre suffit aussi, même sans
// ce signal.
function estIdee(brut: Record<string, unknown>, titre: string): boolean {
  return brut.idee === true || /^id[ée]es?\b/i.test(titre);
}

function interpreterNote(brut: Record<string, unknown>, tags: TagConnuNote[]): NotePropose | null {
  const titre = texteOuNull(brut.titre, MAX_TITRE);
  if (!titre) return null;

  const avertissements: string[] = [];
  const typeBrut: Enums<"note_type"> = brut.type === "checklist" ? "checklist" : "texte";

  const itemsBruts = Array.isArray(brut.items) ? brut.items : [];
  const items = itemsBruts
    .map((i) => texteOuNull(i, MAX_ITEM))
    .filter((i): i is string => i !== null)
    .slice(0, MAX_ITEMS);

  // Le contenu garde ses retours à la ligne (texteOuNull les aplatirait).
  const contenuBrut = typeof brut.contenu === "string" ? brut.contenu.replace(/\r\n/g, "\n").trim() : "";
  const contenu = contenuBrut.slice(0, MAX_CONTENU);

  // Une checklist sans item ou une note texte sans contenu ne se crée pas :
  // on bascule sur l'autre forme quand l'autre champ est renseigné, sinon la
  // note reprend son titre comme contenu (visible et modifiable).
  let type = typeBrut;
  if (type === "checklist" && items.length === 0) type = "texte";
  if (type === "texte" && !contenu && items.length > 0) type = "checklist";

  let contenuFinal = type === "texte" ? contenu : "";
  if (type === "texte" && !contenuFinal) {
    contenuFinal = titre;
    avertissements.push("Aucun contenu proposé : le titre sert de contenu, à compléter dans « Modifier ».");
  }

  const tagIds: string[] = [];
  const nouveauxTags: string[] = [];
  const tagNoms: string[] = [];
  const dejaVus = new Set<string>();
  // Le tag des idées est forcé ici, en tête (il passe donc avant le plafond),
  // plutôt que laissé au bon vouloir du modèle.
  const tagsBruts = [...(estIdee(brut, titre) ? [TAG_IDEES] : []), ...(Array.isArray(brut.tags) ? brut.tags : [])];
  for (const tagBrut of tagsBruts) {
    // Pas de virgule : `createNote` découpe les nouveaux tags sur ce signe.
    const nom = texteOuNull(typeof tagBrut === "string" ? tagBrut.replace(/[,#]/g, "") : null, MAX_NOM_TAG);
    if (!nom) continue;
    const cle = normaliserTexte(nom);
    if (dejaVus.has(cle) || dejaVus.size >= MAX_TAGS) continue;
    dejaVus.add(cle);
    const existant = tags.find((t) => normaliserTexte(t.nom) === cle);
    if (existant) {
      tagIds.push(existant.id);
      tagNoms.push(existant.nom);
    } else {
      nouveauxTags.push(nom);
      tagNoms.push(nom);
    }
  }

  return { titre, type, contenu: contenuFinal, items: type === "checklist" ? items : [], tagIds, nouveauxTags, tagNoms, avertissements };
}

/** Revalide les notes brutes de Gemini ; écarte celles sans titre. */
export function interpreterNotes(bruts: Record<string, unknown>[], tags: TagConnuNote[]): NotePropose[] {
  return bruts.map((n) => interpreterNote(n, tags)).filter((n): n is NotePropose => n !== null);
}

export function lignesContexteNotes(tags: TagConnuNote[]): string[] {
  return [`Tags de notes existants (JSON) : ${JSON.stringify(tags.map((t) => t.nom))}`];
}

export const REGLES_NOTES = [
  "- `notes` : seulement quand Vincent veut garder une information, une idée ou un mémo (« note », « idée », « à retenir », « mémo »), jamais pour une action à faire (tâche) ni pour un article à acheter (course).",
  "- Note : `idee` vaut true quand Vincent note une idée : le mot « idée » ou « piste », ou une tournure comme « et si », « il faudrait », « j'ai pensé à », « ce serait bien de » (une action précise avec échéance reste une tâche, un achat reste une course), sinon false. Ne mets pas toi-même le tag « idées » : il est ajouté automatiquement.",
  "- Note : `type` vaut texte ou checklist (checklist seulement pour une liste d'éléments à cocher qui n'est pas une liste de courses). `titre` court ; `contenu` reprend le texte à retenir pour le type texte, chaîne vide pour une checklist ; `items` liste les éléments d'une checklist, liste vide pour le type texte ; `tags` : seulement ceux cités.",
] as const;

export const CAS_QUESTION_NOTES = [] as const;
