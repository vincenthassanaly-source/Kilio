// Verrou de « Vider ma tête » côté serveur : la session déverrouillée est un cookie signé de
// 15 minutes (renouvelé à chaque action), et les défis WebAuthn un cookie signé de 5 minutes à
// usage unique. Sans VIDAGE_SESSION_SECRET (32 caractères minimum), le module reste fermé.
import { cookies, headers } from "next/headers";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { lireJeton, signerJeton } from "./jeton";

const MESSAGE_VERROUILLE = "Le module est verrouillé. Déverrouille-le avec ton empreinte.";

const COOKIE_SESSION = "kilio_vidage";
const COOKIE_DEFI = "kilio_vidage_defi";
const DUREE_SESSION_MS = 15 * 60 * 1000;
const DUREE_DEFI_MS = 5 * 60 * 1000;

export type TypeDefi = "inscription" | "connexion";

function secret(): string | null {
  const valeur = process.env.VIDAGE_SESSION_SECRET;
  return valeur && valeur.length >= 32 ? valeur : null;
}

/** Vrai quand un secret de session est configuré : sans lui, personne ne peut se déverrouiller. */
export function verrouConfigure(): boolean {
  return verrouDesactive() || secret() !== null;
}

/**
 * Désactivation réservée au banc d'essai e2e (qui ne peut pas simuler un capteur biométrique) :
 * exige AUSSI le drapeau des tests, qui n'existe jamais en production.
 */
export function verrouDesactive(): boolean {
  return process.env.E2E_VERROU_DESACTIVE === "1" && process.env.EXPOSE_TESTING_API === "1";
}

const optionsCookie = (dureeMs: number) =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(dureeMs / 1000),
  }) as const;

export async function sessionValide(): Promise<boolean> {
  if (verrouDesactive()) return true;
  const cle = secret();
  if (!cle) return false;
  const jeton = (await cookies()).get(COOKIE_SESSION)?.value;
  return lireJeton(jeton, cle)?.type === "session";
}

/** Ouvre (ou renouvelle) la session de 15 minutes. Faux si le secret n'est pas configuré. */
export async function ouvrirSession(): Promise<boolean> {
  const cle = secret();
  if (!cle) return false;
  const jeton = signerJeton({ type: "session", exp: Date.now() + DUREE_SESSION_MS }, cle);
  (await cookies()).set(COOKIE_SESSION, jeton, optionsCookie(DUREE_SESSION_MS));
  return true;
}

export async function fermerSession(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSION);
}

/** À placer en tête de chaque Server Action du module : refuse si verrouillé, renouvelle sinon. */
export async function exigerSession(): Promise<ActionResult> {
  if (!(await sessionValide())) return fail(MESSAGE_VERROUILLE);
  if (!verrouDesactive()) await ouvrirSession();
  return ok();
}

export async function memoriserDefi(defi: string, type: TypeDefi): Promise<boolean> {
  const cle = secret();
  if (!cle) return false;
  const jeton = signerJeton({ type, exp: Date.now() + DUREE_DEFI_MS, defi }, cle);
  (await cookies()).set(COOKIE_DEFI, jeton, optionsCookie(DUREE_DEFI_MS));
  return true;
}

/** Défi en attente du type voulu, aussitôt oublié : il ne sert qu'une fois. */
export async function consommerDefi(type: TypeDefi): Promise<string | null> {
  const cle = secret();
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_DEFI)?.value;
  magasin.delete(COOKIE_DEFI);
  if (!cle) return null;
  const charge = lireJeton(jeton, cle);
  return charge?.type === type && charge.defi ? charge.defi : null;
}

/** Identifiant et origine du site tels que le navigateur les voit (derrière le proxy de Vercel). */
export async function origineAttendue(): Promise<{ rpID: string; origin: string }> {
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "localhost";
  const protocole = entetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  return { rpID: hote.replace(/:\d+$/, ""), origin: `${protocole}://${hote}` };
}
