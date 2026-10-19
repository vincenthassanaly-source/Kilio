// Appelée par pg_cron (cf. scripts/migration-rappel-repos-2026-10-19.sql) quand un
// rappel de fin de repos arrive à échéance dans les 6 prochaines secondes. Elle
// attend l'échéance exacte, vérifie que le repos n'a été ni annulé ni modifié
// entre-temps (passé, ajusté, séance terminée), puis envoie le push à tous les
// appareils abonnés. Même mécanique VAPID que envoyer-rappels-taches.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const HORIZON_MS = 6_000;
// Un rappel resté en retard de plus de 2 min (cron manqué, panne) n'a plus de sens : on l'écarte.
const RETARD_MAX_MS = 120_000;

const json = (corps: unknown) => new Response(JSON.stringify(corps), { headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  if (!vapidConfigured) {
    return json({ error: "Secrets VAPID non configurés (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)." });
  }

  // Réserve les rappels proches : `envoye = true` empêche le cron suivant (5 s plus
  // tard) de les reprendre pendant qu'on attend l'échéance.
  const { data: reserves, error } = await supabase
    .from("rappels_repos")
    .update({ envoye: true })
    .eq("envoye", false)
    .lte("fin_a", new Date(Date.now() + HORIZON_MS).toISOString())
    .select("id, fin_a, titre, corps, url");

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  if (!reserves || reserves.length === 0) return json({ sent: 0 });

  const { data: subscriptions } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");

  let sent = 0;
  for (const rappel of reserves) {
    const finMs = new Date(rappel.fin_a).getTime();
    if (Date.now() - finMs > RETARD_MAX_MS) continue;

    const attente = finMs - Date.now();
    if (attente > 0) await new Promise((resolve) => setTimeout(resolve, attente));

    // Repos annulé (ligne supprimée) ou modifié (nouvelle échéance, reprise par le
    // prochain passage du cron) pendant l'attente : rien à envoyer.
    const { data: actuel } = await supabase.from("rappels_repos").select("fin_a").eq("id", rappel.id).maybeSingle();
    if (!actuel || new Date(actuel.fin_a).getTime() !== finMs) continue;

    const payload = JSON.stringify({ type: "repos", title: rappel.titre, body: rappel.corps, url: rappel.url });
    for (const sub of subscriptions ?? []) {
      try {
        // TTL court : un repos terminé depuis plus d'une minute n'intéresse plus personne.
        // Urgence haute : sinon Android en économie d'énergie peut retarder la livraison.
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
          TTL: 60,
          urgency: "high",
        });
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return json({ rappels: reserves.length, sent });
});
