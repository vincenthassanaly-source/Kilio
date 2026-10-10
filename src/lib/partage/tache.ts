// Texte reçu par le partage natif (champs `text`, `url`, `title`) converti en
// valeurs de départ d'une tâche : le texte libre devient le titre, les liens
// vont dans les notes. Un screenshot partagé seul n'a aucun texte : le titre
// reste vide.

const TITRE_MAX = 200;
const REGEX_LIEN = /https?:\/\/\S+/g;

export type TexteTache = { titre: string; notes: string };

export function texteTacheDepuisPartage(champs: { text?: string; url?: string; title?: string }): TexteTache {
  const brut = [champs.title, champs.text].filter(Boolean).join(" ");
  const liens = new Set<string>();
  for (const source of [champs.url ?? "", brut]) {
    for (const lien of source.match(REGEX_LIEN) ?? []) liens.add(lien);
  }
  const titre = brut.replace(REGEX_LIEN, " ").replace(/\s+/g, " ").trim().slice(0, TITRE_MAX);
  return { titre, notes: [...liens].join("\n") };
}
