// Envoi des notifications push, commun à toutes les Edge Functions.
//
// web-push (npm) signe en VAPID et chiffre le contenu (aes128gcm) ; sa
// dépendance à node:crypto est supportée par la compatibilité npm de Deno.
//
// Règles communes (rapport reports/2026-11-05-revue-securite-tests-offline-dette.md) :
//   - chaque envoi a un délai maximal : un service push qui ne répond pas ne
//     bloque plus la fonction au-delà de la minute suivante du cron ;
//   - chaque échec est journalisé (console.error, visible dans les journaux
//     de la fonction) ; seul un abonnement expiré (404/410) est supprimé ;
//   - les erreurs renvoient un statut 500, jamais un 200 trompeur.
import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

/** Faux tant que les secrets VAPID ne sont pas configurés : rien ne peut partir. */
export const vapidConfigure = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (vapidConfigure) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

export const ERREUR_VAPID = "Secrets VAPID non configurés (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT).";

const DELAI_ENVOI_MS = 10_000;

export const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

/** Réponse 500 journalisée : visible dans net._http_response ET dans les journaux de la fonction. */
export function erreurServeur(etiquette: string, message: string, details: Record<string, unknown> = {}): Response {
  console.error(`[${etiquette}] ${message}`);
  return json({ error: message, ...details }, 500);
}

export type Abonnement = { id: string; endpoint: string; p256dh: string; auth: string };
export type BilanEnvoi = { sent: number; expired: number; echecs: number };

/** Abonnements enregistrés, ou l'erreur de lecture. */
export async function lireAbonnements(
  supabase: SupabaseClient
): Promise<{ abonnements: Abonnement[]; erreur: null } | { abonnements: null; erreur: string }> {
  const { data, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error) return { abonnements: null, erreur: error.message };
  return { abonnements: (data ?? []) as Abonnement[], erreur: null };
}

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return String(err).slice(0, 200);
}

/** Envoie `payload` à chaque abonnement. Ne lève jamais. */
export async function envoyerATous(
  supabase: SupabaseClient,
  abonnements: readonly Abonnement[],
  payload: string,
  etiquette: string,
  options: { TTL?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {}
): Promise<BilanEnvoi> {
  const bilan: BilanEnvoi = { sent: 0, expired: 0, echecs: 0 };
  for (const sub of abonnements) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        ...options,
        timeout: DELAI_ENVOI_MS,
      });
      bilan.sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        bilan.expired++;
        const { error } = await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        if (error) console.error(`[${etiquette}] abonnement expiré non supprimé : ${error.message}`);
      } else {
        bilan.echecs++;
        console.error(`[${etiquette}] envoi push en échec (${statusCode ?? "sans réponse"}) : ${messageErreur(err)}`);
      }
    }
  }
  return bilan;
}

/**
 * Aucun appareil n'a reçu la notification à cause d'une panne passagère
 * (et non parce qu'il n'y a aucun abonné) : l'envoi est à refaire.
 */
export function aRefaire(bilan: BilanEnvoi): boolean {
  return bilan.sent === 0 && bilan.echecs > 0;
}

/**
 * Réserve le jour dans une colonne « dernier envoi » de reglages_briefing,
 * AVANT d'envoyer : si deux invocations se chevauchent, une seule passe cette
 * mise à jour conditionnelle. `erreur` distingue une panne d'un « déjà fait ».
 */
export async function reserverJour(
  supabase: SupabaseClient,
  colonne: string,
  today: string
): Promise<{ reserve: boolean; erreur: string | null }> {
  const { data, error } = await supabase
    .from("reglages_briefing")
    .update({ [colonne]: today })
    .eq("id", 1)
    .or(`${colonne}.is.null,${colonne}.neq.${today}`)
    .select("id");
  if (error) return { reserve: false, erreur: error.message };
  return { reserve: (data?.length ?? 0) > 0, erreur: null };
}

/**
 * Rend le jour réservé (valeur d'avant) quand rien n'a pu partir, pour que la
 * prochaine invocation retente. Sans effet si une autre invocation l'a changé.
 */
export async function libererJour(
  supabase: SupabaseClient,
  colonne: string,
  today: string,
  precedent: string | null,
  etiquette: string
): Promise<void> {
  const { error } = await supabase
    .from("reglages_briefing")
    .update({ [colonne]: precedent })
    .eq("id", 1)
    .eq(colonne, today);
  if (error) console.error(`[${etiquette}] jour réservé non libéré (${colonne}) : ${error.message}`);
}
