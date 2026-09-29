import { MAX_QUESTIONS, type PrecisionDonnee, type ResultatInterpretation } from "./types";
import type { ModuleIAServeur, ModulePrepare } from "./module";
import { ajouterJours, nomDuJour, texteOuNull } from "./outils";

// Logique pure du moteur de saisie multi-modules (aucun réseau, aucune base) :
// schéma de réponse, prompt et revalidation sont composés à partir des modules
// branchés. Un seul appel Gemini renvoie donc, en un coup, une question de
// précision ou les éléments de tous les modules.

const MAX_CHOIX = 4;
const MAX_CHOIX_LONGUEUR = 40;

// Schéma volontairement sans `nullable` : aucune valeur n'est optionnelle,
// « pas de valeur » s'écrit par une chaîne vide (ou 0). Le mot-clé `nullable`
// du sous-ensemble OpenAPI de Gemini n'est pas garanti selon les modèles ;
// une chaîne vide, elle, l'est toujours. La revalidation côté serveur traite
// ces valeurs vides comme absentes.
export type SchemaSaisie = {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required: string[];
};

export function construireSchema(modules: readonly ModuleIAServeur[]): SchemaSaisie {
  return {
    type: "object",
    properties: {
      question: {
        type: "object",
        properties: {
          texte: { type: "string" },
          choix: { type: "array", maxItems: MAX_CHOIX, items: { type: "string" } },
        },
        required: ["texte", "choix"],
      },
      ...Object.fromEntries(
        modules.map((m) => [m.cle, { type: "array", maxItems: m.max, items: m.schemaElement }])
      ),
    },
    required: ["question", ...modules.map((m) => m.cle)],
  };
}

function enumeration(mots: string[]): string {
  if (mots.length <= 1) return mots.join("");
  return `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
}

/**
 * Prompt de la saisie. Le calendrier des 14 prochains jours est fourni tel
 * quel : un petit modèle se trompe souvent sur « jeudi prochain » quand on lui
 * demande de calculer, jamais quand on lui donne la table.
 */
export function construirePrompt(input: {
  texte: string;
  precisions: PrecisionDonnee[];
  aujourdhui: string;
  modules: readonly ModuleIAServeur[];
  contextes: readonly ModulePrepare[];
}): string {
  const { texte, precisions, aujourdhui, modules, contextes } = input;
  const questionsRestantes = Math.max(0, MAX_QUESTIONS - precisions.length);

  const calendrier = Array.from({ length: 14 }, (_, i) => {
    const date = ajouterJours(aujourdhui, i);
    return `${nomDuJour(date)} ${date}${i === 0 ? " (aujourd'hui)" : i === 1 ? " (demain)" : ""}`;
  }).join(", ");

  const lignes = [
    `Tu transformes une phrase de Vincent en ${enumeration(modules.map((m) => m.libelle))} pour son app personnelle Kilio (fuseau Europe/Paris).`,
    "",
    `Calendrier : ${calendrier}.`,
    ...contextes.flatMap((c) => c.lignesContexte),
    "",
    `Texte de Vincent : ${JSON.stringify(texte)}`,
  ];

  if (precisions.length > 0) {
    lignes.push("", "Précisions déjà obtenues (ne repose jamais ces questions) :");
    for (const p of precisions) {
      lignes.push(`- Question : ${JSON.stringify(p.question)} → Réponse : ${JSON.stringify(p.reponse)}`);
    }
  }

  lignes.push("", "Règles :", ...modules.flatMap((m) => m.regles), "- N'invente aucune information absente du texte.");

  const tableaux = modules.map((m) => `\`${m.cle}\``);
  const cas = modules.flatMap((m) => m.casQuestion).map((c, i) => `(${i + 1}) ${c}`);
  if (questionsRestantes > 0) {
    lignes.push(
      `- Tu peux poser UNE question de précision (il te reste ${questionsRestantes} question(s)), uniquement dans ces cas : ${cas.join(" ; ")}. Dans tous les autres cas, tranche sans demander.`,
      `- Pour poser une question : remplis \`question\` (\`texte\` court, \`choix\` de 2 à 4 réponses courtes) et laisse ${tableaux.join(", ")} ${tableaux.length > 1 ? "vides" : "vide"}. Sinon \`question.texte\` est une chaîne vide et \`question.choix\` une liste vide.`
    );
  } else {
    lignes.push(
      "- Tu ne peux plus poser de question : choisis l'interprétation la plus probable. `question.texte` reste une chaîne vide et `question.choix` une liste vide."
    );
  }

  return lignes.join("\n");
}

/**
 * Transforme la réponse JSON de Gemini en résultat fiable. Une question n'est
 * retenue que si le quota de questions n'est pas épuisé (`questionsRestantes`)
 * ; sinon Gemini est censé avoir tranché, et seuls les éléments comptent.
 */
export function interpreterReponse(
  brut: unknown,
  modules: readonly ModuleIAServeur[],
  contextes: readonly ModulePrepare[],
  questionsRestantes: number
): ResultatInterpretation {
  if (typeof brut !== "object" || brut === null) return { statut: "vide" };
  const reponse = brut as Record<string, unknown>;

  const elements = modules.flatMap((m, i) => {
    const entrees = reponse[m.cle];
    if (!Array.isArray(entrees)) return [];
    const bruts = entrees
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .slice(0, m.max);
    return contextes[i].interpreter(bruts);
  });

  const { question } = reponse;
  if (questionsRestantes > 0 && typeof question === "object" && question !== null) {
    const { texte, choix } = question as { texte?: unknown; choix?: unknown };
    const texteQuestion = texteOuNull(texte, 200);
    if (texteQuestion) {
      const choixValides = Array.isArray(choix)
        ? choix
            .map((c) => texteOuNull(c, MAX_CHOIX_LONGUEUR))
            .filter((c): c is string => c !== null)
            .slice(0, MAX_CHOIX)
        : [];
      return { statut: "question", question: texteQuestion, choix: choixValides };
    }
  }

  if (elements.length === 0) return { statut: "vide" };
  return { statut: "elements", elements };
}
