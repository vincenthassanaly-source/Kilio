// Jours fériés FR (métropole) : conversion de la réponse de l'API Etalab
// (calendrier.api.gouv.fr) en lignes de la table `jours_feries`, et helpers
// de plage. Pur : aucun accès réseau ni base ici.

export type JourFerie = { date: string; nom: string };

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Réponse Etalab `{ "2026-01-01": "1er janvier", … }` → lignes valides. */
export function parseReponseEtalab(brut: unknown): JourFerie[] {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return [];
  return Object.entries(brut)
    .filter((e): e is [string, string] => DATE_REGEX.test(e[0]) && typeof e[1] === "string" && e[1].trim() !== "")
    .map(([date, nom]) => ({ date, nom: nom.trim() }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Années (AAAA) couvertes par une plage de dates ISO incluses. */
export function anneesDePlage(debut: string, fin: string): number[] {
  const a = Number(debut.slice(0, 4));
  const b = Number(fin.slice(0, 4));
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** Années de `annees` absentes des fériés déjà en base. */
export function anneesManquantes(annees: number[], deja: JourFerie[]): number[] {
  const presentes = new Set(deja.map((j) => Number(j.date.slice(0, 4))));
  return annees.filter((annee) => !presentes.has(annee));
}

/** Date → nom, pour un accès direct depuis les vues. */
export function ferieParDate(jours: JourFerie[]): Map<string, string> {
  return new Map(jours.map((j) => [j.date, j.nom]));
}
