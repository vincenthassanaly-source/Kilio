// Accès base du module Musculation, partagé par les Server Actions
// (src/app/actions/musculation.ts). Module neutre (ni "use server" ni "use
// client") : il reçoit le client admin en paramètre, ce qui le rend testable
// avec le faux Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { aujourdhuiParis } from "@/lib/date/paris";
import { marquerFaite } from "@/lib/seances/serveur";
import { estTypeSeance } from "@/lib/seances/compute";
import { estModeSaisie, estMuscle, estTypeSerie, type ModeSaisie, type Muscle } from "./constantes";
import type {
  DossierRoutines,
  RoutineDetail,
  RoutineEntree,
  RoutineExerciceDetail,
  RoutineResume,
  RoutineSerie,
} from "./routines";
import { modeOuDefaut } from "./routines";
import { resumerEntrainement, type EntrainementDetail, type EntrainementResume } from "./historique";
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

// --- Routines -------------------------------------------------------------

export type RoutinesEtDossiers = { dossiers: DossierRoutines[]; routines: RoutineResume[] };

const typeOuNull = (valeur: string | null) => (valeur && estTypeSeance(valeur) ? valeur : null);

/** Dossiers et routines (avec leur nombre d'exercices). Vide si les tables sont absentes. */
export async function listerRoutines(supabase: Client): Promise<RoutinesEtDossiers> {
  const [dossiers, routines, exercices] = await Promise.all([
    supabase.from("routine_dossiers").select("id, nom").order("ordre").order("nom"),
    supabase.from("routines").select("id, nom, type_seance, dossier_id").order("ordre").order("nom"),
    supabase.from("routine_exercices").select("routine_id"),
  ]);
  const erreur = dossiers.error ?? routines.error ?? exercices.error;
  if (erreur) throw new Error(erreur.message);

  const nombre = new Map<string, number>();
  for (const l of exercices.data ?? []) nombre.set(l.routine_id, (nombre.get(l.routine_id) ?? 0) + 1);

  return {
    dossiers: (dossiers.data ?? []).map((d) => ({ id: d.id, nom: d.nom })),
    routines: (routines.data ?? []).map((r) => ({
      id: r.id,
      nom: r.nom,
      typeSeance: typeOuNull(r.type_seance),
      dossierId: r.dossier_id,
      nbExercices: nombre.get(r.id) ?? 0,
    })),
  };
}

/** Routine complète (exercices du catalogue et séries cibles), ou `null` si introuvable. */
export async function lireRoutine(supabase: Client, id: string): Promise<RoutineDetail | null> {
  const { data: routine, error } = await supabase
    .from("routines")
    .select("id, nom, type_seance, dossier_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!routine) return null;

  const { data: lignes, error: erreurLignes } = await supabase
    .from("routine_exercices")
    .select("id, exercice_id, ordre, repos_s")
    .eq("routine_id", id)
    .order("ordre");
  if (erreurLignes) throw new Error(erreurLignes.message);

  const ids = (lignes ?? []).map((l) => l.id);
  const idsExercices = [...new Set((lignes ?? []).map((l) => l.exercice_id))];
  const [catalogue, series] = await Promise.all([
    idsExercices.length > 0
      ? supabase.from("exercices").select("id, nom, mode_saisie, repos_defaut_s").in("id", idsExercices)
      : Promise.resolve({ data: [], error: null }),
    ids.length > 0
      ? supabase
          .from("routine_series")
          .select("routine_exercice_id, ordre, type_serie, poids_kg, reps, duree_s, distance_m")
          .in("routine_exercice_id", ids)
          .order("ordre")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const erreurDetail = catalogue.error ?? series.error;
  if (erreurDetail) throw new Error(erreurDetail.message);

  const exo = new Map((catalogue.data ?? []).map((e) => [e.id, e]));
  const seriesParLigne = new Map<string, RoutineSerie[]>();
  for (const s of series.data ?? []) {
    const liste = seriesParLigne.get(s.routine_exercice_id) ?? [];
    liste.push({
      type: estTypeSerie(s.type_serie) ? s.type_serie : "normale",
      poids: s.poids_kg,
      reps: s.reps,
      duree: s.duree_s,
      distance: s.distance_m,
    });
    seriesParLigne.set(s.routine_exercice_id, liste);
  }

  const exercices: RoutineExerciceDetail[] = [];
  for (const l of lignes ?? []) {
    const e = exo.get(l.exercice_id);
    if (!e) continue;
    exercices.push({
      exerciceId: l.exercice_id,
      nom: e.nom,
      mode: modeOuDefaut(e.mode_saisie),
      reposS: l.repos_s,
      reposExerciceS: e.repos_defaut_s,
      series: seriesParLigne.get(l.id) ?? [],
    });
  }

  return {
    id: routine.id,
    nom: routine.nom,
    typeSeance: typeOuNull(routine.type_seance),
    dossierId: routine.dossier_id,
    exercices,
  };
}

export type ResultatRoutine = { error: string | null; id?: string };

/**
 * Crée ou met à jour une routine. La mise à jour remplace tous les exercices
 * et séries (l'ordre fait foi) : l'éditeur envoie toujours la routine entière.
 */
export async function enregistrerRoutine(supabase: Client, entree: RoutineEntree): Promise<ResultatRoutine> {
  const echec = { error: "La routine n'a pas pu être enregistrée. Réessaie." };

  // Un dossier supprimé entre-temps ne doit pas faire échouer l'enregistrement.
  let dossierId = entree.dossierId;
  if (dossierId) {
    const { data } = await supabase.from("routine_dossiers").select("id").eq("id", dossierId).maybeSingle();
    if (!data) dossierId = null;
  }

  const champs = { nom: entree.nom.trim(), type_seance: entree.typeSeance, dossier_id: dossierId };
  let id = entree.id;
  if (id) {
    const { data, error } = await supabase.from("routines").update(champs).eq("id", id).select("id");
    if (error) return echec;
    if (!data || data.length === 0) return { error: "Cette routine n'existe plus." };
  } else {
    const { data, error } = await supabase.from("routines").insert(champs).select("id").single();
    if (error || !data) return echec;
    id = data.id;
  }

  const { error: erreurSuppression } = await supabase.from("routine_exercices").delete().eq("routine_id", id);
  if (erreurSuppression) return echec;

  const lignes = entree.exercices.map((e, ordre) => ({
    id: crypto.randomUUID(),
    routine_id: id,
    exercice_id: e.exerciceId,
    ordre,
    repos_s: e.reposS,
  }));
  const { error: erreurExercices } = await supabase.from("routine_exercices").insert(lignes);
  if (erreurExercices) return { error: "Un exercice de la routine n'existe plus dans le catalogue." };

  const { error: erreurSeries } = await supabase.from("routine_series").insert(
    entree.exercices.flatMap((e, i) =>
      e.series.map((s, ordre) => ({
        routine_exercice_id: lignes[i].id,
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

  return { error: null, id };
}

export async function supprimerRoutine(supabase: Client, id: string): Promise<ResultatRoutine> {
  const { error } = await supabase.from("routines").delete().eq("id", id);
  return { error: error ? "La routine n'a pas pu être supprimée. Réessaie." : null };
}

export async function creerDossier(supabase: Client, nom: string): Promise<ResultatRoutine> {
  const { data, error } = await supabase.from("routine_dossiers").insert({ nom: nom.trim() }).select("id").single();
  if (error || !data) return { error: "Le dossier n'a pas pu être créé. Réessaie." };
  return { error: null, id: data.id };
}

export async function renommerDossier(supabase: Client, id: string, nom: string): Promise<ResultatRoutine> {
  const { error } = await supabase.from("routine_dossiers").update({ nom: nom.trim() }).eq("id", id);
  return { error: error ? "Le dossier n'a pas pu être renommé. Réessaie." : null };
}

/** Supprime le dossier ; ses routines ne sont pas supprimées, elles passent « sans dossier ». */
export async function supprimerDossier(supabase: Client, id: string): Promise<ResultatRoutine> {
  const { error } = await supabase.from("routine_dossiers").delete().eq("id", id);
  return { error: error ? "Le dossier n'a pas pu être supprimé. Réessaie." : null };
}

// --- Historique -----------------------------------------------------------

type LigneSerie = {
  entrainement_exercice_id: string;
  ordre: number;
  type_serie: string;
  poids_kg: number | null;
  reps: number | null;
  duree_s: number | null;
  distance_m: number | null;
};

function enSerie(l: LigneSerie): RoutineSerie {
  return {
    type: estTypeSerie(l.type_serie) ? l.type_serie : "normale",
    poids: l.poids_kg,
    reps: l.reps,
    duree: l.duree_s,
    distance: l.distance_m,
  };
}

/** Séries d'une liste de lignes `entrainement_exercices`, groupées par ligne et dans l'ordre. */
async function lireSeriesParLigne(supabase: Client, ids: string[]): Promise<Map<string, RoutineSerie[]>> {
  const parLigne = new Map<string, RoutineSerie[]>();
  if (ids.length === 0) return parLigne;
  const { data, error } = await supabase
    .from("entrainement_series")
    .select("entrainement_exercice_id, ordre, type_serie, poids_kg, reps, duree_s, distance_m")
    .in("entrainement_exercice_id", ids)
    .order("ordre");
  if (error) throw new Error(error.message);
  for (const l of data ?? []) {
    const liste = parLigne.get(l.entrainement_exercice_id) ?? [];
    liste.push(enSerie(l));
    parLigne.set(l.entrainement_exercice_id, liste);
  }
  return parLigne;
}

/** Séances terminées, de la plus récente à la plus ancienne, avec leur synthèse. */
export async function listerEntrainements(supabase: Client, limite: number): Promise<EntrainementResume[]> {
  const { data: entrainements, error } = await supabase
    .from("entrainements")
    .select("id, titre, date, duree_s, debut_at")
    .order("date", { ascending: false })
    .order("debut_at", { ascending: false })
    .limit(Math.min(Math.max(1, limite), 200));
  if (error) throw new Error(error.message);
  if (!entrainements || entrainements.length === 0) return [];

  const { data: lignes, error: erreurLignes } = await supabase
    .from("entrainement_exercices")
    .select("id, entrainement_id")
    .in("entrainement_id", entrainements.map((e) => e.id));
  if (erreurLignes) throw new Error(erreurLignes.message);

  const series = await lireSeriesParLigne(supabase, (lignes ?? []).map((l) => l.id));
  const parEntrainement = new Map<string, { series: RoutineSerie[] }[]>();
  for (const l of lignes ?? []) {
    const liste = parEntrainement.get(l.entrainement_id) ?? [];
    liste.push({ series: series.get(l.id) ?? [] });
    parEntrainement.set(l.entrainement_id, liste);
  }

  return entrainements.map((e) =>
    resumerEntrainement(
      { id: e.id, titre: e.titre, date: e.date, dureeS: e.duree_s },
      parEntrainement.get(e.id) ?? [],
    ),
  );
}

/** Séance complète pour l'affichage, l'édition ou la création d'une routine, ou `null`. */
export async function lireEntrainement(supabase: Client, id: string): Promise<EntrainementDetail | null> {
  const { data: e, error } = await supabase
    .from("entrainements")
    .select("id, titre, date, debut_at, fin_at, duree_s, seance_id, routine_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!e) return null;

  const { data: lignes, error: erreurLignes } = await supabase
    .from("entrainement_exercices")
    .select("id, exercice_id, ordre, repos_s")
    .eq("entrainement_id", id)
    .order("ordre");
  if (erreurLignes) throw new Error(erreurLignes.message);

  const idsExercices = [...new Set((lignes ?? []).map((l) => l.exercice_id))];
  const [catalogue, series, seance] = await Promise.all([
    idsExercices.length > 0
      ? supabase.from("exercices").select("id, nom, mode_saisie").in("id", idsExercices)
      : Promise.resolve({ data: [], error: null }),
    lireSeriesParLigne(supabase, (lignes ?? []).map((l) => l.id)),
    e.seance_id ? supabase.from("seances").select("type").eq("id", e.seance_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (catalogue.error) throw new Error(catalogue.error.message);

  const exo = new Map((catalogue.data ?? []).map((x) => [x.id, x]));
  const exercices: EntrainementDetail["exercices"] = [];
  for (const l of lignes ?? []) {
    const x = exo.get(l.exercice_id);
    if (!x) continue;
    exercices.push({
      cle: l.id,
      exerciceId: l.exercice_id,
      nom: x.nom,
      mode: modeOuDefaut(x.mode_saisie),
      reposS: l.repos_s,
      series: series.get(l.id) ?? [],
    });
  }

  return {
    id: e.id,
    titre: e.titre,
    date: e.date,
    debutA: e.debut_at,
    finA: e.fin_at,
    dureeS: e.duree_s,
    seanceId: e.seance_id,
    routineId: e.routine_id,
    typeSeance: typeOuNull(seance.data?.type ?? null),
    exercices,
  };
}

/** Supprime la séance (exercices et séries en cascade). La séance planifiée liée n'est pas décochée. */
export async function supprimerEntrainement(supabase: Client, id: string): Promise<ResultatRoutine> {
  const { error } = await supabase.from("entrainements").delete().eq("id", id);
  return { error: error ? "La séance n'a pas pu être supprimée. Réessaie." : null };
}
