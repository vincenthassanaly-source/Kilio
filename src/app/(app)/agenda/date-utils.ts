// parseISODate/toISODate ont déménagé dans src/lib/date/iso.ts (partagées
// avec habitudes/nutrition-journal, qui en avaient chacun leur
// copie). Ne restent ici que les utilitaires propres aux échéances
// (heure, pas date).

export function majusculePremiere(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function sortByHeure(a: { heure: string | null }, b: { heure: string | null }): number {
  return (a.heure ?? "99:99").localeCompare(b.heure ?? "99:99");
}

// Convertit "HH:MM" ou "HH:MM:SS" (format `time` de Postgres) en minutes
// depuis minuit. Retourne null si la valeur est absente ou invalide.
export function heureToMinutes(heure: string | null): number | null {
  if (!heure) return null;
  const [h, m] = heure.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
