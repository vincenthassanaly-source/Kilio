// Appelée toutes les minutes par pg_cron (cf. scripts/migration-seances-2026-10-11.sql).
// À l'heure d'une séance planifiée aujourd'hui (heure de Paris), envoie un
// rappel push à tous les appareils abonnés, avec les actions « Commencer » et
// « Décaler » (public/sw.js). Crée au passage les séances du jour qui n'existent
// pas encore (l'app ne les crée qu'à son ouverture).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { composerRappelSeance, jourDeSemaine, seanceDue } from "./compose.ts";

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
    .select("seances_rappel_actif")
    .eq("id", 1)
    .single();
  if (reglagesError) return json({ error: reglagesError.message }, 500);
  if (!reglages.seances_rappel_actif) return json({ sent: 0, raison: "desactive" });
  if (!vapidConfigured) {
    return json({ error: "Secrets VAPID non configurés (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)." });
  }

  const { today, minutes } = parisMaintenant(Date.now());

  // Séances du jour absentes (app pas ouverte depuis le début de semaine) : créées ici.
  const { data: creneaux, error: creneauxError } = await supabase
    .from("creneaux_seance")
    .select("id, heure, type")
    .eq("actif", true)
    .eq("jour_semaine", jourDeSemaine(today));
  if (creneauxError) return json({ error: creneauxError.message }, 500);
  if ((creneaux ?? []).length > 0) {
    const { error } = await supabase.from("seances").upsert(
      creneaux!.map((c) => ({ creneau_id: c.id, date_prevue: today, date: today, heure: c.heure, type: c.type })),
      { onConflict: "creneau_id,date_prevue", ignoreDuplicates: true }
    );
    if (error) return json({ error: error.message }, 500);
  }

  const { data: seances, error: seancesError } = await supabase
    .from("seances")
    .select("id, heure, type, date, rappel_envoye_le")
    .eq("date", today)
    .eq("statut", "prevue")
    .is("rappel_envoye_le", null);
  if (seancesError) return json({ error: seancesError.message }, 500);

  const dues = (seances ?? []).filter((s) =>
    seanceDue({ date: s.date, heure: s.heure, today, maintenantMinutes: minutes, rappelEnvoye: s.rappel_envoye_le !== null })
  );
  if (dues.length === 0) return json({ sent: 0, raison: "rien-a-rappeler" });

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (subsError) return json({ error: subsError.message }, 500);

  let sent = 0;
  let expired = 0;
  for (const seance of dues) {
    // Réserve le rappel AVANT d'envoyer (deux invocations qui se chevauchent : un seul envoi).
    const { data: reserve, error: reserveError } = await supabase
      .from("seances")
      .update({ rappel_envoye_le: new Date().toISOString() })
      .eq("id", seance.id)
      .is("rappel_envoye_le", null)
      .select("id");
    if (reserveError || !reserve || reserve.length === 0) continue;

    const message = composerRappelSeance({ type: seance.type, heure: seance.heure });
    const payload = JSON.stringify({ title: message.title, body: message.body, url: "/aujourdhui", seanceId: seance.id });
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
  }

  return json({ seances: dues.length, sent, expired });
});
