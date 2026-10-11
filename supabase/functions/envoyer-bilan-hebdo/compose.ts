// Bilan de la semaine (santé) : logique pure, sans API Deno ni réseau. Source
// unique du calcul : la fonction d'envoi l'importe, et l'app la réexporte
// (src/lib/sante/compute.ts) pour que le Bilan à l'écran et la notification
// affichent les mêmes chiffres. Testée dans src/lib/sante/compute.test.ts.

// --- Dates (arithmétique UTC, indépendante du fuseau d'exécution) -------------

export function decalerDate(date: string, jours: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date AAAA-MM-JJ. */
function jourDeSemaine(date: string): number {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

/** Bornes (lundi → dimanche) de la semaine qui contient `date`. */
export function semaineDe(date: string): { debut: string; fin: string } {
  const debut = decalerDate(date, -((jourDeSemaine(date) + 6) % 7));
  return { debut, fin: decalerDate(debut, 6) };
}

function ecartJours(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** Faut-il envoyer maintenant ? Bon jour, heure atteinte, pas déjà envoyé aujourd'hui. */
export function bilanDu(input: {
  today: string;
  maintenantMinutes: number; // minutes depuis minuit, heure de Paris
  jour: number; // 0 = dimanche
  heure: string; // HH:MM[:SS]
  dernierEnvoi: string | null;
  toleranceMin?: number;
}): boolean {
  if (input.dernierEnvoi === input.today) return false;
  if (jourDeSemaine(input.today) !== input.jour) return false;
  const [h, m] = input.heure.split(":").map(Number);
  const ecart = input.maintenantMinutes - (h * 60 + m);
  return ecart >= 0 && ecart <= (input.toleranceMin ?? 180);
}

// --- Kcal ----------------------------------------------------------------------

type AlimentKcal = { kcal_100g: number };

export type EntreeKcal = {
  date: string;
  quantite: number;
  aliment: AlimentKcal | null;
  recette: {
    portions: number;
    kcal_portion: number | null;
    recette_ingredients: { quantite: number; aliment: AlimentKcal }[];
  } | null;
};

/** kcal d'une entrée du journal ; `null` pour une entrée orpheline (ni aliment ni recette). */
function kcalEntree(entree: EntreeKcal): number | null {
  if (entree.aliment) return (entree.aliment.kcal_100g * entree.quantite) / 100;
  const recette = entree.recette;
  if (!recette) return null;
  if (recette.kcal_portion != null) return recette.kcal_portion * entree.quantite;
  const total = recette.recette_ingredients.reduce((somme, ing) => somme + (ing.aliment.kcal_100g * ing.quantite) / 100, 0);
  return (total / recette.portions) * entree.quantite;
}

export type JourKcal = {
  date: string;
  kcal: number;
  /** Limite kcal du jour (selon repos / entraînement), `null` sans objectif. */
  cible: number | null;
  nbRepas: number;
  libre: boolean;
  /** Journée en cours : pas finie, donc pas encore jugée. */
  aujourdhui: boolean;
};

/** kcal et nombre de repas par date, entrées orphelines ignorées. */
export function kcalParJour(entrees: readonly EntreeKcal[]): Map<string, { kcal: number; nbRepas: number }> {
  const parDate = new Map<string, { kcal: number; nbRepas: number }>();
  for (const entree of entrees) {
    const valeur = kcalEntree(entree);
    if (valeur === null) continue;
    const courant = parDate.get(entree.date) ?? { kcal: 0, nbRepas: 0 };
    parDate.set(entree.date, { kcal: courant.kcal + valeur, nbRepas: courant.nbRepas + 1 });
  }
  return parDate;
}

export type SyntheseKcal = {
  /** Moyenne des kcal des jours évalués. */
  moyenne: number;
  /** Moyenne des limites de ces mêmes jours. */
  cibleMoyenne: number;
  nbJours: number;
  /** Jours évalués restés sous (ou à) leur limite, kcal arrondies comme le Journal. */
  nbDansLimite: number;
};

/**
 * Moyenne des kcal sur les jours évalués : au moins un repas saisi, une limite
 * définie, ni jour libre (limite suspendue) ni journée en cours.
 */
export function syntheseKcal(jours: readonly JourKcal[]): SyntheseKcal | null {
  const evalues = jours.filter((j) => j.nbRepas > 0 && !j.libre && !j.aujourdhui && j.cible !== null && j.cible > 0);
  if (evalues.length === 0) return null;
  const somme = (valeur: (j: JourKcal) => number) => evalues.reduce((total, j) => total + valeur(j), 0);
  return {
    moyenne: Math.round(somme((j) => j.kcal) / evalues.length),
    cibleMoyenne: Math.round(somme((j) => j.cible ?? 0) / evalues.length),
    nbJours: evalues.length,
    nbDansLimite: evalues.filter((j) => Math.round(j.kcal) <= (j.cible ?? 0)).length,
  };
}

// --- Corps ---------------------------------------------------------------------

export type Mesure = { date: string; poids_kg: number | null; tour_taille_cm: number | null };

const arrondi1 = (valeur: number) => Math.round(valeur * 10) / 10;

/** Poids moyen sur les `fenetre` jours qui se terminent à `date` (relevés présents seulement). */
export function poidsLisse(mesures: readonly Mesure[], date: string, fenetre = 7): number | null {
  const debut = decalerDate(date, -(fenetre - 1));
  const poids = mesures
    .filter((m) => m.poids_kg !== null && m.date >= debut && m.date <= date)
    .map((m) => m.poids_kg as number);
  if (poids.length === 0) return null;
  return poids.reduce((somme, p) => somme + p, 0) / poids.length;
}

export type EvolutionCorps = {
  /** Valeur actuelle (poids lissé sur 7 jours, ou dernier tour de taille), à 0,1 près. */
  actuel: number;
  /** Écart avec la semaine d'avant ; `null` sans point de comparaison. */
  delta: number | null;
  /** Jours écoulés depuis le dernier relevé. */
  ageJours: number;
};

/**
 * Poids lissé à la date du dernier relevé, comparé au poids lissé 7 jours plus
 * tôt. Ancré sur le dernier relevé (et non sur aujourd'hui) pour rester
 * lisible avec une pesée hebdomadaire.
 */
export function evolutionPoids(mesures: readonly Mesure[], today: string): EvolutionCorps | null {
  const releves = mesures.filter((m) => m.poids_kg !== null && m.date <= today).map((m) => m.date).sort();
  const ancre = releves[releves.length - 1];
  if (!ancre) return null;
  const actuel = poidsLisse(mesures, ancre) as number;
  const avant = poidsLisse(mesures, decalerDate(ancre, -7));
  return {
    actuel: arrondi1(actuel),
    delta: avant === null ? null : arrondi1(actuel - avant),
    ageJours: ecartJours(today, ancre),
  };
}

/** Dernier tour de taille, comparé au relevé le plus récent d'au moins 6 jours plus tôt. */
export function evolutionTaille(mesures: readonly Mesure[], today: string): EvolutionCorps | null {
  const releves = mesures
    .filter((m): m is Mesure & { tour_taille_cm: number } => m.tour_taille_cm !== null && m.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dernier = releves[releves.length - 1];
  if (!dernier) return null;
  const limite = decalerDate(dernier.date, -6);
  const reference = [...releves].reverse().find((m) => m.date <= limite);
  return {
    actuel: arrondi1(dernier.tour_taille_cm),
    delta: reference ? arrondi1(dernier.tour_taille_cm - reference.tour_taille_cm) : null,
    ageJours: ecartJours(today, dernier.date),
  };
}

// --- Synthèse et message ---------------------------------------------------------

export type SyntheseHebdo = {
  kcal: SyntheseKcal | null;
  seances: { faites: number; total: number };
  poids: EvolutionCorps | null;
  taille: EvolutionCorps | null;
};

const MOINS = "−"; // vrai signe moins, plus lisible que « - » dans un delta

export function nombreFr(valeur: number, decimales = 0): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(valeur);
}

/** « +0,4 kg », « −1,0 cm », ou « stable » à zéro. */
export function formaterDelta(delta: number, unite: string): string {
  if (delta === 0) return "stable";
  return `${delta > 0 ? "+" : MOINS}${nombreFr(Math.abs(delta), 1)} ${unite}`;
}

function ligneCorps(libelle: string, unite: string, evolution: EvolutionCorps | null): string {
  if (!evolution) return `${libelle} : pas de relevé`;
  const delta = evolution.delta === null ? "" : ` (${formaterDelta(evolution.delta, unite)})`;
  const ancien = evolution.ageJours > 7 ? ` · relevé il y a ${evolution.ageJours} jours` : "";
  return `${libelle} : ${nombreFr(evolution.actuel, 1)} ${unite}${delta}${ancien}`;
}

/** Message du push du dimanche : un coup d'œil sur la semaine, ton neutre. */
export function composerBilanHebdo(synthese: SyntheseHebdo): { title: string; body: string } {
  const { kcal, seances } = synthese;
  const lignes = [
    kcal
      ? `Kcal : ${nombreFr(kcal.moyenne)} / ${nombreFr(kcal.cibleMoyenne)} en moyenne (${kcal.nbJours} ${kcal.nbJours > 1 ? "jours" : "jour"})`
      : "Kcal : pas assez de jours saisis",
    seances.total > 0 ? `Séances : ${seances.faites}/${seances.total} faites` : "Séances : aucune planifiée",
    ligneCorps("Poids", "kg", synthese.poids),
    ligneCorps("Tour de taille", "cm", synthese.taille),
  ];
  return { title: "Bilan de la semaine", body: lignes.join("\n") };
}
