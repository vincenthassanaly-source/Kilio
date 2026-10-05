import { NextResponse, type NextRequest } from "next/server";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import {
  CYCLES_RECOMMANDES,
  DELAI_ENDORMISSEMENT_MIN,
  DUREE_CYCLE_MIN,
  NOMBRES_CYCLES,
  calculerPropositions,
  heureDepuisMinutes,
  minutesDepuisHeure,
  validerPropositions,
} from "@/lib/reveil/cycles";

// Heures de réveil calées sur la fin d'un cycle de sommeil, calculées par
// Gemini à partir de l'heure locale envoyée par l'appareil (le serveur Vercel
// est en UTC : il ne connaît pas l'heure de Vincent). La réponse de Gemini est
// vérifiée contre le calcul de référence (lib/reveil/cycles.ts) avant d'être
// renvoyée ; sinon l'écran affiche une erreur avec « Réessayer ».
// Route volontairement ouverte, sans session : l'app est mono-utilisateur.

const TIMEOUT_MS = 8_000;
const MAX_ESSAIS = 2;

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
  const debut = minutesDepuisHeure(heureActuelle) ?? 0;
  const endormissement = heureDepuisMinutes(debut + DELAI_ENDORMISSEMENT_MIN);
  // Les durées sont données déjà en minutes et en heures : le modèle n'a plus
  // qu'une addition d'heure à faire par proposition (sans elles, un modèle
  // « lite » décalait les trois heures de 30 min).
  const durees = NOMBRES_CYCLES.map((n) => {
    const minutes = n * DUREE_CYCLE_MIN;
    return `- N = ${n} : ${minutes} minutes (${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")})`;
  });
  return [
    `Il est ${heureActuelle} (heure locale, format 24 h). Je me couche maintenant et je m'endors en ${DELAI_ENDORMISSEMENT_MIN} minutes, donc à ${endormissement}.`,
    `Donne les heures de réveil qui tombent à la FIN d'un cycle de sommeil complet (un cycle = ${DUREE_CYCLE_MIN} minutes).`,
    `Pour chaque nombre de cycles N, heure de réveil = ${endormissement} + la durée suivante (modulo 24 h) :`,
    ...durees,
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

  // Un second essai si Gemini répond mais se trompe dans le calcul : un seul,
  // sans lui montrer la bonne réponse (sinon il se contenterait de la recopier).
  let dernier: { recu: string } | null = null;
  for (let essai = 1; essai <= MAX_ESSAIS; essai++) {
    const resultat = await appelerGemini({
      prompt: prompt(heureActuelle),
      schema: SCHEMA,
      timeoutMs: TIMEOUT_MS,
      temperature: 0,
      etiquette: "reveil-cycles",
    });

    if (!resultat.ok) {
      // `detail` (statut HTTP et message de Google, délai dépassé, clé absente…)
      // est renvoyé tel quel : il ne contient jamais la clé, et c'est lui qui
      // dit pourquoi Gemini n'a pas répondu.
      return NextResponse.json(
        {
          ok: false,
          message: resultat.code === "quota" ? MESSAGE_QUOTA_GEMINI : "Gemini n'a pas répondu.",
          detail: resultat.detail,
        },
        { status: resultat.code === "quota" ? 429 : 502 }
      );
    }

    const propositions = validerPropositions(resultat.brut, heureActuelle);
    if (propositions) {
      return NextResponse.json({ ok: true, propositions, recommande: CYCLES_RECOMMANDES });
    }
    dernier = { recu: JSON.stringify(resultat.brut).slice(0, 200) };
    console.warn(`[reveil-cycles] Essai ${essai}/${MAX_ESSAIS} : heures incohérentes (${dernier.recu}).`);
  }

  // Ce que Gemini a renvoyé face à l'attendu : visible à l'écran pour
  // distinguer une erreur de calcul d'un problème de format.
  const attendu = calculerPropositions(heureActuelle)
    .map((p) => `${p.cycles}→${p.heure}`)
    .join(", ");
  return NextResponse.json(
    {
      ok: false,
      message: "Gemini a renvoyé des heures incohérentes.",
      detail: `Reçu : ${dernier?.recu ?? "?"} — attendu : ${attendu}.`,
    },
    { status: 502 }
  );
}
