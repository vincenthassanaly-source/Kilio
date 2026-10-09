// Appelée toutes les minutes par pg_cron (cf.
// scripts/migration-cron-rappels-taches-2026-09-01.sql). Pour chaque tâche
// dont le rappel arrive à échéance, envoie une notification push à tous
// les abonnements enregistrés (mono-utilisateur mais potentiellement
// plusieurs devices/navigateurs abonnés).
//
// web-push (npm) est utilisé pour la signature VAPID et le chiffrement du
// payload (aes128gcm) : sa dépendance à node:crypto (createECDH,
// createCipheriv, createSign) est supportée par la compatibilité NPM des
// Supabase Edge Functions (Deno). Aucune librairie Deno-native équivalente
// n'a été trouvée à jour, donc c'est le choix retenu — cf. limitation
// documentée dans le rapport de la Phase 4.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

// Secrets VAPID pas encore configurés (cf. rapport Phase 4) : le cron
// pg_cron appelle cette fonction toutes les minutes dès la migration
// appliquée, avant même que Vincent les ait renseignés. On échoue
// proprement (200, pas d'exception non gérée) plutôt que de laisser
// webpush.setVapidDetails lever au chargement du module.
const vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type TacheCandidate = {
  id: string;
  titre: string;
  echeance: string; // YYYY-MM-DD
  heure: string | null; // HH:MM:SS, null pour une tâche toute la journée
  rappel_minutes: number;
};

// Ancrage horaire d'un rappel "toute la journée" (rappel_minutes = 1440,
// seule valeur possible pour ces tâches) : faute d'heure précise sur la
// tâche, la notification part la veille à 18h00 (Paris).
const RAPPEL_JOURNEE_HEURE_ANCRAGE = "18:00:00";

// L'app est mono-utilisateur (Vincent, en France) et echeance/heure sont
// saisies via des <input date>/<input time> qui reflètent l'heure locale
// du navigateur — donc l'heure de Paris, pas UTC. On convertit le
// "echeance + heure" (horloge murale) en instant UTC via Intl, qui gère
// automatiquement les transitions heure d'été/hiver.
const PARIS_TZ = "Europe/Paris";

function parisOffsetMinutes(approxUtc: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(approxUtc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return (asUtc - approxUtc.getTime()) / 60_000;
}

function tacheHeureUtcMs(tache: TacheCandidate): number {
  const [year, month, day] = tache.echeance.split("-").map(Number);
  const [hour, minute, second] = (tache.heure ?? RAPPEL_JOURNEE_HEURE_ANCRAGE).split(":").map(Number);
  const approxUtcMs = Date.UTC(year, month - 1, day, hour, minute, second ?? 0);
  const offsetMinutes = parisOffsetMinutes(new Date(approxUtcMs));
  return approxUtcMs - offsetMinutes * 60_000;
}

function isDue(tache: TacheCandidate, nowMs: number): boolean {
  const rappelMs = tacheHeureUtcMs(tache) - tache.rappel_minutes * 60_000;
  // Fenêtre [now - 1 min, now] : tolérance pour la cadence à la minute de
  // pg_cron, qui peut invoquer la fonction avec un léger décalage.
  return rappelMs <= nowMs && rappelMs > nowMs - 60_000;
}


// --- Événements (table `evenements`) ------------------------------------------
// Un événement peut être récurrent : on ne stocke qu'une ligne, et
// `rappel_occurrence_envoyee` retient la date de la dernière occurrence déjà
// rappelée (un rappel par occurrence). Les occurrences candidates sont celles
// d'aujourd'hui et de demain (Paris) : le rappel le plus long est « la veille ».

type EvenementCandidate = {
  id: string;
  titre: string;
  date: string;
  heure: string;
  toute_la_journee: boolean;
  rappel_minutes: number;
  rappel_occurrence_envoyee: string | null;
  recurrence_frequence: "quotidien" | "hebdomadaire" | "mensuel" | "annuel" | null;
  recurrence_fin: string | null;
};

function dateParisISO(ms: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: PARIS_TZ }).format(new Date(ms));
}

function dernierJourDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

function evenementAlieuLe(e: EvenementCandidate, jour: string): boolean {
  if (jour < e.date) return false;
  if (!e.recurrence_frequence) return jour === e.date;
  if (e.recurrence_fin && jour > e.recurrence_fin) return false;
  const [a0, m0, j0] = e.date.split("-").map(Number);
  const [a, m, j] = jour.split("-").map(Number);
  switch (e.recurrence_frequence) {
    case "quotidien":
      return true;
    case "hebdomadaire":
      return (Date.UTC(a, m - 1, j) - Date.UTC(a0, m0 - 1, j0)) / 86_400_000 % 7 === 0;
    case "mensuel":
      return j === Math.min(j0, dernierJourDuMois(a, m));
    case "annuel":
      return m === m0 && j === Math.min(j0, dernierJourDuMois(a, m));
  }
}

function evenementRappelDu(e: EvenementCandidate, jour: string, nowMs: number): boolean {
  const [year, month, day] = jour.split("-").map(Number);
  const [hour, minute] = (e.toute_la_journee ? RAPPEL_JOURNEE_HEURE_ANCRAGE : e.heure).split(":").map(Number);
  const approxUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const debutMs = approxUtcMs - parisOffsetMinutes(new Date(approxUtcMs)) * 60_000;
  const rappelMs = debutMs - e.rappel_minutes * 60_000;
  return rappelMs <= nowMs && rappelMs > nowMs - 60_000;
}

Deno.serve(async () => {
  if (!vapidConfigured) {
    return new Response(
      JSON.stringify({ error: "Secrets VAPID non configurés (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const nowMs = Date.now();

  const { data: candidatesAvecHeure, error: fetchErrorAvecHeure } = await supabase
    .from("taches")
    .select("id, titre, echeance, heure, rappel_minutes")
    .eq("fait", false)
    .eq("toute_la_journee", false)
    .not("heure", "is", null)
    .not("rappel_minutes", "is", null)
    .is("rappel_envoye_le", null);

  if (fetchErrorAvecHeure) {
    return new Response(JSON.stringify({ error: fetchErrorAvecHeure.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Tâches toute la journée : pas de filtre sur heure (forcément null pour
  // elles), seul rappel_minutes = 1440 (la veille) est proposé côté client.
  const { data: candidatesJournee, error: fetchErrorJournee } = await supabase
    .from("taches")
    .select("id, titre, echeance, heure, rappel_minutes")
    .eq("fait", false)
    .eq("toute_la_journee", true)
    .eq("rappel_minutes", 1440)
    .is("rappel_envoye_le", null);

  if (fetchErrorJournee) {
    return new Response(JSON.stringify({ error: fetchErrorJournee.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const candidates = [...(candidatesAvecHeure ?? []), ...(candidatesJournee ?? [])];

  const dues = candidates.filter((t): t is TacheCandidate => isDue(t as TacheCandidate, nowMs));

  // Rappels reportés depuis la notification (actions +1h/+1 jour/+1 semaine,
  // cf. public/sw.js et /api/taches/[id]/reporter-rappel) : indépendants du
  // calcul echeance/heure/rappel_minutes ci-dessus, qui ne les resélectionne
  // pas puisque rappel_envoye_le est déjà posé pour elles.
  const { data: candidatesReportees, error: fetchErrorReportees } = await supabase
    .from("taches")
    .select("id, titre")
    .eq("fait", false)
    .not("rappel_reporte_jusqua", "is", null)
    .lte("rappel_reporte_jusqua", new Date(nowMs).toISOString());

  if (fetchErrorReportees) {
    return new Response(JSON.stringify({ error: fetchErrorReportees.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reportees = candidatesReportees ?? [];

  // Événements avec rappel. Table absente (migration non appliquée) : ignorés.
  const { data: candidatsEvenements } = await supabase
    .from("evenements")
    .select(
      "id, titre, date, heure, toute_la_journee, rappel_minutes, rappel_occurrence_envoyee, recurrence_frequence, recurrence_fin"
    )
    .not("rappel_minutes", "is", null);

  const aujourdhui = dateParisISO(nowMs);
  const demain = dateParisISO(nowMs + 86_400_000);
  const evenementsDus: { evenement: EvenementCandidate; jour: string }[] = [];
  for (const e of (candidatsEvenements ?? []) as EvenementCandidate[]) {
    for (const jour of [aujourdhui, demain]) {
      if (e.rappel_occurrence_envoyee === jour) continue;
      if (evenementAlieuLe(e, jour) && evenementRappelDu(e, jour, nowMs)) {
        evenementsDus.push({ evenement: e, jour });
        break;
      }
    }
  }

  if (dues.length === 0 && reportees.length === 0 && evenementsDus.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let expired = 0;

  async function envoyerEtMarquer(payload: string, marquer: () => Promise<unknown>) {
    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          expired++;
        }
        // Autres erreurs (timeout, 5xx du service push, ...) : ignorées
        // pour ne pas bloquer les autres abonnements/tâches. Le marquage
        // ci-dessous a quand même lieu pour ne pas spammer en boucle.
      }
    }

    await marquer();
  }

  for (const tache of dues) {
    const body =
      tache.rappel_minutes === 1440
        ? "demain"
        : tache.rappel_minutes === 60
          ? "dans 1h"
          : `dans ${tache.rappel_minutes} min`;
    const payload = JSON.stringify({
      title: tache.titre,
      body,
      url: `/agenda?tache=${tache.id}`,
      tacheId: tache.id,
    });

    await envoyerEtMarquer(payload, () =>
      supabase
        .from("taches")
        .update({ rappel_envoye_le: new Date().toISOString() })
        .eq("id", tache.id)
    );
  }

  for (const tache of reportees) {
    const payload = JSON.stringify({
      title: tache.titre,
      body: "Rappel reporté",
      url: `/agenda?tache=${tache.id}`,
      tacheId: tache.id,
    });

    await envoyerEtMarquer(payload, () =>
      supabase.from("taches").update({ rappel_reporte_jusqua: null }).eq("id", tache.id)
    );
  }

  for (const { evenement, jour } of evenementsDus) {
    const body = evenement.toute_la_journee
      ? "demain"
      : evenement.rappel_minutes === 1440
        ? `demain à ${evenement.heure.slice(0, 5)}`
        : evenement.rappel_minutes === 60
          ? `dans 1h (${evenement.heure.slice(0, 5)})`
          : `dans ${evenement.rappel_minutes} min (${evenement.heure.slice(0, 5)})`;
    const payload = JSON.stringify({
      title: evenement.titre,
      body,
      url: `/agenda?date=${jour}`,
    });

    await envoyerEtMarquer(payload, () =>
      supabase.from("evenements").update({ rappel_occurrence_envoyee: jour }).eq("id", evenement.id)
    );
  }

  return new Response(
    JSON.stringify({
      taches: dues.length,
      reportees: reportees.length,
      evenements: evenementsDus.length,
      sent,
      expired,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
