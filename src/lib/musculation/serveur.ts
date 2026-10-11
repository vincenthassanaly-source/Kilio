// Accès base du module Musculation, partagé par les Server Actions
// (src/app/actions/musculation.ts). Module neutre (ni "use server" ni "use
// client") : il reçoit le client admin en paramètre, ce qui le rend testable
// avec le faux Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { aujourdhuiParis } from "@/lib/date/paris";
import { marquerFaite } from "@/lib/seances/serveur";
import { estModeSaisie, estMuscle, type ModeSaisie, type Muscle } from "./constantes";
import type { EntrainementPayload, SeriePrecedente } from "./seance";

type Client = SupabaseClient<Database>;

export type ExerciceCatalogue = {
  id: string;
  nom: string;
  mode: ModeSaisie;
  muscle: Muscle;
  materiel: string | null;
  reposDefautS: number | null;
};

/**
 * Nombre d'exercices du catalogue. Retourne 0 si la table est absente ou
 * inaccessible (migration pas encore appliquée) : l'écran reste alors sur son
 * état vide plutôt que de planter.
 */
export async function compterExercices(supabase: Client): Promise<number> {
  const { count, error } = await supabase.from("exercices").select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

/** Catalogue complet, trié par nom (il reste de taille raisonnable : quelques centaines de lignes). */
export async function listerExercices(supabase: Client): Promise<ExerciceCatalogue[]> {
  const { data, error } = await supabase
    .from("exercices")
    .select("id, nom, mode_saisie, muscle_principal, materiel, repos_defaut_s")
    .order("nom")
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => ({
    id: l.id,
    nom: l.nom,
    mode: estModeSaisie(l.mode_saisie) ? l.mode_saisie : "poids_reps",
    muscle: estMuscle(l.muscle_principal) ? l.muscle_principal : "corps_entier",
    materiel: l.materiel,
    reposDefautS: l.repos_defaut_s,
  }));
}

const FENETRE_HISTORIQUE_PAR_EXERCICE = 30;

/**
 * Séries de travail de la dernière séance où figurait chaque exercice, dans
 * l'ordre : repère « Précédent » et préremplissage au démarrage d'un exercice.
 */
export async function dernieresSeries(supabase: Client, exerciceIds: string[]): Promise<Record<string, SeriePrecedente[]>> {
  const ids = [...new Set(exerciceIds)].slice(0, 60);
  if (ids.length === 0) return {};

  const { data: occurrences, error } = await supabase
    .from("entrainement_exercices")
    .select("id, exercice_id, entrainement_id")
    .in("exercice_id", ids)
    .order("created_at", { ascending: false })
    .limit(ids.length * FENETRE_HISTORIQUE_PAR_EXERCICE);
  if (error) throw new Error(error.message);
  if (!occurrences || occurrences.length === 0) return {};

  const { data: entrainements, error: erreurEntrainements } = await supabase
    .from("entrainements")
    .select("id, debut_at")
    .in("id", [...new Set(occurrences.map((o) => o.entrainement_id))]);
  if (erreurEntrainements) throw new Error(erreurEntrainements.message);
  const debut = new Map((entrainements ?? []).map((e) => [e.id, Date.parse(e.debut_at)]));

  // Pour chaque exercice, l'occurrence dont l'entraînement est le plus récent.
  const recente = new Map<string, { id: string; debut: number }>();
  for (const o of occurrences) {
    const instant = debut.get(o.entrainement_id);
    if (instant === undefined) continue;
    const courante = recente.get(o.exercice_id);
    if (!courante || instant > courante.debut) recente.set(o.exercice_id, { id: o.id, debut: instant });
  }
  if (recente.size === 0) return {};

  const { data: series, error: erreurSeries } = await supabase
    .from("entrainement_series")
    .select("entrainement_exercice_id, ordre, type_serie, poids_kg, reps, duree_s, distance_m")
    .in("entrainement_exercice_id", [...recente.values()].map((r) => r.id))
    .order("ordre");
  if (erreurSeries) throw new Error(erreurSeries.message);

  const parOccurrence = new Map<string, SeriePrecedente[]>();
  for (const s of series ?? []) {
    if (s.type_serie === "echauffement") continue;
    const liste = parOccurrence.get(s.entrainement_exercice_id) ?? [];
    liste.push({ poids: s.poids_kg, reps: s.reps, duree: s.duree_s, distance: s.distance_m });
    parOccurrence.set(s.entrainement_exercice_id, liste);
  }

  const resultat: Record<string, SeriePrecedente[]> = {};
  for (const [exerciceId, { id }] of recente) {
    const liste = parOccurrence.get(id);
    if (liste && liste.length > 0) resultat[exerciceId] = liste;
  }
  return resultat;
}

export type ResultatEnregistrement = { error: string | null };

/**
 * Enregistre une séance terminée. Idempotent : les identifiants viennent du
 * client, donc renvoyer la même séance (reconnexion après un envoi dont la
 * réponse s'est perdue) la remplace sans créer de doublon.
 * Le jour devient un jour d'entraînement (cible kcal du Journal) ; si la
 * séance réalise une séance planifiée, celle-ci est cochée « faite ».
 */
export async function enregistrerEntrainement(supabase: Client, payload: EntrainementPayload): Promise<ResultatEnregistrement> {
  const echec = { error: "La séance n'a pas pu être enregistrée. Réessaie." };
  const jour = aujourdhuiParis(new Date(payload.debutA));
  const dureeS = Math.max(0, Math.round((Date.parse(payload.finA) - Date.parse(payload.debutA)) / 1000));

  // Une routine ou une séance planifiée supprimée entre-temps ne doit pas faire échouer l'envoi.
  let routineId = payload.routineId;
  if (routineId) {
    const { data } = await supabase.from("routines").select("id").eq("id", routineId).maybeSingle();
    if (!data) routineId = null;
  }
  let seanceId = payload.seanceId;
  if (seanceId) {
    const { data } = await supabase.from("seances").select("id").eq("id", seanceId).maybeSingle();
    if (!data) seanceId = null;
  }

  const { error: erreurEntrainement } = await supabase.from("entrainements").upsert({
    id: payload.id,
    seance_id: seanceId,
    routine_id: routineId,
    titre: payload.nom.trim(),
    date: jour,
    debut_at: payload.debutA,
    fin_at: payload.finA,
    duree_s: dureeS,
  });
  if (erreurEntrainement) return echec;

  // Remplacement complet des exercices (les séries partent en cascade).
  const { error: erreurSuppression } = await supabase
    .from("entrainement_exercices")
    .delete()
    .eq("entrainement_id", payload.id);
  if (erreurSuppression) return echec;

  const { error: erreurExercices } = await supabase.from("entrainement_exercices").insert(
    payload.exercices.map((e, ordre) => ({
      id: e.cle,
      entrainement_id: payload.id,
      exercice_id: e.exerciceId,
      ordre,
      repos_s: e.reposS,
    })),
  );
  if (erreurExercices) return { error: "Un exercice de la séance n'existe plus dans le catalogue." };

  const { error: erreurSeries } = await supabase.from("entrainement_series").insert(
    payload.exercices.flatMap((e) =>
      e.series.map((s, ordre) => ({
        id: s.id,
        entrainement_exercice_id: e.cle,
        ordre,
        type_serie: s.type,
        poids_kg: s.poids === null ? null : Math.round(s.poids * 100) / 100,
        reps: s.reps,
        duree_s: s.duree,
        distance_m: s.distance,
      })),
    ),
  );
  if (erreurSeries) return echec;

  // Best effort : la séance est déjà enregistrée, un échec ici ne doit pas la faire rejouer.
  if (seanceId) {
    const resultat = await marquerFaite(supabase, seanceId, true);
    if (resultat.error) console.error("enregistrerEntrainement: séance planifiée non cochée", resultat.error);
  } else {
    const { error } = await supabase
      .from("jours_entrainement")
      .upsert({ date: jour, entraine: true, updated_at: new Date().toISOString() }, { onConflict: "date" });
    if (error) console.error("enregistrerEntrainement: jour d'entraînement non marqué", error);
  }

  return { error: null };
}
