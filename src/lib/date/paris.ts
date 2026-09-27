// « Aujourd'hui » au sens de Vincent, pas du serveur (constat T3 de l'audit
// du 2026-09-25) : les fonctions Vercel tournent en UTC, donc
// `new Date().toISOString().slice(0, 10)` renvoyait la veille entre 0 h et
// 1 h (hiver) ou 2 h (été), heure de Paris. Un seul helper, utilisable côté
// serveur comme côté client (Intl, sans dépendance).

const FUSEAU_KILIO = "Europe/Paris";

// `en-CA` formate en AAAA-MM-JJ, exactement le format ISO attendu partout.
const formatDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU_KILIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatHeure = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU_KILIO,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Date du jour à Paris, au format ISO `AAAA-MM-JJ`. */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  return formatDate.format(maintenant);
}

/** Millisecondes restant avant le prochain minuit, heure de Paris. */
export function msAvantMinuitParis(maintenant: Date = new Date()): number {
  const [h, m, s] = formatHeure.format(maintenant).split(":").map(Number);
  const ecoule = ((h * 60 + m) * 60 + s) * 1000 + maintenant.getMilliseconds();
  return 24 * 60 * 60 * 1000 - ecoule;
}

/**
 * Le jour courant à Paris sous forme de `Date` (à midi, heure locale de
 * l'environnement) : ses getters locaux (`getFullYear`, `getMonth`,
 * `getDate`, `getDay`) donnent le jour de Paris même sur un serveur en UTC.
 */
export function dateDuJourParis(maintenant: Date = new Date()): Date {
  return new Date(`${aujourdhuiParis(maintenant)}T12:00:00`);
}
