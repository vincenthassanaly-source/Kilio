// Heure de Paris pour les Edge Functions : logique pure (aucune API Deno ni
// réseau), testée côté app (src/lib/notifications/paris.test.ts).
//
// Vincent saisit dates et heures en heure de Paris ; les Edge Functions
// tournent en UTC. Intl gère les changements d'heure (dernier dimanche de mars
// et d'octobre).

const PARIS_TZ = "Europe/Paris";

const formatParties = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARIS_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parties(ms: number) {
  const liste = formatParties.formatToParts(new Date(ms));
  const lire = (type: string) => Number(liste.find((p) => p.type === type)?.value ?? "0");
  return {
    annee: lire("year"),
    mois: lire("month"),
    jour: lire("day"),
    heure: lire("hour"),
    minute: lire("minute"),
    seconde: lire("second"),
  };
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

/** Date (AAAA-MM-JJ) et minutes depuis minuit, à Paris, à l'instant donné. */
export function parisMaintenant(ms: number): { today: string; minutes: number } {
  const p = parties(ms);
  return { today: `${p.annee}-${deuxChiffres(p.mois)}-${deuxChiffres(p.jour)}`, minutes: p.heure * 60 + p.minute };
}

/** Date (AAAA-MM-JJ) à Paris à l'instant donné. */
export function dateParis(ms: number): string {
  return parisMaintenant(ms).today;
}

/** Décalage de Paris par rapport à UTC (en minutes : 60 l'hiver, 120 l'été) à l'instant donné. */
export function decalageParisMinutes(ms: number): number {
  const p = parties(ms);
  const commeUtc = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde);
  return Math.round((commeUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/**
 * Instant (ms) correspondant à une date et une heure « murales » de Paris.
 * Deux passes : le décalage est d'abord estimé à l'instant « heure murale lue
 * comme UTC », puis recalculé à l'instant obtenu ; sans la seconde passe, une
 * heure entre 01:00 et 02:00 un jour de changement d'heure tombait une heure
 * trop tôt ou trop tard. Une heure qui n'existe pas (02:30 le jour du passage
 * à l'heure d'été) est lue une heure plus tard.
 */
export function instantParis(date: string, heure: string): number {
  const [annee, mois, jour] = date.split("-").map(Number);
  const [h, m, s] = heure.split(":").map(Number);
  const murale = Date.UTC(annee, mois - 1, jour, h, m, s || 0);
  const estimation = murale - decalageParisMinutes(murale) * 60_000;
  return murale - decalageParisMinutes(estimation) * 60_000;
}

/** Date AAAA-MM-JJ décalée de `jours` jours calendaires (sans piège d'heure d'été). */
export function decalerJour(date: string, jours: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}
