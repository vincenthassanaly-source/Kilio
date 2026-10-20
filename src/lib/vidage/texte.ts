// Texte du jour de « Vider ma tête » : les transcriptions validées et les notes tapées au
// clavier s'ajoutent les unes à la suite des autres, chacune précédée de son heure.
import { LONGUEUR_MAX_TEXTE } from "./transcription";

/** Ajoute un bloc « HH:MM » + texte à la suite du texte du jour (séparé par une ligne vide). */
export function ajouterBloc(existant: string | null, texte: string, heure: string): string {
  const bloc = `${heure}\n${texte.trim()}`;
  const base = existant?.trim();
  return base ? `${base}\n\n${bloc}` : bloc;
}

/** Vrai si le texte du jour, une fois le bloc ajouté, dépasserait la limite de la colonne. */
export function depasseLimite(existant: string | null, texte: string, heure: string): boolean {
  return ajouterBloc(existant, texte, heure).length > LONGUEUR_MAX_TEXTE;
}
