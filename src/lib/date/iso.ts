// Une date métier (échéance, entrée d'habitude, valeur d'objectif...) est
// stockée en base comme une colonne `date` sans fuseau horaire : on la
// parse/formatte toujours en heure locale à minuit pour éviter les
// décalages de jour liés au fuseau du navigateur/serveur.
export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

// Même résultat que `format(date, "yyyy-MM-dd")` de date-fns (heure locale,
// année sur 4 chiffres au moins, RangeError sur une date invalide : voir
// iso.test.ts), sans importer date-fns. Ce module est atteint par le layout
// de toutes les pages (VidageSync, SeanceFlottante) : `format` y tirait
// date-fns et sa locale anglaise par défaut dans le JS partagé.
export function toISODate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid time value");
  const annee = date.getFullYear();
  // Comme le jeton `yyyy` de date-fns : pas d'année 0 ni négative (ère).
  const anneeAffichee = annee > 0 ? annee : 1 - annee;
  const deuxChiffres = (n: number) => String(n).padStart(2, "0");
  return `${String(anneeAffichee).padStart(4, "0")}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
}

// `T00:00:00Z` + setters UTC : arithmétique de date pure, indépendante du
// fuseau d'exécution (contrairement à parseISODate/toISODate ci-dessus, à
// ne jamais mélanger avec un `.toISOString()`). `T00:00:00` sans `Z` est lu
// en heure locale du serveur : sur Vercel (UTC) ça ne bouge rien, mais en dev
// local (Paris) le `toISOString()` qui suit repart de minuit Paris converti
// en UTC et retombe sur la veille (bug des streaks d'habitudes, cf.
// src/lib/habitudes/compute.test.ts).
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
