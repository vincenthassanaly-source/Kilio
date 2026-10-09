// Composition du briefing du matin : logique pure (aucune API Deno ni réseau),
// testée côté app (src/lib/briefing/compose.test.ts).

export type Frequence = "quotidien" | "hebdomadaire" | "mensuel" | "annuel";

export type TacheBriefing = {
  titre: string;
  echeance: string; // AAAA-MM-JJ
  priorite: "haute" | "moyenne" | "basse" | "aucune";
  heure: string | null;
  toute_la_journee: boolean;
};

export type EvenementBriefing = {
  titre: string;
  date: string;
  heure: string; // HH:MM[:SS]
  toute_la_journee: boolean;
  recurrence_frequence: Frequence | null;
  recurrence_fin: string | null;
};

const RANG_PRIORITE = { haute: 0, moyenne: 1, basse: 2, aucune: 3 } as const;

function dernierJourDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** L'événement a-t-il lieu ce jour-là (récurrence comprise) ? */
export function evenementALieuLe(e: EvenementBriefing, jour: string): boolean {
  if (jour < e.date) return false;
  if (!e.recurrence_frequence) return jour === e.date;
  if (e.recurrence_fin && jour > e.recurrence_fin) return false;
  const [a0, m0, j0] = e.date.split("-").map(Number);
  const [a, m, j] = jour.split("-").map(Number);
  switch (e.recurrence_frequence) {
    case "quotidien":
      return true;
    case "hebdomadaire":
      return ((Date.UTC(a, m - 1, j) - Date.UTC(a0, m0 - 1, j0)) / 86_400_000) % 7 === 0;
    case "mensuel":
      return j === Math.min(j0, dernierJourDuMois(a, m));
    case "annuel":
      return m === m0 && j === Math.min(j0, dernierJourDuMois(a, m));
  }
}

function pluriel(n: number, singulier: string, plur: string): string {
  return `${n} ${n > 1 ? plur : singulier}`;
}

export type Briefing = { title: string; body: string } | null;

/**
 * Message du matin, ou `null` si la journée est vide (on n'envoie pas de
 * notification pour dire qu'il n'y a rien). `taches` : non faites, échéance
 * aujourd'hui ou avant ; `evenements` : toutes lignes, filtrées ici.
 */
export function composerBriefing(input: {
  today: string;
  taches: TacheBriefing[];
  evenements: EvenementBriefing[];
}): Briefing {
  const { today } = input;
  const evenements = input.evenements.filter((e) => evenementALieuLe(e, today));
  const duJour = input.taches.filter((t) => t.echeance === today);
  const enRetard = input.taches.filter((t) => t.echeance < today);
  if (evenements.length === 0 && duJour.length === 0 && enRetard.length === 0) return null;

  const resume: string[] = [];
  if (evenements.length > 0) resume.push(pluriel(evenements.length, "événement", "événements"));
  if (duJour.length > 0) resume.push(pluriel(duJour.length, "tâche", "tâches"));
  if (enRetard.length > 0) resume.push(`${enRetard.length} en retard`);

  const lignes = [resume.join(" · ")];

  const horaires = evenements.filter((e) => !e.toute_la_journee).sort((a, b) => a.heure.localeCompare(b.heure));
  if (horaires.length > 0) {
    lignes.push(`Premier : ${horaires[0].heure.slice(0, 5)} ${horaires[0].titre}`);
  } else if (evenements.length > 0) {
    lignes.push(`Aujourd'hui : ${evenements[0].titre}`);
  }

  const prioritaire = [...duJour, ...enRetard].sort(
    (a, b) => RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite] || a.echeance.localeCompare(b.echeance)
  )[0];
  if (prioritaire) lignes.push(`À faire : ${prioritaire.titre}`);

  return { title: "Ton programme du jour", body: lignes.join("\n") };
}

/** Faut-il envoyer maintenant ? Heure réglée atteinte, sans dépasser `toleranceMin`. */
export function briefingDu(input: {
  maintenantMinutes: number; // minutes depuis minuit, heure de Paris
  heure: string; // HH:MM[:SS]
  dernierEnvoi: string | null;
  today: string;
  toleranceMin?: number;
}): boolean {
  if (input.dernierEnvoi === input.today) return false;
  const [h, m] = input.heure.split(":").map(Number);
  const cible = h * 60 + m;
  const ecart = input.maintenantMinutes - cible;
  return ecart >= 0 && ecart <= (input.toleranceMin ?? 180);
}
