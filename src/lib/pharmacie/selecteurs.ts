import { estAcquise } from "./srs";
import { normalizeSearch } from "@/lib/normalize";
import type { PharmaCarte, PharmaChapitre, PharmaMatiere, PharmaNotion, PharmaSnapshot } from "./types";

const parOrdre = <T extends { ordre: number }>(a: T, b: T) => a.ordre - b.ordre;

export function chapitresDeMatiere(snap: PharmaSnapshot, matiereId: string): PharmaChapitre[] {
  return snap.chapitres.filter((c) => c.matiere_id === matiereId).sort(parOrdre);
}

export function notionsDeChapitre(snap: PharmaSnapshot, chapitreId: string): PharmaNotion[] {
  return snap.notions.filter((n) => n.chapitre_id === chapitreId).sort(parOrdre);
}

export function cartesDeNotions(snap: PharmaSnapshot, notionIds: Set<string>): PharmaCarte[] {
  return snap.cartes.filter((c) => notionIds.has(c.notion_id));
}

export type StatsMatiere = { chapitres: number; notions: number; cartes: number; acquises: number };

export function statsMatiere(snap: PharmaSnapshot, matiereId: string): StatsMatiere {
  const chapitres = snap.chapitres.filter((c) => c.matiere_id === matiereId);
  const chapitreIds = new Set(chapitres.map((c) => c.id));
  const notions = snap.notions.filter((n) => chapitreIds.has(n.chapitre_id));
  const cartes = cartesDeNotions(snap, new Set(notions.map((n) => n.id)));
  return {
    chapitres: chapitres.length,
    notions: notions.length,
    cartes: cartes.length,
    acquises: cartes.filter(estAcquise).length,
  };
}

export function cartesARevoir(cartes: PharmaCarte[], maintenant: Date): PharmaCarte[] {
  return cartes
    .filter((c) => new Date(c.echeance).getTime() <= maintenant.getTime())
    .sort((a, b) => new Date(a.echeance).getTime() - new Date(b.echeance).getTime());
}

export function dernieresNotions(snap: PharmaSnapshot, limite: number): PharmaNotion[] {
  return [...snap.notions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limite);
}

export type CheminNotion = { matiere: PharmaMatiere; chapitre: PharmaChapitre };

export function cheminDeNotion(snap: PharmaSnapshot, notion: PharmaNotion): CheminNotion | null {
  const chapitre = snap.chapitres.find((c) => c.id === notion.chapitre_id);
  const matiere = chapitre && snap.matieres.find((m) => m.id === chapitre.matiere_id);
  return chapitre && matiere ? { matiere, chapitre } : null;
}

// Distance d'édition bornée à 1 (substitution, insertion ou suppression) :
// suffit à tolérer une faute de frappe sur un nom de molécule sans faux
// positifs en cascade.
function aUneFauteDePres(mot: string, cible: string): boolean {
  if (Math.abs(mot.length - cible.length) > 1) return false;
  let i = 0;
  let j = 0;
  let ecarts = 0;
  while (i < mot.length && j < cible.length) {
    if (mot[i] === cible[j]) {
      i++;
      j++;
      continue;
    }
    if (++ecarts > 1) return false;
    if (mot.length > cible.length) i++;
    else if (mot.length < cible.length) j++;
    else {
      i++;
      j++;
    }
  }
  return ecarts + (mot.length - i) + (cible.length - j) <= 1;
}

export type ResultatRechercheNotion = { notion: PharmaNotion; score: number };

// Recherche 100 % locale (fonctionne hors ligne) : sans accents ni casse,
// chaque mot de la requête doit apparaître dans le titre, les tags ou le
// contenu ; les mots de 4 lettres et plus tolèrent une faute de frappe.
export function rechercherNotions(snap: PharmaSnapshot, requete: string): ResultatRechercheNotion[] {
  const mots = normalizeSearch(requete).split(/\s+/).filter((m) => m.length >= 2);
  if (mots.length === 0) return [];

  const resultats: ResultatRechercheNotion[] = [];
  for (const notion of snap.notions) {
    const titre = normalizeSearch(notion.titre);
    const tags = normalizeSearch(notion.tags.join(" "));
    const contenu = normalizeSearch(notion.contenu);
    const motsTexte = `${titre} ${tags} ${contenu}`.split(/[^a-z0-9]+/).filter(Boolean);

    let total = 0;
    let tousTrouves = true;
    for (const mot of mots) {
      if (titre.includes(mot)) total += 3;
      else if (tags.includes(mot)) total += 2;
      else if (contenu.includes(mot)) total += 1;
      else if (mot.length >= 4 && motsTexte.some((m) => aUneFauteDePres(mot, m))) total += 0.5;
      else {
        tousTrouves = false;
        break;
      }
    }
    if (tousTrouves) resultats.push({ notion, score: total });
  }
  return resultats.sort((a, b) => b.score - a.score || a.notion.titre.localeCompare(b.notion.titre, "fr")).slice(0, 40);
}
