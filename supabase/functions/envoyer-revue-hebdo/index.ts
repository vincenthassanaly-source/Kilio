// Appelée toutes les minutes par pg_cron (cf.
// scripts/migration-briefing-et-revue-2026-10-09.sql). Une fois par semaine, au jour
// et à l'heure réglés dans `reglages_briefing` (dimanche 18:00 par défaut,
// heure de Paris), envoie un rappel « revue de la semaine » à tous les
// appareils abonnés ; un tap ouvre /revue. C'est LA notification hebdomadaire :
// tâches de la semaine, puis les quatre lignes santé du Bilan (kcal moyens
// contre la limite, séances, poids lissé, tour de taille), calculées par
// ../_shared/bilan.ts, le même module que l'écran du Bilan.
//
// Le jour est réservé avant l'envoi, puis rendu si une lecture échoue ou si
// aucun appareil n'a reçu le rappel : sans cela, une panne passagère faisait
// perdre la revue pour toute la semaine.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decalerDate,
  evolutionPoids,
  evolutionTaille,
  kcalParJour,
  lignesSanteHebdo,
  semaineDe,
  syntheseKcal,
  type EntreeKcal,
  type JourKcal,
  type Mesure,
  type SyntheseHebdo,
} from "../_shared/bilan.ts";
import { decalerJour, parisMaintenant } from "../_shared/paris.ts";
import {
  aRefaire,
  envoyerATous,
  ERREUR_VAPID,
  erreurServeur,
  json,
  libererJour,
  lireAbonnements,
  reserverJour,
  vapidConfigure,
} from "../_shared/push.ts";
import { composerRappelRevue, revueDue } from "./compose.ts";

const ETIQUETTE = "envoyer-revue-hebdo";
const COLONNE = "revue_dernier_envoi";
const NB_JOURS_MESURES = 60;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const formatParis = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" });

/**
 * Santé de la semaine (mêmes requêtes que l'écran du Bilan). `null` si une
 * lecture échoue : la revue part alors sans les lignes santé plutôt que de ne
 * pas partir du tout.
 */
async function syntheseSante(today: string): Promise<SyntheseHebdo | null> {
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
  if (erreur) {
    console.error(`[${ETIQUETTE}] lecture santé impossible : ${erreur.message}`);
    return null;
  }

  // Séances de la semaine : un type (Push / Pull / Legs) est fait dès qu'un entraînement
  // lui est rattaché, par son type enregistré ou, à défaut, par sa routine.
  const idsRoutines = [...new Set((seances.data ?? []).map((e) => e.routine_id).filter((id): id is string => id !== null))];
  const { data: typesRoutines, error: erreurRoutines } = idsRoutines.length
    ? await supabase.from("routines").select("id, type_seance").in("id", idsRoutines)
    : { data: [], error: null };
  if (erreurRoutines) {
    console.error(`[${ETIQUETTE}] lecture des routines impossible : ${erreurRoutines.message}`);
    return null;
  }
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
  return {
    kcal: syntheseKcal(jours),
    seances: { faites: typesFaits.size, total: 3 },
    poids: evolutionPoids(releves, today),
    taille: evolutionTaille(releves, today),
  };
}

const lignesSante = (sante: SyntheseHebdo | null) => (sante ? lignesSanteHebdo(sante) : undefined);

Deno.serve(async () => {
  const { data: reglages, error: reglagesError } = await supabase
    .from("reglages_briefing")
    .select("revue_actif, revue_jour, revue_heure, revue_dernier_envoi")
    .eq("id", 1)
    .single();
  if (reglagesError) return erreurServeur(ETIQUETTE, reglagesError.message);
  if (!reglages.revue_actif) return json({ sent: 0, raison: "desactive" });

  const { today, minutes } = parisMaintenant(Date.now());
  if (
    !revueDue({
      today,
      maintenantMinutes: minutes,
      jour: reglages.revue_jour,
      heure: reglages.revue_heure,
      dernierEnvoi: reglages.revue_dernier_envoi,
    })
  ) {
    return json({ sent: 0, raison: "pas-l-heure" });
  }
  if (!vapidConfigure) return erreurServeur(ETIQUETTE, ERREUR_VAPID);

  const reservation = await reserverJour(supabase, COLONNE, today);
  if (reservation.erreur) return erreurServeur(ETIQUETTE, reservation.erreur);
  if (!reservation.reserve) return json({ sent: 0, raison: "deja-envoye" });

  const echec = async (message: string) => {
    await libererJour(supabase, COLONNE, today, reglages.revue_dernier_envoi, ETIQUETTE);
    return erreurServeur(ETIQUETTE, message);
  };

  // termine_le est un instant : fenêtre large (8 jours) pour couvrir « 7 jours à Paris ».
  const depuis = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const [terminees, enRetard, prevues] = await Promise.all([
    supabase.from("taches").select("termine_le").eq("fait", true).gte("termine_le", depuis),
    supabase
      .from("taches")
      .select("id", { count: "exact", head: true })
      .eq("fait", false)
      .not("echeance", "is", null)
      .lt("echeance", today),
    supabase
      .from("taches")
      .select("id", { count: "exact", head: true })
      .eq("fait", false)
      .gt("echeance", today)
      .lte("echeance", decalerJour(today, 7)),
  ]);
  const erreurLecture = terminees.error ?? enRetard.error ?? prevues.error;
  if (erreurLecture) return echec(erreurLecture.message);

  // Jour calendaire de Paris de chaque terminaison, comparé à la fenêtre J-6 … J.
  const debutSemaine = decalerJour(today, -6);
  const nbTerminees = (terminees.data ?? []).filter((t) => {
    const jour = formatParis.format(new Date(t.termine_le as string));
    return jour >= debutSemaine && jour <= today;
  }).length;

  const message = composerRappelRevue({
    terminees: nbTerminees,
    enRetard: enRetard.count ?? 0,
    prevues: prevues.count ?? 0,
    lignesSante: lignesSante(await syntheseSante(today)),
  });

  const { abonnements, erreur } = await lireAbonnements(supabase);
  if (erreur !== null) return echec(erreur);

  const payload = JSON.stringify({ title: message.title, body: message.body, url: "/revue" });
  const bilan = await envoyerATous(supabase, abonnements, payload, ETIQUETTE);
  if (aRefaire(bilan)) await libererJour(supabase, COLONNE, today, reglages.revue_dernier_envoi, ETIQUETTE);

  return json(bilan);
});
