// Flux calendrier iCalendar (RFC 5545) de l'agenda : rendez-vous + tâches à
// échéance. Fonctions pures, sans accès base ni horloge cachée, pour pouvoir
// les tester. La route src/app/api/agenda/feed.ics les alimente.

import { timingSafeEqual } from "node:crypto";
import { addDays, addMonths, format } from "date-fns";
import { HEURE_REGEX, calculerHeureFin } from "@/lib/evenements/compute";

export type EvenementIcs = {
  id: string;
  titre: string;
  date: string; // AAAA-MM-JJ
  heure: string; // HH:MM[:SS]
  heure_fin: string; // HH:MM[:SS]
  notes: string | null;
  updated_at: string;
  toute_la_journee?: boolean;
  recurrence_frequence?: "quotidien" | "hebdomadaire" | "mensuel" | "annuel" | null;
  recurrence_fin?: string | null; // AAAA-MM-JJ
};

export type TacheIcs = {
  id: string;
  titre: string;
  echeance: string | null; // AAAA-MM-JJ
  heure: string | null;
  heure_fin: string | null;
  duree_minutes: number | null;
  toute_la_journee: boolean;
  fait: boolean;
  notes: string | null;
  updated_at: string;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DUREE_TACHE_PAR_DEFAUT_MIN = 30;

// Bloc VTIMEZONE standard d'Europe/Paris (règles européennes de l'heure d'été).
const VTIMEZONE_PARIS = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Compare le jeton reçu au jeton attendu en temps constant. */
export function jetonValide(recu: string | null | undefined, attendu: string | null | undefined): boolean {
  if (!recu || !attendu) return false;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fenêtre du flux : de un mois avant aujourd'hui à six mois après (AAAA-MM-JJ). */
export function fenetreFlux(aujourdhui: string): { debut: string; fin: string } {
  const [a, m, j] = aujourdhui.split("-").map(Number);
  const jour = new Date(a, m - 1, j);
  return { debut: format(addMonths(jour, -1), "yyyy-MM-dd"), fin: format(addMonths(jour, 6), "yyyy-MM-dd") };
}

export function echapperTexte(texte: string): string {
  return texte
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Replie une ligne à 75 octets maximum (RFC 5545 §3.1), sans couper un caractère. */
export function replierLigne(ligne: string): string {
  if (Buffer.byteLength(ligne) <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  let limite = 75;
  for (const caractere of ligne) {
    if (Buffer.byteLength(courant + caractere) > limite) {
      morceaux.push(courant);
      courant = caractere;
      limite = 74; // l'espace de continuation occupe un octet
    } else {
      courant += caractere;
    }
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

function dateCompacte(dateISO: string): string {
  return dateISO.replace(/-/g, "");
}

function dateHeureLocale(dateISO: string, heure: string): string {
  const [h, m] = heure.slice(0, 5).split(":");
  return `${dateCompacte(dateISO)}T${h}${m}00`;
}

function horodatageUtc(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "19700101T000000Z" : d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function jourSuivant(dateISO: string): string {
  const [a, m, j] = dateISO.split("-").map(Number);
  return format(addDays(new Date(a, m - 1, j), 1), "yyyy-MM-dd");
}

function ligneTexte(nom: string, valeur: string): string {
  return `${nom}:${echapperTexte(valeur)}`;
}

const FREQ_RRULE = { quotidien: "DAILY", hebdomadaire: "WEEKLY", mensuel: "MONTHLY", annuel: "YEARLY" } as const;

// Récurrence d'un événement. UNTIL en date seule (inclusive) : suffisant pour
// les clients courants, qu'il s'agisse d'événements horaires ou journée entière.
function rrule(evenement: EvenementIcs): string[] {
  if (!evenement.recurrence_frequence) return [];
  const fin = evenement.recurrence_fin && DATE_REGEX.test(evenement.recurrence_fin) ? `;UNTIL=${dateCompacte(evenement.recurrence_fin)}` : "";
  return [`RRULE:FREQ=${FREQ_RRULE[evenement.recurrence_frequence]}${fin}`];
}

function evenementTimed(
  uid: string,
  titre: string,
  dateISO: string,
  debut: string,
  fin: string | null,
  notes: string | null,
  majISO: string,
  extra: string[] = []
): string[] {
  const lignes = [
    "BEGIN:VEVENT",
    `UID:${uid}@kilio`,
    `DTSTAMP:${horodatageUtc(majISO)}`,
    `DTSTART;TZID=Europe/Paris:${dateHeureLocale(dateISO, debut)}`,
  ];
  if (fin) lignes.push(`DTEND;TZID=Europe/Paris:${dateHeureLocale(dateISO, fin)}`);
  lignes.push(...extra);
  lignes.push(ligneTexte("SUMMARY", titre));
  if (notes?.trim()) lignes.push(ligneTexte("DESCRIPTION", notes.trim()));
  lignes.push("END:VEVENT");
  return lignes;
}

function evenementJourEntier(uid: string, titre: string, dateISO: string, notes: string | null, majISO: string, extra: string[] = []): string[] {
  const lignes = [
    "BEGIN:VEVENT",
    `UID:${uid}@kilio`,
    `DTSTAMP:${horodatageUtc(majISO)}`,
    `DTSTART;VALUE=DATE:${dateCompacte(dateISO)}`,
    `DTEND;VALUE=DATE:${dateCompacte(jourSuivant(dateISO))}`,
    ...extra,
    ligneTexte("SUMMARY", titre),
  ];
  if (notes?.trim()) lignes.push(ligneTexte("DESCRIPTION", notes.trim()));
  lignes.push("END:VEVENT");
  return lignes;
}

function heureValide(heure: string | null): heure is string {
  return heure !== null && HEURE_REGEX.test(heure.slice(0, 5));
}

function veventTache(tache: TacheIcs): string[] {
  if (tache.fait || !tache.echeance || !DATE_REGEX.test(tache.echeance)) return [];
  const titre = `☐ ${tache.titre}`;
  const uid = `tache-${tache.id}`;
  if (tache.toute_la_journee || !heureValide(tache.heure)) {
    return evenementJourEntier(uid, titre, tache.echeance, tache.notes, tache.updated_at);
  }
  const fin = heureValide(tache.heure_fin)
    ? tache.heure_fin.slice(0, 5)
    : calculerHeureFin(tache.heure, tache.duree_minutes ?? DUREE_TACHE_PAR_DEFAUT_MIN);
  return evenementTimed(uid, titre, tache.echeance, tache.heure, fin, tache.notes, tache.updated_at);
}

function veventRendezVous(evenement: EvenementIcs): string[] {
  if (!DATE_REGEX.test(evenement.date)) return [];
  if (evenement.toute_la_journee) {
    return evenementJourEntier(`evenement-${evenement.id}`, evenement.titre, evenement.date, evenement.notes, evenement.updated_at, rrule(evenement));
  }
  if (!heureValide(evenement.heure)) return [];
  const fin = heureValide(evenement.heure_fin) ? evenement.heure_fin.slice(0, 5) : null;
  return evenementTimed(
    `evenement-${evenement.id}`,
    evenement.titre,
    evenement.date,
    evenement.heure,
    fin,
    evenement.notes,
    evenement.updated_at,
    rrule(evenement)
  );
}

/** Calendrier complet, lignes séparées par CRLF. Lecture seule, sans alarme. */
export function construireCalendrierIcs(evenements: readonly EvenementIcs[], taches: readonly TacheIcs[]): string {
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kilio//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Kilio",
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE_PARIS,
    ...evenements.flatMap(veventRendezVous),
    ...taches.flatMap(veventTache),
    "END:VCALENDAR",
  ];
  return lignes.map(replierLigne).join("\r\n") + "\r\n";
}
