// Appelée toutes les minutes par pg_cron (cf. scripts/migration-cron-rappel-vidage-2026-10-19.sql).
// Une fois par jour, à l'heure réglée dans `reglages_briefing` (21:00 par défaut,
// heure de Paris), rappelle d'écrire dans « Vider ma tête » — sauf si la feuille
// du jour existe déjà. Un tap ouvre /vider-ma-tete.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { composerRappelVidage, rappelVidageDu } from "./compose.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

const vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const PARIS_TZ = "Europe/Paris";

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

function parisMaintenant(ms: number): { today: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { today: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

Deno.serve(async () => {
  const { data: reglages, error: reglagesError } = await supabase
    .from("reglages_briefing")
    .select("vidage_actif, vidage_heure, vidage_dernier_envoi")
    .eq("id", 1)
    .single();
  if (reglagesError) return json({ error: reglagesError.message }, 500);
  if (!reglages.vidage_actif) return json({ sent: 0, raison: "desactive" });

  const { today, minutes } = parisMaintenant(Date.now());
  const { data: feuille, error: feuilleError } = await supabase
    .from("feuilles_vidage")
    .select("jour")
    .eq("jour", today)
    .maybeSingle();
  if (feuilleError) return json({ error: feuilleError.message }, 500);

  if (
    !rappelVidageDu({
      today,
      maintenantMinutes: minutes,
      heure: reglages.vidage_heure,
      feuilleEcrite: feuille !== null,
      dernierEnvoi: reglages.vidage_dernier_envoi,
    })
  ) {
    return json({ sent: 0, raison: "pas-l-heure" });
  }
  if (!vapidConfigured) {
    return json({ error: "Secrets VAPID non configurés (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)." });
  }

  // Réserve le jour AVANT d'envoyer (deux invocations qui se chevauchent : une seule passe).
  const { data: reserve, error: reserveError } = await supabase
    .from("reglages_briefing")
    .update({ vidage_dernier_envoi: today })
    .eq("id", 1)
    .or(`vidage_dernier_envoi.is.null,vidage_dernier_envoi.neq.${today}`)
    .select("id");
  if (reserveError) return json({ error: reserveError.message }, 500);
  if (!reserve || reserve.length === 0) return json({ sent: 0, raison: "deja-envoye" });

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (subsError) return json({ error: subsError.message }, 500);

  const message = composerRappelVidage();
  const payload = JSON.stringify({ title: message.title, body: message.body, url: "/vider-ma-tete" });
  let sent = 0;
  let expired = 0;
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        expired++;
      }
    }
  }

  return json({ sent, expired });
});
