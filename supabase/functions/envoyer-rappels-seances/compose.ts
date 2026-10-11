// Rappel de séance : logique pure (aucune API Deno ni réseau), testée côté app
// (src/lib/seances/rappel.test.ts).

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date AAAA-MM-JJ. */
export function jourDeSemaine(date: string): number {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

/**
 * Faut-il rappeler cette séance maintenant ? Le jour même, à partir de l'heure
 * du créneau, avec une tolérance (cron manqué) ; jamais deux fois.
 */
export function seanceDue(input: {
  date: string;
  heure: string; // HH:MM[:SS]
  today: string;
  maintenantMinutes: number; // minutes depuis minuit, heure de Paris
  rappelEnvoye: boolean;
  toleranceMin?: number;
}): boolean {
  if (input.rappelEnvoye || input.date !== input.today) return false;
  const [h, m] = input.heure.split(":").map(Number);
  const ecart = input.maintenantMinutes - (h * 60 + m);
  return ecart >= 0 && ecart <= (input.toleranceMin ?? 30);
}

export function composerRappelSeance(input: { type: string; heure: string }): { title: string; body: string } {
  return {
    title: `Séance : ${input.type}`,
    body: `C'est l'heure (${input.heure.slice(0, 5)}). Tu commences, ou tu la décales ?`,
  };
}
