import { NextResponse, type NextRequest } from "next/server";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import {
  CYCLES_RECOMMANDES,
  DELAI_ENDORMISSEMENT_MIN,
  DUREE_CYCLE_MIN,
  NOMBRES_CYCLES,
  minutesDepuisHeure,
  validerPropositions,
} from "@/lib/reveil/cycles";

// Heures de réveil calées sur la fin d'un cycle de sommeil, calculées par
// Gemini à partir de l'heure locale envoyée par l'appareil (le serveur Vercel
// est en UTC : il ne connaît pas l'heure de Vincent). La réponse de Gemini est
// vérifiée contre le calcul de référence (lib/reveil/cycles.ts) avant d'être
// renvoyée ; sinon l'écran affiche une erreur avec « Réessayer ».
// Route volontairement ouverte, sans session : l'app est mono-utilisateur.

const TIMEOUT_MS = 12_000;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    propositions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          cycles: { type: "INTEGER" },
          heure: { type: "STRING" },
        },
        required: ["cycles", "heure"],
      },
    },
  },
  required: ["propositions"],
};

function prompt(heureActuelle: string): string {
  return [
    `Il est ${heureActuelle} (heure locale, format 24 h). Je vais me coucher maintenant.`,
    `Calcule les heures de réveil qui coïncident avec la FIN d'un cycle de sommeil.`,
    `Hypothèses : un cycle dure ${DUREE_CYCLE_MIN} minutes, et il faut ${DELAI_ENDORMISSEMENT_MIN} minutes pour s'endormir.`,
    `Pour chaque nombre de cycles N dans [${NOMBRES_CYCLES.join(", ")}] :`,
    `heure de réveil = ${heureActuelle} + ${DELAI_ENDORMISSEMENT_MIN} minutes + N × ${DUREE_CYCLE_MIN} minutes, modulo 24 h.`,
    `Réponds en JSON : une proposition par N, avec "cycles" = N et "heure" au format HH:mm (24 h, deux chiffres).`,
  ].join("\n");
}

export async function POST(request: NextRequest) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    corps = null;
  }
  const heureActuelle = (corps as { heureActuelle?: unknown } | null)?.heureActuelle;
  if (typeof heureActuelle !== "string" || minutesDepuisHeure(heureActuelle) === null) {
    return NextResponse.json({ ok: false, message: "Heure actuelle invalide." }, { status: 400 });
  }

  const resultat = await appelerGemini({
    prompt: prompt(heureActuelle),
    schema: SCHEMA,
    timeoutMs: TIMEOUT_MS,
    temperature: 0,
    etiquette: "reveil-cycles",
  });

  if (!resultat.ok) {
    return NextResponse.json(
      { ok: false, message: resultat.code === "quota" ? MESSAGE_QUOTA_GEMINI : "Gemini n'a pas répondu." },
      { status: resultat.code === "quota" ? 429 : 502 }
    );
  }

  const propositions = validerPropositions(resultat.brut, heureActuelle);
  if (!propositions) {
    console.error("[reveil-cycles] Réponse Gemini incohérente avec le calcul de référence.");
    return NextResponse.json(
      { ok: false, message: "Gemini a renvoyé des heures incohérentes." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, propositions, recommande: CYCLES_RECOMMANDES });
}
