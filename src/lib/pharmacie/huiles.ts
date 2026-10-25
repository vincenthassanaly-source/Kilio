import type { Tables } from "@/lib/supabase/types";
import { normalizeSearch } from "@/lib/normalize";

// Huiles essentielles : une table, lue en un seul instantané (quelques dizaines
// de fiches de texte court), mis en cache comme le référentiel (TanStack Query
// + copie Dexie pour le hors-ligne). Les cartes de révision des huiles vivent
// dans `pharma_cartes` (voir `genererCartesHuile`).
export type PharmaHuile = Tables<"pharma_he_huiles">;

export type HuilesSnapshot = {
  huiles: PharmaHuile[];
  /** ISO : moment de la lecture serveur (affiché quand on lit la copie locale). */
  genereLe: string;
};

/** « Comestible » n'est pas un champ : c'est la voie orale. */
export const VOIES = [
  { cle: "orale", libelle: "Orale (comestible)" },
  { cle: "cutanee", libelle: "Cutanée" },
  { cle: "diffusion", libelle: "Diffusion" },
  { cle: "inhalation", libelle: "Inhalation" },
  { cle: "bain", libelle: "Bain" },
] as const;

export const PRECAUTIONS = [
  { cle: "grossesse", libelle: "Grossesse" },
  { cle: "allaitement", libelle: "Allaitement" },
  { cle: "enfant", libelle: "Enfant" },
  { cle: "epilepsie", libelle: "Épilepsie" },
  { cle: "asthme", libelle: "Asthme" },
  { cle: "hypertension", libelle: "Hypertension" },
  { cle: "anticoagulants", libelle: "Anticoagulants" },
] as const;

const CLES_VOIES: readonly string[] = VOIES.map((v) => v.cle);
const CLES_PRECAUTIONS: readonly string[] = PRECAUTIONS.map((p) => p.cle);

export function libelleVoie(cle: string): string {
  return VOIES.find((v) => v.cle === cle)?.libelle ?? cle;
}

export function libellePrecaution(cle: string): string {
  return PRECAUTIONS.find((p) => p.cle === cle)?.libelle ?? cle;
}

export function estComestible(huile: Pick<PharmaHuile, "voies">): boolean {
  return huile.voies.includes("orale");
}

/** Seule la case « Grossesse » compte : l'allaitement est une précaution distincte. */
export function convientALaGrossesse(huile: Pick<PharmaHuile, "precautions">): boolean {
  return !huile.precautions.includes("grossesse");
}

/** Saisie du formulaire (ou du chat) : tout ce que l'utilisateur peut renseigner. */
export type HuileChamps = {
  nom_fr: string;
  nom_latin: string;
  famille: string;
  partie_distillee: string;
  chemotype: string;
  indications: string[];
  proprietes: string[];
  voies: string[];
  dermocaustique: boolean;
  photosensibilisante: boolean;
  precautions: string[];
  precautions_details: string;
  dosage: string;
  mode_emploi: string;
  notes: string;
  sources: string;
};

export type HuileValidee = Omit<PharmaHuile, "id" | "created_at" | "updated_at">;

const MAX_TAGS = 30;

function nettoyerTags(brut: string[]): string[] {
  const vus = new Set<string>();
  const propres: string[] = [];
  for (const t of brut) {
    const tag = t.trim().replace(/\s+/g, " ");
    const cle = normalizeSearch(tag);
    if (!tag || vus.has(cle)) continue;
    vus.add(cle);
    propres.push(tag);
  }
  return propres.slice(0, MAX_TAGS);
}

function nettoyerCles(brut: string[], autorisees: readonly string[]): string[] {
  return [...new Set(brut)].filter((c) => autorisees.includes(c));
}

function texteOuNull(valeur: string): string | null {
  const v = valeur.trim();
  return v ? v : null;
}

/** Validation et nettoyage communs aux actions de création et de modification. */
export function validerHuile(champs: HuileChamps): { ok: true; huile: HuileValidee } | { ok: false; erreur: string } {
  const nomFr = champs.nom_fr.trim();
  if (!nomFr) return { ok: false, erreur: "Le nom français est requis." };

  return {
    ok: true,
    huile: {
      nom_fr: nomFr,
      nom_latin: texteOuNull(champs.nom_latin),
      famille: texteOuNull(champs.famille),
      partie_distillee: texteOuNull(champs.partie_distillee),
      chemotype: texteOuNull(champs.chemotype),
      indications: nettoyerTags(champs.indications),
      proprietes: nettoyerTags(champs.proprietes),
      voies: nettoyerCles(champs.voies, CLES_VOIES),
      dermocaustique: champs.dermocaustique,
      photosensibilisante: champs.photosensibilisante,
      precautions: nettoyerCles(champs.precautions, CLES_PRECAUTIONS),
      precautions_details: texteOuNull(champs.precautions_details),
      dosage: texteOuNull(champs.dosage),
      mode_emploi: texteOuNull(champs.mode_emploi),
      notes: texteOuNull(champs.notes),
      sources: texteOuNull(champs.sources),
    },
  };
}

// ----------------------------------------------------------- Liste et filtres

const parNomFr = (a: PharmaHuile, b: PharmaHuile) => a.nom_fr.localeCompare(b.nom_fr, "fr");

function trierHuiles(huiles: PharmaHuile[]): PharmaHuile[] {
  return [...huiles].sort(parNomFr);
}

export type FiltresHuiles = {
  comestible: boolean;
  grossesse: boolean;
  indication: string | null;
};

export const AUCUN_FILTRE: FiltresHuiles = { comestible: false, grossesse: false, indication: null };

export function filtrerHuiles(huiles: PharmaHuile[], filtres: FiltresHuiles): PharmaHuile[] {
  const indication = filtres.indication ? normalizeSearch(filtres.indication) : null;
  return huiles.filter(
    (h) =>
      (!filtres.comestible || estComestible(h)) &&
      (!filtres.grossesse || convientALaGrossesse(h)) &&
      (!indication || h.indications.some((i) => normalizeSearch(i) === indication))
  );
}

/** Recherche tolérante aux accents : chaque mot doit se retrouver dans le nom, le latin, la famille ou les tags. */
export function rechercherHuiles(huiles: PharmaHuile[], requete: string): PharmaHuile[] {
  const mots = normalizeSearch(requete).split(/\s+/).filter((m) => m.length >= 2);
  if (mots.length === 0) return trierHuiles(huiles);

  return trierHuiles(
    huiles.filter((h) => {
      const botte = normalizeSearch(
        [h.nom_fr, h.nom_latin, h.famille, h.chemotype, ...h.indications, ...h.proprietes].filter(Boolean).join(" ")
      );
      return mots.every((m) => botte.includes(m));
    })
  );
}

/** Tags déjà saisis, du plus utilisé au moins utilisé : suggestions du formulaire et filtres. */
export function indicationsUtilisees(huiles: PharmaHuile[]): string[] {
  return tagsUtilises(huiles.flatMap((h) => h.indications));
}

export function proprietesUtilisees(huiles: PharmaHuile[]): string[] {
  return tagsUtilises(huiles.flatMap((h) => h.proprietes));
}

function tagsUtilises(tags: string[]): string[] {
  const compteurs = new Map<string, { libelle: string; nb: number }>();
  for (const tag of tags) {
    const cle = normalizeSearch(tag);
    const courant = compteurs.get(cle);
    if (courant) courant.nb += 1;
    else compteurs.set(cle, { libelle: tag, nb: 1 });
  }
  return [...compteurs.values()]
    .sort((a, b) => b.nb - a.nb || a.libelle.localeCompare(b.libelle, "fr"))
    .map((t) => t.libelle);
}

export function huileParId(snapshot: HuilesSnapshot, id: string): PharmaHuile | undefined {
  return snapshot.huiles.find((h) => h.id === id);
}

// ------------------------------------------------------------------- Cartes

type TypeCarteHuile = "latin" | "francais" | "indications" | "voies" | "precautions";
export type CarteHuile = { he_type: TypeCarteHuile; question: string; reponse: string };

function liste(elements: string[]): string {
  return elements.map((e) => `• ${e}`).join("\n");
}

/**
 * Cartes de révision d'une huile, toujours dérivées de sa fiche : une carte par
 * type, absente quand la fiche n'a rien à y mettre. L'action d'enregistrement
 * les synchronise (création, mise à jour du texte, suppression) en gardant
 * l'état de répétition des cartes qui subsistent.
 */
export function genererCartesHuile(
  huile: Pick<
    PharmaHuile,
    "nom_fr" | "nom_latin" | "indications" | "voies" | "precautions" | "precautions_details" | "dermocaustique" | "photosensibilisante"
  >
): CarteHuile[] {
  const cartes: CarteHuile[] = [];
  const nom = huile.nom_fr;

  if (huile.nom_latin) {
    cartes.push({ he_type: "latin", question: `Nom latin de l'huile essentielle de ${nom} ?`, reponse: huile.nom_latin });
    cartes.push({
      he_type: "francais",
      question: `Quelle huile essentielle porte le nom latin « ${huile.nom_latin} » ?`,
      reponse: nom,
    });
  }

  if (huile.indications.length > 0) {
    cartes.push({
      he_type: "indications",
      question: `À quoi sert l'huile essentielle de ${nom} ?`,
      reponse: liste(huile.indications),
    });
  }

  if (huile.voies.length > 0) {
    const comestible = estComestible(huile) ? "oui, par voie orale" : "non, pas de voie orale";
    cartes.push({
      he_type: "voies",
      question: `L'huile essentielle de ${nom} est-elle comestible, et par quelles voies s'utilise-t-elle ?`,
      reponse: `Comestible : ${comestible}\nVoies : ${huile.voies.map(libelleVoie).join(", ")}`,
    });
  }

  const lignes: string[] = [];
  if (huile.precautions.length > 0) lignes.push(`Déconseillée : ${huile.precautions.map(libellePrecaution).join(", ")}`);
  if (huile.dermocaustique) lignes.push("Dermocaustique : toujours diluée sur la peau");
  if (huile.photosensibilisante) lignes.push("Photosensibilisante : pas de soleil après application");
  if (huile.precautions_details) lignes.push(huile.precautions_details);
  if (lignes.length > 0) {
    cartes.push({
      he_type: "precautions",
      question: `Précautions et contre-indications de l'huile essentielle de ${nom} ?`,
      reponse: lignes.join("\n"),
    });
  }

  return cartes;
}
