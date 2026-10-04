// Plages libres de la journée : logique pure (aucun réseau, aucune base),
// calculée par l'app et non par Gemini — un petit modèle se trompe sur les
// intervalles de temps, un calcul déterministe est exact et testable. Gemini
// ne fait que choisir quoi placer dans les plages qu'on lui donne.

/** Plage horaire d'une même journée, bornes au format `HH:MM`. */
export type Plage = { debut: string; fin: string };

const DEBUT_JOURNEE = "07:00";
const FIN_JOURNEE = "22:00";
// En dessous, une plage est trop courte pour y placer quoi que ce soit.
const DUREE_MIN_PLAGE_MINUTES = 30;
// Durée supposée d'une tâche datée sans heure de fin.
const DUREE_TACHE_PAR_DEFAUT_MINUTES = 60;
// Les plages commencent à un multiple de 5 minutes (« il est 18 h 16 » → 18 h 20).
const ARRONDI_MINUTES = 5;
const MINUTES_PAR_JOUR = 24 * 60;

/** `HH:MM` ou `HH:MM:SS` (colonne `time` de Postgres) → minutes depuis minuit. */
export function enMinutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes depuis minuit → `HH:MM` (24:00 est borné à 23:59 pour l'affichage). */
export function enHeure(minutes: number): string {
  const bornees = Math.min(Math.max(Math.round(minutes), 0), MINUTES_PAR_JOUR - 1);
  return `${String(Math.floor(bornees / 60)).padStart(2, "0")}:${String(bornees % 60).padStart(2, "0")}`;
}

type Intervalle = [number, number];

// Un créneau qui finit avant (ou en même temps que) son début franchit minuit
// (poste de nuit) : pour la journée en cours, il court jusqu'à minuit.
function versIntervalle(debut: string, fin: string): Intervalle {
  const a = enMinutes(debut);
  const b = enMinutes(fin);
  return [a, b <= a ? MINUTES_PAR_JOUR : b];
}

/**
 * Ce qui occupe la journée : les créneaux de travail et les tâches datées
 * d'aujourd'hui qui ont une heure. Sans heure de fin, une tâche dure
 * `DUREE_TACHE_PAR_DEFAUT_MINUTES`.
 */
export function occupationsDuJour(input: {
  creneauxTravail: Plage[];
  taches: { heure: string; heure_fin: string | null }[];
}): Plage[] {
  const travail = input.creneauxTravail.map((c) => ({ debut: c.debut.slice(0, 5), fin: c.fin.slice(0, 5) }));
  const taches = input.taches.map((t) => {
    const debut = enMinutes(t.heure);
    const fin = t.heure_fin ? enMinutes(t.heure_fin) : debut + DUREE_TACHE_PAR_DEFAUT_MINUTES;
    return { debut: enHeure(debut), fin: fin >= MINUTES_PAR_JOUR ? "24:00" : enHeure(fin) };
  });
  return [...travail, ...taches];
}

/**
 * Plages libres entre `maintenant` (ou le début de journée si plus tard) et la
 * fin de journée, une fois retirées les occupations. Triées, sans
 * chevauchement, chacune d'au moins `dureeMin` minutes.
 */
export function plagesLibres(input: {
  /** Heure courante, `HH:MM`. */
  maintenant: string;
  occupations: Plage[];
  debutJournee?: string;
  finJournee?: string;
  dureeMin?: number;
}): Plage[] {
  const dureeMin = input.dureeMin ?? DUREE_MIN_PLAGE_MINUTES;
  const maintenantArrondi = Math.ceil(enMinutes(input.maintenant) / ARRONDI_MINUTES) * ARRONDI_MINUTES;
  const debut = Math.max(enMinutes(input.debutJournee ?? DEBUT_JOURNEE), maintenantArrondi);
  const fin = enMinutes(input.finJournee ?? FIN_JOURNEE);
  if (debut >= fin) return [];

  const occupees = input.occupations
    .map((o) => versIntervalle(o.debut, o.fin))
    .map(([a, b]): Intervalle => [Math.max(a, debut), Math.min(b, fin)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);

  const libres: Plage[] = [];
  let curseur = debut;
  for (const [a, b] of occupees) {
    if (a - curseur >= dureeMin) libres.push({ debut: enHeure(curseur), fin: enHeure(a) });
    curseur = Math.max(curseur, b);
  }
  if (fin - curseur >= dureeMin) libres.push({ debut: enHeure(curseur), fin: enHeure(fin) });
  return libres;
}

/** Temps libre cumulé, en minutes. */
export function dureeTotale(plages: Plage[]): number {
  return plages.reduce((somme, p) => somme + enMinutes(p.fin) - enMinutes(p.debut), 0);
}

/** 150 → « 2 h 30 », 45 → « 45 min », 60 → « 1 h ». */
export function libelleDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Nombre maximal de suggestions selon le temps libre restant : peu de temps,
 * peu de propositions (sinon Gemini remplit une journée qui n'existe pas).
 */
export function plafondPropositions(minutesLibres: number): number {
  if (minutesLibres < 60) return 2;
  if (minutesLibres < 180) return 3;
  return 5;
}

const CRENEAU_REGEX = /^(\d{2}):(\d{2})\s*[-–—]\s*(\d{2}):(\d{2})$/;

/**
 * Vérifie un créneau proposé (`HH:MM-HH:MM`) : format valide, fin après début,
 * et entièrement contenu dans UNE plage libre. Sinon null : la suggestion est
 * gardée, sans créneau, plutôt que de montrer un horaire qui chevauche ton
 * travail ou un rendez-vous.
 */
export function validerCreneau(brut: unknown, plages: Plage[]): Plage | null {
  if (typeof brut !== "string") return null;
  const m = CRENEAU_REGEX.exec(brut.trim());
  if (!m) return null;
  const [hd, md, hf, mf] = [m[1], m[2], m[3], m[4]].map(Number);
  if (hd > 23 || hf > 23 || md > 59 || mf > 59) return null;
  const debut = hd * 60 + md;
  const fin = hf * 60 + mf;
  if (fin <= debut) return null;
  const contenu = plages.some((p) => debut >= enMinutes(p.debut) && fin <= enMinutes(p.fin));
  return contenu ? { debut: enHeure(debut), fin: enHeure(fin) } : null;
}

/** `17:00–18:00` (tiret demi-cadratin), pour l'affichage. */
export function libelleCreneau(p: Plage): string {
  return `${p.debut}–${p.fin}`;
}

/** Vrai si les deux plages se chevauchent (des plages qui se touchent, non). */
export function seChevauchent(a: Plage, b: Plage): boolean {
  return enMinutes(a.debut) < enMinutes(b.fin) && enMinutes(b.debut) < enMinutes(a.fin);
}
