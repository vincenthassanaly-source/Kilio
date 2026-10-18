// Validation et nettoyage des champs d'une idée, côté serveur (jamais de
// confiance dans les valeurs du client). Retourne les champs nettoyés, ou un
// message d'erreur lisible.
import {
  ARGUMENTS_MAX,
  AXES,
  POSITION_MAX,
  SOURCE_MAX,
  estConviction,
  estScore,
  estTheme,
  scoresVides,
  type ChampsIdee,
  type Scores,
} from "./types";

export function nettoyerChamps(champs: ChampsIdee): ChampsIdee | string {
  const position = champs.position.trim();
  if (!position) return "La position est requise.";
  if (position.length > POSITION_MAX) return `La position dépasse ${POSITION_MAX} caractères.`;

  if (champs.theme !== null && !estTheme(champs.theme)) return "Thème invalide.";
  if (!estConviction(champs.conviction)) return "Niveau de conviction invalide.";

  const argumentsPour = champs.arguments_pour.trim();
  const argumentsContre = champs.arguments_contre.trim();
  if (argumentsPour.length > ARGUMENTS_MAX || argumentsContre.length > ARGUMENTS_MAX) {
    return `Les arguments dépassent ${ARGUMENTS_MAX} caractères.`;
  }
  const source = champs.source.trim();
  if (source.length > SOURCE_MAX) return `La source dépasse ${SOURCE_MAX} caractères.`;

  const scores: Scores = scoresVides();
  for (const axe of AXES) {
    const score = champs.scores[axe.id];
    if (score !== null && !estScore(score)) return `Score invalide pour l'axe « ${axe.label} ».`;
    scores[axe.id] = score;
  }

  return {
    position,
    theme: champs.theme,
    conviction: champs.conviction,
    arguments_pour: argumentsPour,
    arguments_contre: argumentsContre,
    source,
    scores,
  };
}
