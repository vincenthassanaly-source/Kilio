"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getEvenements } from "@/app/actions/evenements";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { parseISODate, shiftDate } from "@/lib/date/iso";
import { aujourdhuiParis } from "@/lib/date/paris";
import { MESSAGE_QUOTA_GEMINI, appelerGemini } from "@/lib/gemini/appel";
import { creerCacheCourt, empreinte } from "@/lib/gemini/cache-court";
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

const cacheSyntheses = creerCacheCourt<SyntheseRevue>(CACHE_DUREE_MS, CACHE_TAILLE_MAX);
const cacheReplanifications = creerCacheCourt<PropositionReplanification[]>(CACHE_DUREE_MS, CACHE_TAILLE_MAX);

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

function echecGemini(code: "quota" | "echec", detail: string) {
  return fail(code === "quota" ? MESSAGE_QUOTA_GEMINI : `${detail} Réessaie.`);
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
  if (!resultat.ok) return echecGemini(resultat.code, resultat.detail);

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
  if (!resultat.ok) return echecGemini(resultat.code, resultat.detail);

  const propositions = lireReplanification(resultat.brut, aReplanifier, today);
  if (!propositions) {
    return fail("Gemini n'a trouvé aucune meilleure date pour ces tâches. Réessaie ou replanifie à la main.");
  }

  cacheReplanifications.ecrire(cle, propositions);
  return ok({ propositions });
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
