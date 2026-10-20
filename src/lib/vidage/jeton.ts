// Jeton signé (HMAC-SHA256) pour le verrou de « Vider ma tête » : session de 15 minutes et défi
// WebAuthn à usage unique. Format « charge.signature », les deux en base64url. Serveur seulement.
import { createHmac, timingSafeEqual } from "node:crypto";

export type ChargeJeton = { type: string; exp: number; defi?: string };

function signature(corps: string, secret: string): string {
  return createHmac("sha256", secret).update(corps).digest("base64url");
}

export function signerJeton(charge: ChargeJeton, secret: string): string {
  const corps = Buffer.from(JSON.stringify(charge)).toString("base64url");
  return `${corps}.${signature(corps, secret)}`;
}

/** Charge du jeton si la signature est bonne et qu'il n'est pas expiré ; null sinon. */
export function lireJeton(jeton: string | undefined, secret: string, maintenant: number = Date.now()): ChargeJeton | null {
  if (!jeton) return null;
  const morceaux = jeton.split(".");
  if (morceaux.length !== 2 || !morceaux[0] || !morceaux[1]) return null;
  const [corps, recue] = morceaux;
  const attendue = Buffer.from(signature(corps, secret));
  const fournie = Buffer.from(recue);
  if (attendue.length !== fournie.length || !timingSafeEqual(attendue, fournie)) return null;
  try {
    const charge = JSON.parse(Buffer.from(corps, "base64url").toString("utf8")) as Partial<ChargeJeton> | null;
    if (!charge || typeof charge.type !== "string" || typeof charge.exp !== "number" || charge.exp <= maintenant) return null;
    return { type: charge.type, exp: charge.exp, defi: typeof charge.defi === "string" ? charge.defi : undefined };
  } catch {
    return null;
  }
}
