// Appelée toutes les minutes par pg_cron (cf.
// scripts/migration-briefing-matin-2026-10-09.sql). Une fois par jour, à
// l'heure réglée dans `reglages_briefing` (07:30 par défaut, heure de Paris),
// envoie à tous les appareils abonnés un résumé de la journée : événements,
// tâches du jour, retards. Rien n'est envoyé si la journée est vide.
//
// Comme envoyer-rappels-taches : web-push (npm) pour la signature VAPID, et
// réponse 200 si les secrets VAPID ne sont pas configurés.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { briefingDu, composerBriefing, type EvenementBriefing, type TacheBriefing } from "./compose.ts";

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

// Date (AAAA-MM-JJ) et minutes depuis minuit, à Paris.
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
    .select("actif, heure, dernier_envoi")
    .eq("id", 1)
    .single();
  if (reglagesError) return json({ error: reglagesError.message }, 500);
  if (!reglages.actif) return json({ sent: 0, raison: "desactive" });

  const { today, minutes } = parisMaintenant(Date.now());
  if (!briefingDu({ maintenantMinutes: minutes, heure: reglages.heure, dernierEnvoi: reglages.dernier_envoi, today })) {
    return json({ sent: 0, raison: "pas-l-heure" });
  }
  if (!vapidConfigured) {
    return json({ error: "Secrets VAPID non configurés (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)." });
  }

  // Réserve le jour AVANT d'envoyer : si deux invocations se chevauchent, une
  // seule passe cette mise à jour conditionnelle (dernier_envoi != today).
  const { data: reserve, error: reserveError } = await supabase
    .from("reglages_briefing")
    .update({ dernier_envoi: today })
    .eq("id", 1)
    .or(`dernier_envoi.is.null,dernier_envoi.neq.${today}`)
    .select("id");
  if (reserveError) return json({ error: reserveError.message }, 500);
  if (!reserve || reserve.length === 0) return json({ sent: 0, raison: "deja-envoye" });

  const [taches, evenements] = await Promise.all([
    supabase
      .from("taches")
      .select("titre, echeance, priorite, heure, toute_la_journee")
      .eq("fait", false)
      .not("echeance", "is", null)
      .lte("echeance", today),
    supabase
      .from("evenements")
      .select("titre, date, heure, toute_la_journee, recurrence_frequence, recurrence_fin")
      .lte("date", today),
  ]);
  if (taches.error) return json({ error: taches.error.message }, 500);
  if (evenements.error) return json({ error: evenements.error.message }, 500);

  const briefing = composerBriefing({
    today,
    taches: (taches.data ?? []) as TacheBriefing[],
    evenements: (evenements.data ?? []) as EvenementBriefing[],
  });
  if (!briefing) return json({ sent: 0, raison: "journee-vide" });

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (subsError) return json({ error: subsError.message }, 500);

  const payload = JSON.stringify({ title: briefing.title, body: briefing.body, url: "/aujourdhui" });
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
