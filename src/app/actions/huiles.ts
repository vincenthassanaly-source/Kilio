"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { genererCartesHuile, validerHuile, type CarteHuile, type HuileChamps, type HuilesSnapshot, type PharmaHuile } from "@/lib/pharmacie/huiles";

type Supabase = ReturnType<typeof createAdminClient>;

// Lecture unique des huiles essentielles (voir lib/pharmacie/huiles.ts).
export async function getHuilesSnapshot(): Promise<HuilesSnapshot> {
  const supabase = createAdminClient();
  const huiles = await fetchAllRows<PharmaHuile>((from, to) =>
    supabase.from("pharma_he_huiles").select("*").order("nom_fr").order("id").range(from, to)
  );
  return { huiles, genereLe: new Date().toISOString() };
}

// Les cartes d'une huile sont dérivées de sa fiche : on les resynchronise à
// chaque enregistrement. Une carte dont le texte change garde son état de
// répétition (échéance, facilité…) ; celle qui n'a plus lieu d'être disparaît.
// Retourne le message d'erreur, ou null.
async function synchroniserCartes(supabase: Supabase, huileId: string, voulues: CarteHuile[]): Promise<string | null> {
  const { data, error } = await supabase
    .from("pharma_cartes")
    .select("id, he_type, question, reponse")
    .eq("huile_id", huileId);
  if (error) return error.message;

  const existantes = data ?? [];
  const parType = new Map(existantes.map((c) => [c.he_type, c]));
  const typesVoulus = new Set<string>(voulues.map((c) => c.he_type));

  const aSupprimer = existantes.filter((c) => !c.he_type || !typesVoulus.has(c.he_type)).map((c) => c.id);
  if (aSupprimer.length > 0) {
    const { error: errSuppr } = await supabase.from("pharma_cartes").delete().in("id", aSupprimer);
    if (errSuppr) return errSuppr.message;
  }

  const nouvelles = voulues.filter((c) => !parType.has(c.he_type)).map((c) => ({ ...c, huile_id: huileId }));
  if (nouvelles.length > 0) {
    const { error: errInsert } = await supabase.from("pharma_cartes").insert(nouvelles);
    if (errInsert) return errInsert.message;
  }

  for (const carte of voulues) {
    const courante = parType.get(carte.he_type);
    if (!courante || (courante.question === carte.question && courante.reponse === carte.reponse)) continue;
    const { error: errUpdate } = await supabase
      .from("pharma_cartes")
      .update({ question: carte.question, reponse: carte.reponse })
      .eq("id", courante.id);
    if (errUpdate) return errUpdate.message;
  }
  return null;
}

function rafraichir() {
  revalidatePath("/pharmacie/huiles-essentielles");
  revalidatePath("/pharmacie/revision");
}

export async function creerHuile(champs: HuileChamps): Promise<ActionResult<{ id: string }>> {
  const validation = validerHuile(champs);
  if (!validation.ok) return fail(validation.erreur);

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("pharma_he_huiles").insert(validation.huile).select("id").single();
  if (error) return fail(error.message);

  const erreurCartes = await synchroniserCartes(supabase, data.id, genererCartesHuile(validation.huile));
  rafraichir();
  // La fiche est créée même si les cartes ont échoué : un nouvel enregistrement les recrée.
  if (erreurCartes) return fail(`Fiche créée, mais les cartes de révision ont échoué : ${erreurCartes}`);
  return ok({ id: data.id });
}

export async function modifierHuile(id: string, champs: HuileChamps): Promise<ActionResult> {
  const validation = validerHuile(champs);
  if (!validation.ok) return fail(validation.erreur);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pharma_he_huiles")
    .update({ ...validation.huile, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);

  const erreurCartes = await synchroniserCartes(supabase, id, genererCartesHuile(validation.huile));
  rafraichir();
  if (erreurCartes) return fail(`Fiche enregistrée, mais les cartes de révision ont échoué : ${erreurCartes}`);
  return ok();
}

// Les cartes de l'huile partent avec elle (ON DELETE CASCADE).
export async function supprimerHuile(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pharma_he_huiles").delete().eq("id", id);
  if (error) return fail(error.message);

  rafraichir();
  return ok();
}
