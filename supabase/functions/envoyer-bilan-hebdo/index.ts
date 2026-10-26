// Appelée toutes les minutes par pg_cron (cf. scripts/migration-bilan-sante-2026-10-11.sql).
// Une fois par semaine, au jour et à l'heure réglés dans `reglages_briefing`
// (dimanche 18:00 par défaut, heure de Paris), envoie le « Bilan de la semaine » :
// kcal moyens contre la limite, séances faites, poids lissé et tour de taille.
// Un tap ouvre /nutrition/bilan. Les chiffres viennent de compose.ts, le même
// module que l'écran du Bilan.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bilanDu,
  composerBilanHebdo,
  decalerDate,
  evolutionPoids,
  evolutionTaille,
  kcalParJour,
  semaineDe,
  syntheseKcal,
  type EntreeKcal,
  type JourKcal,
  type Mesure,
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
const NB_JOURS_MESURES = 60;

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
    .select("bilan_actif, bilan_jour, bilan_heure, bilan_dernier_envoi")
    .eq("id", 1)
    .single();
  if (reglagesError) return json({ error: reglagesError.message }, 500);
  if (!reglages.bilan_actif) return json({ sent: 0, raison: "desactive" });

  const { today, minutes } = parisMaintenant(Date.now());
  if (
    !bilanDu({
      today,
      maintenantMinutes: minutes,
      jour: reglages.bilan_jour,
      heure: reglages.bilan_heure,
      dernierEnvoi: reglages.bilan_dernier_envoi,
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
    .update({ bilan_dernier_envoi: today })
    .eq("id", 1)
    .or(`bilan_dernier_envoi.is.null,bilan_dernier_envoi.neq.${today}`)
    .select("id");
  if (reserveError) return json({ error: reserveError.message }, 500);
  if (!reserve || reserve.length === 0) return json({ sent: 0, raison: "deja-envoye" });

  // La réservation protège des invocations simultanées, mais elle ne doit pas
  // faire perdre le bilan de la semaine : on rend le jour quand rien n'a pu partir
  // (erreur de lecture, aucun envoi réussi), pour que la prochaine invocation retente.
  const dernierEnvoiPrecedent = reglages.bilan_dernier_envoi;
  const liberer = () =>
    supabase.from("reglages_briefing").update({ bilan_dernier_envoi: dernierEnvoiPrecedent }).eq("id", 1).eq("bilan_dernier_envoi", today);
  const echec = async (message: string) => {
    await liberer();
    return json({ error: message }, 500);
  };

  const debut = decalerDate(today, -6);
  const semaine = semaineDe(today);
  const [repas, objectifs, entrainement, libres, seances, mesures] = await Promise.all([
    supabase
      .from("journal_repas")
      .select(
        "date, quantite, aliment:aliments(kcal_100g), recette:recettes(portions, kcal_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g)))"
      )
      .gte("date", debut)
      .lte("date", today),
    supabase.from("objectifs_nutritionnels").select("jour_type, kcal_cible"),
    supabase.from("jours_entrainement").select("date").eq("entraine", true).gte("date", debut).lte("date", today),
    supabase.from("jours_libres").select("date").gte("date", debut).lte("date", today),
    supabase.from("entrainements").select("routine_id, type_seance").gte("date", semaine.debut).lte("date", semaine.fin),
    supabase
      .from("mesures_corps")
      .select("date, poids_kg, tour_taille_cm")
      .gte("date", decalerDate(today, -NB_JOURS_MESURES))
      .lte("date", today)
      .order("date"),
  ]);
  const erreur = repas.error ?? objectifs.error ?? entrainement.error ?? libres.error ?? seances.error ?? mesures.error;
  if (erreur) return echec(erreur.message);

  // Séances de la semaine : un type (Push / Pull / Legs) est fait dès qu'un entraînement
  // lui est rattaché, par son type enregistré ou, à défaut, par sa routine.
  const idsRoutines = [...new Set((seances.data ?? []).map((e) => e.routine_id).filter((id): id is string => id !== null))];
  const { data: typesRoutines, error: erreurRoutines } = idsRoutines.length
    ? await supabase.from("routines").select("id, type_seance").in("id", idsRoutines)
    : { data: [], error: null };
  if (erreurRoutines) return echec(erreurRoutines.message);
  const typeDeRoutine = new Map((typesRoutines ?? []).map((r) => [r.id as string, r.type_seance as string | null]));
  const typesFaits = new Set<string>();
  for (const e of seances.data ?? []) {
    const type = e.type_seance ?? (e.routine_id ? typeDeRoutine.get(e.routine_id) : null);
    if (type) typesFaits.add(type);
  }

  const cibles = new Map((objectifs.data ?? []).map((o) => [o.jour_type as string, o.kcal_cible as number]));
  const joursEntrainement = new Set((entrainement.data ?? []).map((j) => j.date as string));
  const joursLibres = new Set((libres.data ?? []).map((j) => j.date as string));
  const parJour = kcalParJour((repas.data ?? []) as unknown as EntreeKcal[]);

  const jours: JourKcal[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = decalerDate(today, -i);
    const { kcal, nbRepas } = parJour.get(date) ?? { kcal: 0, nbRepas: 0 };
    jours.push({
      date,
      kcal,
      cible: cibles.get(joursEntrainement.has(date) ? "entrainement" : "repos") ?? null,
      nbRepas,
      libre: joursLibres.has(date),
      aujourdhui: date === today,
    });
  }

  const releves: Mesure[] = (mesures.data ?? []).map((m) => ({
    date: m.date as string,
    poids_kg: m.poids_kg === null ? null : Number(m.poids_kg),
    tour_taille_cm: m.tour_taille_cm === null ? null : Number(m.tour_taille_cm),
  }));
  const message = composerBilanHebdo({
    kcal: syntheseKcal(jours),
    seances: { faites: typesFaits.size, total: 3 },
    poids: evolutionPoids(releves, today),
    taille: evolutionTaille(releves, today),
  });

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (subsError) return echec(subsError.message);

  const payload = JSON.stringify({ title: message.title, body: message.body, url: "/nutrition/bilan" });
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
        console.error("envoyer-bilan-hebdo: échec d'envoi push", statusCode ?? err);
      }
    }
  }

  // Aucun envoi réussi alors que des appareils étaient joignables en principe :
  // on libère le jour pour retenter à la prochaine invocation.
  if (sent === 0 && echecs > 0) await liberer();

  return json({ sent, expired, echecs });
});
