// Petits utilitaires purs partagés par le moteur de saisie et ses modules.

export function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function texteOuNull(valeur: unknown, max: number): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.replace(/\s+/g, " ").trim();
  return propre ? propre.slice(0, max) : null;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function nomDuJour(dateIso: string): string {
  return JOURS[new Date(`${dateIso}T12:00:00Z`).getUTCDay()];
}

export function ajouterJours(dateIso: string, jours: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

