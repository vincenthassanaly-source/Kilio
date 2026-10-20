// Logique pure du rappel « Vider ma tête » (testée par src/lib/vidage/rappel.test.ts).

/**
 * Faut-il rappeler d'écrire ce soir ? Une fois par jour (heure de Paris), à
 * l'heure réglée ou dans les `toleranceMin` minutes qui suivent (si le cron a
 * manqué la minute exacte), et seulement si la feuille du jour est encore vide.
 */
export function rappelVidageDu(input: {
  today: string;
  maintenantMinutes: number; // minutes depuis minuit, heure de Paris
  heure: string; // HH:MM[:SS]
  feuilleEcrite: boolean;
  dernierEnvoi: string | null;
  toleranceMin?: number;
}): boolean {
  if (input.feuilleEcrite || input.dernierEnvoi === input.today) return false;
  const [h, m] = input.heure.split(":").map(Number);
  const ecart = input.maintenantMinutes - (h * 60 + m);
  return ecart >= 0 && ecart <= (input.toleranceMin ?? 180);
}

export function composerRappelVidage(): { title: string; body: string } {
  return {
    title: "Vider ta tête ?",
    body: "Quelques minutes, à la main, pour poser la journée.",
  };
}
