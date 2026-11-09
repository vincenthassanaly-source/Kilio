"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getEvenements } from "@/app/actions/evenements";
import { getSyntheseSemaine } from "@/app/actions/sante";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { parseISODate, shiftDate } from "@/lib/date/iso";
import { aujourdhuiParis } from "@/lib/date/paris";
import { appelerGemini } from "@/lib/gemini/appel";
import { messageEchec } from "@/lib/gemini/analyse";
import { creerCacheCourt, empreinte } from "@/lib/gemini/cache-court";
import { calculerTauxReussite } from "@/lib/habitudes/compute";
import {
  SCHEMA_ANALYSE,
  analyseVide,
  construirePromptAnalyse,
  lireAnalyse,
  type AnalyseSemaine,
  type DonneesAnalyse,
} from "@/lib/revue/analyse";
import {
  REPLANIF_HORIZON_JOURS,
  REPLANIF_TACHES_MAX,
  SCHEMA_REPLANIFICATION,
  SCHEMA_SYNTHESE_REVUE,
  construirePromptAvenir,
  construirePromptBilan,
  construirePromptReplanification,
  estDateReplanifiable,
  lireReplanification,
  lireSynthese,
  type EvenementPourIA,
  type JourPourIA,
  type PropositionReplanification,
  type SyntheseRevue,
  type TachePourIA,
  type TypeSynthese,
} from "@/lib/revue/assistant";
import { bilanSemaine, dateParisDe, semaineProchaine, type JourSemaine } from "@/lib/revue/compute";
import { createAdminClient } from "@/lib/supabase/admin";
import { TACHES_TAG } from "@/lib/taches/tags";
import { estUuid } from "@/lib/uuid";

// Assistant IA de la Revue : bilan de la semaine écoulée, résumé de la semaine
// à venir et replanification des tâches en retard. Les deux premiers ne font que
// lire ; la replanification est en deux temps : `proposerReplanification` ne
// touche à rien, `appliquerReplanification` écrit après le clic sur « Appliquer ».
// Les propositions sont gardées quelques minutes (mêmes données → même
// réponse) pour qu'un second clic ne rappelle pas Gemini ; « Régénérer » passe outre.

const GEMINI_TIMEOUT_MS = 30_000;
const CACHE_DUREE_MS = 10 * 60_000;
const CACHE_TAILLE_MAX = 50;
const COLONNES_TACHE = "id, titre, echeance, fait, termine_le, duree_minutes, priorite, heure";
const NB_TERMINEES_PROMPT = 15;
const NB_RETARD_PROMPT = 10;
const NB_EVENEMENTS_PROMPT = 15;
const JOURS_AVENIR = 7;
const NB_HABITUDES_PROMPT = 12;
const NB_NOTES_MAX = 30;
const NB_NOTES_PROMPT = 8;

const cacheSyntheses = creerCacheCourt<SyntheseRevue>(CACHE_DUREE_MS, CACHE_TAILLE_MAX);
const cacheReplanifications = creerCacheCourt<PropositionReplanification[]>(CACHE_DUREE_MS, CACHE_TAILLE_MAX);
const cacheAnalyses = creerCacheCourt<AnalyseSemaine>(CACHE_DUREE_MS, CACHE_TAILLE_MAX);

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function lireEvenements(debut: string, fin: string): Promise<EvenementPourIA[]> {
  const evenements = await getEvenements(debut, fin);
  return evenements.map((e) => ({
    titre: e.titre,
    date: e.date,
    heure: e.heure,
    heure_fin: e.heure_fin,
    toute_la_journee: e.toute_la_journee,
  }));
}

async function lireTaches(
  requete: PromiseLike<{ data: TachePourIA[] | null; error: { message: string } | null }>
): Promise<TachePourIA[]> {
  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Jours à venir enrichis des horaires de travail. Un planning illisible n'empêche pas l'analyse. */
async function ajouterTravail(
  supabase: SupabaseAdmin,
  jours: JourSemaine<TachePourIA, EvenementPourIA>[]
): Promise<JourPourIA[]> {
  const [creneaux, exceptions] = await Promise.all([
    supabase.from("horaires_travail_creneaux").select("*"),
    supabase.from("horaires_travail_exceptions").select("*"),
  ]);
  if (creneaux.error || exceptions.error) {
    console.error("revue-assistant: planning de travail illisible", creneaux.error ?? exceptions.error);
  }
  return jours.map((jour) => ({
    ...jour,
    travail: getCreneauxDuJour(creneaux.data ?? [], parseISODate(jour.date), exceptions.data ?? []).map(
      (c) => `${c.heure_debut.slice(0, 5)}-${c.heure_fin.slice(0, 5)}`
    ),
  }));
}

function revalider() {
  revalidateTag(TACHES_TAG, { expire: 0 });
  for (const chemin of ["/taches", "/agenda", "/aujourdhui", "/revue", "/"]) revalidatePath(chemin);
}

export async function synthetiserRevue(
  type: TypeSynthese,
  regenerer = false
): Promise<ActionResult<SyntheseRevue>> {
  if (type !== "bilan" && type !== "avenir") return fail("Action inconnue.");
  const today = aujourdhuiParis();
  const supabase = createAdminClient();

  let prompt: string;
  try {
    if (type === "avenir") {
      const fin = shiftDate(today, JOURS_AVENIR);
      const [taches, evenements] = await Promise.all([
        lireTaches(
          supabase
            .from("taches")
            .select(COLONNES_TACHE)
            .eq("fait", false)
            .not("echeance", "is", null)
            .lte("echeance", fin)
        ),
        lireEvenements(shiftDate(today, 1), fin),
      ]);
      const nbEnRetard = taches.filter((t) => t.echeance !== null && t.echeance < today).length;
      const jours = await ajouterTravail(supabase, semaineProchaine(taches, evenements, today, JOURS_AVENIR));
      const rien = nbEnRetard === 0 && jours.every((j) => j.taches.length === 0 && j.evenements.length === 0);
      if (rien) {
        return ok({
          resume: "Aucun rendez-vous ni tâche datée ces 7 prochains jours : la semaine est libre.",
          points: [],
        });
      }
      prompt = construirePromptAvenir(today, jours, nbEnRetard);
    } else {
      const debut = shiftDate(today, -6);
      const [terminees, enRetard, evenements] = await Promise.all([
        lireTaches(
          supabase
            .from("taches")
            .select(COLONNES_TACHE)
            .eq("fait", true)
            .gte("termine_le", `${shiftDate(debut, -1)}T00:00:00Z`)
        ),
        lireTaches(
          supabase
            .from("taches")
            .select(COLONNES_TACHE)
            .eq("fait", false)
            .not("echeance", "is", null)
            .lt("echeance", today)
            .order("echeance", { ascending: true })
        ),
        lireEvenements(debut, today),
      ]);
      const bilan = bilanSemaine(terminees, today);
      if (bilan.terminees.length === 0 && enRetard.length === 0 && evenements.length === 0) {
        return ok({
          resume: "Rien à signaler cette semaine : aucune tâche terminée, aucun retard et aucun rendez-vous.",
          points: [],
        });
      }
      prompt = construirePromptBilan({
        today,
        terminees: bilan.terminees
          .slice(0, NB_TERMINEES_PROMPT)
          .map((t) => ({ titre: t.titre, jour: dateParisDe(t.termine_le!) })),
        nbTermineesTotal: bilan.terminees.length,
        enRetard: enRetard.slice(0, NB_RETARD_PROMPT).map((t) => ({ titre: t.titre, echeance: t.echeance! })),
        nbEnRetardTotal: enRetard.length,
        evenements: evenements.slice(0, NB_EVENEMENTS_PROMPT).map((e) => ({ titre: e.titre, date: e.date })),
        nbEvenementsTotal: evenements.length,
      });
    }
  } catch (err) {
    console.error("synthetiserRevue", err);
    return fail("Les données de la semaine n'ont pas pu être lues. Réessaie.");
  }

  const cle = empreinte(type, today, prompt);
  if (!regenerer) {
    const enCache = cacheSyntheses.lire(cle);
    if (enCache) return ok(enCache);
  }

  const resultat = await appelerGemini({
    prompt,
    schema: SCHEMA_SYNTHESE_REVUE,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.4,
    etiquette: `revue-${type}`,
  });
  if (!resultat.ok) return fail(messageEchec(resultat));

  const synthese = lireSynthese(resultat.brut);
  if (!synthese) return fail("Réponse de Gemini inutilisable. Réessaie.");

  cacheSyntheses.ecrire(cle, synthese);
  return ok(synthese);
}

export async function proposerReplanification(
  regenerer = false
): Promise<ActionResult<{ propositions: PropositionReplanification[] }>> {
  const today = aujourdhuiParis();
  const supabase = createAdminClient();
  const fin = shiftDate(today, REPLANIF_HORIZON_JOURS);

  let aReplanifier: TachePourIA[];
  let prompt: string;
  try {
    const [enRetard, prevues, evenements] = await Promise.all([
      lireTaches(
        supabase
          .from("taches")
          .select(COLONNES_TACHE)
          .eq("fait", false)
          .not("echeance", "is", null)
          .lt("echeance", today)
          .order("echeance", { ascending: true })
          .limit(REPLANIF_TACHES_MAX)
      ),
      lireTaches(
        supabase
          .from("taches")
          .select(COLONNES_TACHE)
          .eq("fait", false)
          .gte("echeance", today)
          .lte("echeance", fin)
      ),
      lireEvenements(today, fin),
    ]);
    if (enRetard.length === 0) return fail("Aucune tâche en retard à replanifier.");
    aReplanifier = enRetard;
    // Du jour même jusqu'à la fin de l'horizon : `semaineProchaine` démarre au lendemain de son 3e argument.
    const jours = await ajouterTravail(
      supabase,
      semaineProchaine(prevues, evenements, shiftDate(today, -1), REPLANIF_HORIZON_JOURS + 1)
    );
    prompt = construirePromptReplanification(today, aReplanifier, jours);
  } catch (err) {
    console.error("proposerReplanification", err);
    return fail("Les tâches et l'agenda n'ont pas pu être lus. Réessaie.");
  }

  const cle = empreinte("replanifier", today, prompt);
  if (!regenerer) {
    const enCache = cacheReplanifications.lire(cle);
    if (enCache) return ok({ propositions: enCache });
  }

  const resultat = await appelerGemini({
    prompt,
    schema: SCHEMA_REPLANIFICATION,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.2,
    etiquette: "revue-replanifier",
  });
  if (!resultat.ok) return fail(messageEchec(resultat));

  const propositions = lireReplanification(resultat.brut, aReplanifier, today);
  if (!propositions) {
    return fail("Gemini n'a trouvé aucune meilleure date pour ces tâches. Réessaie ou replanifie à la main.");
  }

  cacheReplanifications.ecrire(cle, propositions);
  return ok({ propositions });
}

// --- Analyse croisée de la semaine -------------------------------------------
// Tâches, agenda, habitudes, santé et notes. Chaque module est lu à part : s'il
// est illisible, il est laissé de côté plutôt que de faire échouer toute l'analyse.

async function section<T>(nom: string, lire: () => Promise<T>): Promise<T | null> {
  try {
    return await lire();
  } catch (err) {
    console.error(`analyserSemaine: ${nom} illisible`, err);
    return null;
  }
}

async function donneesTaches(supabase: SupabaseAdmin, today: string): Promise<DonneesAnalyse["taches"]> {
  const debut = shiftDate(today, -6);
  const fin = shiftDate(today, JOURS_AVENIR);
  const [terminees, ouvertes] = await Promise.all([
    lireTaches(
      supabase
        .from("taches")
        .select(COLONNES_TACHE)
        .eq("fait", true)
        .gte("termine_le", `${shiftDate(debut, -1)}T00:00:00Z`)
    ),
    lireTaches(
      supabase.from("taches").select(COLONNES_TACHE).eq("fait", false).not("echeance", "is", null).lte("echeance", fin)
    ),
  ]);
  const bilan = bilanSemaine(terminees, today);
  return {
    terminees: bilan.terminees.slice(0, NB_TERMINEES_PROMPT).map((t) => t.titre),
    nbTerminees: bilan.terminees.length,
    nbEnRetard: ouvertes.filter((t) => t.echeance !== null && t.echeance < today).length,
    nbAvenir: ouvertes.filter((t) => t.echeance !== null && t.echeance > today).length,
  };
}

async function donneesAgenda(today: string): Promise<DonneesAnalyse["evenements"]> {
  const [passes, avenir] = await Promise.all([
    lireEvenements(shiftDate(today, -6), today),
    lireEvenements(shiftDate(today, 1), shiftDate(today, JOURS_AVENIR)),
  ]);
  return { nbPasses: passes.length, nbAvenir: avenir.length };
}

async function donneesHabitudes(supabase: SupabaseAdmin, today: string): Promise<DonneesAnalyse["habitudes"]> {
  const debut = shiftDate(today, -6);
  const [habitudes, entrees] = await Promise.all([
    supabase
      .from("habitudes")
      .select("id, nom, type, valeur_cible, frequence_hebdo, created_at")
      .eq("actif", true)
      .order("ordre", { ascending: true }),
    supabase.from("habitude_entries").select("habitude_id, date, valeur").gte("date", debut).lte("date", today),
  ]);
  if (habitudes.error) throw new Error(habitudes.error.message);
  if (entrees.error) throw new Error(entrees.error.message);

  const parHabitude = new Map<string, Map<string, number>>();
  for (const e of entrees.data ?? []) {
    const jours = parHabitude.get(e.habitude_id) ?? new Map<string, number>();
    jours.set(e.date, e.valeur);
    parHabitude.set(e.habitude_id, jours);
  }

  const resultat: { nom: string; faits: number; attendus: number }[] = [];
  for (const h of (habitudes.data ?? []).slice(0, NB_HABITUDES_PROMPT)) {
    // Une habitude créée en cours de semaine n'est attendue que depuis sa création.
    const creee = h.created_at.slice(0, 10);
    const debutHabitude = creee > debut ? creee : debut;
    if (debutHabitude > today) continue;
    const { faits, attendus } = calculerTauxReussite(h, parHabitude.get(h.id) ?? new Map(), debutHabitude, today);
    resultat.push({ nom: h.nom, faits, attendus });
  }
  return resultat;
}

async function donneesSante(today: string): Promise<DonneesAnalyse["sante"]> {
  const s = await getSyntheseSemaine(today);
  return {
    kcal: s.kcal
      ? {
          moyenne: s.kcal.moyenne,
          cibleMoyenne: s.kcal.cibleMoyenne,
          nbJours: s.kcal.nbJours,
          nbDansLimite: s.kcal.nbDansLimite,
        }
      : null,
    seances: s.seances,
    poids: s.poids ? { actuel: s.poids.actuel, delta: s.poids.delta } : null,
    taille: s.taille ? { actuel: s.taille.actuel, delta: s.taille.delta } : null,
  };
}

async function donneesNotes(supabase: SupabaseAdmin, today: string): Promise<DonneesAnalyse["notes"]> {
  const { data, error } = await supabase
    .from("notes")
    .select("titre, created_at")
    .gte("created_at", `${shiftDate(today, -6)}T00:00:00Z`)
    .order("created_at", { ascending: false })
    .limit(NB_NOTES_MAX);
  if (error) throw new Error(error.message);
  const notes = data ?? [];
  return { nb: notes.length, titres: notes.slice(0, NB_NOTES_PROMPT).map((n) => n.titre) };
}

export async function analyserSemaine(regenerer = false): Promise<ActionResult<AnalyseSemaine>> {
  const today = aujourdhuiParis();
  const supabase = createAdminClient();

  const [taches, evenements, habitudes, sante, notes] = await Promise.all([
    section("tâches", () => donneesTaches(supabase, today)),
    section("agenda", () => donneesAgenda(today)),
    section("habitudes", () => donneesHabitudes(supabase, today)),
    section("santé", () => donneesSante(today)),
    section("notes", () => donneesNotes(supabase, today)),
  ]);
  const donnees: DonneesAnalyse = { today, taches, evenements, habitudes, sante, notes };

  if (!taches && !evenements && !habitudes && !sante && !notes) {
    return fail("Les données de la semaine n'ont pas pu être lues. Réessaie.");
  }
  if (analyseVide(donnees)) {
    return ok({
      resume: "Rien à analyser pour l'instant : pas de tâche, de rendez-vous, d'habitude ni de note sur la semaine.",
      constats: [],
      pistes: [],
    });
  }

  const prompt = construirePromptAnalyse(donnees);
  const cle = empreinte("analyse", today, prompt);
  if (!regenerer) {
    const enCache = cacheAnalyses.lire(cle);
    if (enCache) return ok(enCache);
  }

  const resultat = await appelerGemini({
    prompt,
    schema: SCHEMA_ANALYSE,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.4,
    etiquette: "revue-semaine",
  });
  if (!resultat.ok) return fail(messageEchec(resultat));

  const analyse = lireAnalyse(resultat.brut);
  if (!analyse) return fail("Réponse de Gemini inutilisable. Réessaie.");

  cacheAnalyses.ecrire(cle, analyse);
  return ok(analyse);
}

export async function appliquerReplanification(
  items: { id: string; echeance: string }[]
): Promise<ActionResult<{ nb: number }>> {
  if (!Array.isArray(items) || items.length === 0 || items.length > REPLANIF_TACHES_MAX) {
    return fail("Sélection invalide.");
  }
  const today = aujourdhuiParis();
  const parId = new Map<string, string>();
  for (const item of items) {
    if (typeof item !== "object" || item === null) return fail("Sélection invalide.");
    if (typeof item.id !== "string" || !estUuid(item.id) || parId.has(item.id)) return fail("Sélection invalide.");
    if (!estDateReplanifiable(item.echeance, today)) return fail("Une des dates n'est plus valide. Relance l'assistant.");
    parId.set(item.id, item.echeance);
  }

  const supabase = createAdminClient();
  // Seules les tâches encore à faire sont déplacées : une tâche cochée entre-temps reste telle quelle.
  const { data: actives, error: lectureError } = await supabase
    .from("taches")
    .select("id")
    .in("id", [...parId.keys()])
    .eq("fait", false);
  if (lectureError) return fail("Les tâches n'ont pas pu être lues. Réessaie.");
  const aDeplacer = (actives ?? []).map((t) => t.id);
  if (aDeplacer.length === 0) return fail("Ces tâches ne sont plus à faire.");

  // Un rappel déjà envoyé est remis à zéro : la tâche doit pouvoir rappeler à sa nouvelle date.
  const resultats = await Promise.all(
    aDeplacer.map((id) =>
      supabase
        .from("taches")
        .update({ echeance: parId.get(id)!, rappel_envoye_le: null, rappel_reporte_jusqua: null })
        .eq("id", id)
    )
  );
  const echec = resultats.find((r) => r.error);
  if (echec?.error) {
    console.error("appliquerReplanification", echec.error);
    revalider();
    return fail("Certaines tâches n'ont pas pu être replanifiées. Réessaie.");
  }

  revalider();
  return ok({ nb: aDeplacer.length });
}
