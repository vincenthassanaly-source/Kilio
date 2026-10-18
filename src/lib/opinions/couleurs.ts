// Couleurs du module Opinions : identité d'un parti, teinte d'un thème, mots-clés
// d'une proposition. Module neutre (serveur et client), sans dépendance à React.
//
// Règle de neutralité : une couleur distingue, elle ne juge jamais. Aucune teinte
// n'est associée à « bon » ou « mauvais », et aucune ne dépend d'un score.
import type { Theme } from "./types";

// --- Couleur d'un parti ------------------------------------------------------------

// Noms de teintes (pas de noms de camps). Les valeurs sont les variables CSS
// `--parti-<nom>` de globals.css, réglées pour le clair et le sombre.
export const COULEURS_PARTI = [
  "indigo",
  "corail",
  "olive",
  "prune",
  "turquoise",
  "ambre",
  "ardoise",
  "rose",
  "vert",
  "violet",
] as const;
export type CouleurParti = (typeof COULEURS_PARTI)[number];

export const LIBELLE_COULEUR: Record<CouleurParti, string> = {
  indigo: "Indigo",
  corail: "Corail",
  olive: "Olive",
  prune: "Prune",
  turquoise: "Turquoise",
  ambre: "Ambre",
  ardoise: "Ardoise",
  rose: "Rose",
  vert: "Vert",
  violet: "Violet",
};

export function estCouleur(valeur: unknown): valeur is CouleurParti {
  return typeof valeur === "string" && (COULEURS_PARTI as readonly string[]).includes(valeur);
}

/** Lecture tolérante : une couleur inconnue devient la première de la palette. */
export function couleurOuDefaut(valeur: unknown): CouleurParti {
  return estCouleur(valeur) ? valeur : COULEURS_PARTI[0];
}

/** La première teinte pas encore prise ; la palette recommence quand elle est épuisée. */
export function couleurSuivante(utilisees: readonly string[]): CouleurParti {
  const libre = COULEURS_PARTI.find((c) => !utilisees.includes(c));
  if (libre) return libre;
  const compte = (c: CouleurParti) => utilisees.filter((u) => u === c).length;
  return COULEURS_PARTI.reduce((meilleure, c) => (compte(c) < compte(meilleure) ? c : meilleure));
}

export function varCouleurParti(couleur: CouleurParti): string {
  return `var(--parti-${couleur})`;
}

// --- Teinte d'un thème -------------------------------------------------------------

// Une teinte douce par thème (`--theme-<slug>`), employée en pastille et en fond
// léger : jamais pour les marqueurs d'axes, réservés aux couleurs de parti.
export function varCouleurTheme(theme: Theme): string {
  return `var(--theme-${theme})`;
}

/** Fond léger (surlignage, étiquette) à partir d'une couleur CSS. */
export function fondLeger(couleurCss: string, pourcent = 18): string {
  return `color-mix(in oklch, ${couleurCss} ${pourcent}%, transparent)`;
}

// --- Mots-clés d'une proposition ---------------------------------------------------

export type Terme = { terme: string; definition: string | null };

export const TERMES_MAX = 8;
export const TERME_MAX = 60;
export const DEFINITION_MAX = 200;

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Un terme est un mot entier : « tva » ne se trouve pas dans « motivation ».
function motif(terme: string, drapeaux: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${echapper(terme)}(?![\\p{L}\\p{N}])`, drapeaux);
}

export function termeDansTexte(terme: string, texte: string): boolean {
  return motif(terme, "iu").test(texte);
}

/** Lecture tolérante du JSON stocké : tout ce qui n'a pas la bonne forme est ignoré. */
export function termesDepuisJson(valeur: unknown): Terme[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.flatMap((entree): Terme[] => {
    if (typeof entree !== "object" || entree === null) return [];
    const { terme, definition } = entree as { terme?: unknown; definition?: unknown };
    if (typeof terme !== "string" || terme.trim() === "") return [];
    const def = typeof definition === "string" && definition.trim() !== "" ? definition.trim() : null;
    return [{ terme: terme.trim(), definition: def }];
  });
}

/**
 * Nettoie les termes saisis : espaces, lignes vides ignorées, doublons (sans tenir
 * compte de la casse) refusés, et chaque terme doit apparaître dans le texte.
 */
export function nettoyerTermes(brut: readonly { terme: string; definition: string }[], texte: string): Terme[] | string {
  const propres: Terme[] = [];
  const vus = new Set<string>();
  for (const ligne of brut) {
    const terme = ligne.terme.trim();
    const definition = ligne.definition.trim();
    if (terme === "" && definition === "") continue;
    if (terme === "") return "Un terme est vide : renseigne le mot ou supprime la ligne.";
    if (terme.length > TERME_MAX) return `Le terme « ${terme} » dépasse ${TERME_MAX} caractères.`;
    if (definition.length > DEFINITION_MAX) return `La définition de « ${terme} » dépasse ${DEFINITION_MAX} caractères.`;
    const cle = terme.toLocaleLowerCase("fr");
    if (vus.has(cle)) return `Le terme « ${terme} » est en double.`;
    vus.add(cle);
    if (!termeDansTexte(terme, texte)) return `Le terme « ${terme} » n'apparaît pas dans la proposition.`;
    propres.push({ terme, definition: definition === "" ? null : definition });
  }
  if (propres.length > TERMES_MAX) return `Au plus ${TERMES_MAX} termes par proposition.`;
  return propres;
}

export type Segment = { texte: string; terme: Terme | null };

/**
 * Découpe un texte en morceaux simples et morceaux portant un terme. Tous les
 * passages sont repérés, le terme le plus long gagne en cas de recouvrement, et un
 * terme qui n'est plus dans le texte est ignoré sans erreur.
 */
export function decouperTermes(texte: string, termes: readonly Terme[]): Segment[] {
  if (termes.length === 0) return [{ texte, terme: null }];

  const trouves: { debut: number; fin: number; terme: Terme }[] = [];
  const parLongueur = [...termes].sort((a, b) => b.terme.length - a.terme.length);
  for (const terme of parLongueur) {
    for (const m of texte.matchAll(motif(terme.terme, "giu"))) {
      const debut = m.index ?? 0;
      const fin = debut + m[0].length;
      if (!trouves.some((t) => debut < t.fin && fin > t.debut)) trouves.push({ debut, fin, terme });
    }
  }
  trouves.sort((a, b) => a.debut - b.debut);

  const segments: Segment[] = [];
  let curseur = 0;
  for (const t of trouves) {
    if (t.debut > curseur) segments.push({ texte: texte.slice(curseur, t.debut), terme: null });
    segments.push({ texte: texte.slice(t.debut, t.fin), terme: t.terme });
    curseur = t.fin;
  }
  if (curseur < texte.length) segments.push({ texte: texte.slice(curseur), terme: null });
  return segments.length > 0 ? segments : [{ texte, terme: null }];
}
