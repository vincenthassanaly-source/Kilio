// Rappel de la revue hebdomadaire : logique pure (aucune API Deno ni réseau),
// testée côté app (src/lib/revue/rappel.test.ts).

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date AAAA-MM-JJ. */
export function jourDeSemaine(date: string): number {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

/** Faut-il envoyer maintenant ? Bon jour, heure atteinte, pas déjà envoyé aujourd'hui. */
export function revueDue(input: {
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

function pluriel(n: number, singulier: string, plur: string): string {
  return `${n} ${n > 1 ? plur : singulier}`;
}

/** Message de rappel : un coup d'œil sur la semaine écoulée et la suivante. */
export function composerRappelRevue(input: {
  terminees: number;
  enRetard: number;
  prevues: number;
}): { title: string; body: string } {
  const lignes = [
    `${pluriel(input.terminees, "tâche terminée", "tâches terminées")} cette semaine`,
    input.enRetard > 0 ? `${input.enRetard} en retard à replanifier` : "Rien en retard",
    `${pluriel(input.prevues, "tâche prévue", "tâches prévues")} les 7 prochains jours`,
  ];
  return { title: "C'est l'heure de la revue de la semaine", body: lignes.join("\n") };
}
