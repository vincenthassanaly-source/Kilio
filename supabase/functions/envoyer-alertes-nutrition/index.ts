// Appelée toutes les minutes par pg_cron (cf. scripts/migration-alertes-nutrition-2026-10-11.sql).
// Deux notifications, chacune au plus une fois par jour (heure de Paris) :
//  • alerte à l'approche de la limite kcal (85 %), ou dépassement si les repas
//    ont été saisis d'un coup ; jamais un jour libre ;
//  • rappel de saisie quand le journal est vide à l'heure réglée (20:00).
// Les repas étant souvent ajoutés directement en base (via Claude), sans Server
// Action, seule cette lecture périodique les voit tous.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  alerteKcalDue,
  composerAlerteKcal,
  composerRappelSaisie,
  rappelSaisieDu,
  resumeKcal,
  type EntreeKcal,
} from "./compose.ts";

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

type Colonne = "alerte_kcal_dernier_envoi" | "rappel_saisie_dernier_envoi";

/** Réserve le jour AVANT d'envoyer (deux invocations qui se chevauchent : une seule passe). */
async function reserver(colonne: Colonne, today: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("reglages_briefing")
    .update({ [colonne]: today })
    .eq("id", 1)
    .or(`${colonne}.is.null,${colonne}.neq.${today}`)
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}

/** Rend le jour réservé (valeur d'avant) : à appeler quand rien n'a pu être envoyé. */
async function liberer(colonne: Colonne, today: string, precedent: string | null): Promise<void> {
  await supabase.from("reglages_briefing").update({ [colonne]: precedent }).eq("id", 1).eq(colonne, today);
}

/** `echecs` : envois refusés pour une autre raison qu'un abonnement expiré (404/410),
 * ou lecture des abonnements impossible. */
async function envoyerATous(
  message: { title: string; body: string },
  url: string
): Promise<{ sent: number; expired: number; echecs: number }> {
  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (subsError) {
    console.error("envoyer-alertes-nutrition: lecture des abonnements impossible", subsError.message);
    return { sent: 0, expired: 0, echecs: 1 };
  }
  const payload = JSON.stringify({ title: message.title, body: message.body, url });
  let sent = 0;
  let expired = 0;
  let echecs = 0;
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        expired++;
      } else {
        echecs++;
        console.error("envoyer-alertes-nutrition: échec d'envoi push", statusCode ?? err);
      }
    }
  }
  return { sent, expired, echecs };
}

Deno.serve(async () => {
  const { data: reglages, error: reglagesError } = await supabase
    .from("reglages_briefing")
    .select(
      "alerte_kcal_actif, alerte_kcal_dernier_envoi, rappel_saisie_actif, rappel_saisie_heure, rappel_saisie_dernier_envoi"
    )
    .eq("id", 1)
    .single();
  if (reglagesError) return json({ error: reglagesError.message }, 500);

  const { today, minutes } = parisMaintenant(Date.now());
  const alerteAttendue = reglages.alerte_kcal_actif && reglages.alerte_kcal_dernier_envoi !== today;
  const saisieAttendue = reglages.rappel_saisie_actif && reglages.rappel_saisie_dernier_envoi !== today;
  if (!alerteAttendue && !saisieAttendue) return json({ sent: 0, raison: "rien-a-faire" });
  if (!vapidConfigured) {
    return json({ error: "Secrets VAPID non configurés (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)." });
  }

  const [repas, libre, entrainement] = await Promise.all([
    supabase
      .from("journal_repas")
      .select(
        "quantite, aliment:aliments(kcal_100g), recette:recettes(portions, kcal_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g)))"
      )
      .eq("date", today),
    supabase.from("jours_libres").select("date").eq("date", today).maybeSingle(),
    supabase.from("jours_entrainement").select("entraine").eq("date", today).maybeSingle(),
  ]);
  const erreur = repas.error ?? libre.error ?? entrainement.error;
  if (erreur) return json({ error: erreur.message }, 500);

  const { kcal, nbRepas } = resumeKcal((repas.data ?? []) as unknown as EntreeKcal[]);
  const resultat: Record<string, unknown> = {};

  if (alerteAttendue && nbRepas > 0) {
    const jourType = entrainement.data?.entraine ? "entrainement" : "repos";
    const { data: objectif, error } = await supabase
      .from("objectifs_nutritionnels")
      .select("kcal_cible")
      .eq("jour_type", jourType)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);

    const cible = objectif?.kcal_cible ?? null;
    const niveau = alerteKcalDue({ kcal, cible, jourLibre: libre.data !== null, dejaEnvoyee: false });
    if (niveau && cible && (await reserver("alerte_kcal_dernier_envoi", today))) {
      const envoi = await envoyerATous(composerAlerteKcal({ niveau, kcal, cible }), "/nutrition/journal");
      if (envoi.sent === 0 && envoi.echecs > 0) {
        await liberer("alerte_kcal_dernier_envoi", today, reglages.alerte_kcal_dernier_envoi);
      }
      resultat.alerte = { niveau, ...envoi };
    }
  }

  if (
    saisieAttendue &&
    rappelSaisieDu({
      today,
      maintenantMinutes: minutes,
      heure: reglages.rappel_saisie_heure,
      nbRepas,
      dernierEnvoi: reglages.rappel_saisie_dernier_envoi,
    }) &&
    (await reserver("rappel_saisie_dernier_envoi", today))
  ) {
    const envoi = await envoyerATous(composerRappelSaisie(), "/nutrition/journal");
    if (envoi.sent === 0 && envoi.echecs > 0) {
      await liberer("rappel_saisie_dernier_envoi", today, reglages.rappel_saisie_dernier_envoi);
    }
    resultat.saisie = envoi;
  }

  return json({ kcal: Math.round(kcal), nbRepas, ...resultat });
});
