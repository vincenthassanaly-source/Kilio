"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { HABITUDES_TAG } from "@/lib/habitudes/tags";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiParis } from "@/lib/date/paris";
import { progressionObjectif, type HabitudeLiee } from "@/lib/habitudes/compute";
import { shiftDate } from "@/lib/date/iso";
import { construireBilan, serieEnCours, tauxReussite, type CiblesJour, type JourBilan } from "@/lib/nutrition/bilan";
import { estJourType, type JourType } from "@/lib/nutrition/planning";
import { getDatesEntrainement } from "@/app/actions/journal";
import type { Enums, Tables } from "@/lib/supabase/types";

export type ObjectifFormState = { error: string | null };

const CATEGORIES: readonly Enums<"categorie_objectif">[] = ["perso", "pro"];
const TYPES_SUIVI: readonly Enums<"type_suivi_objectif">[] = ["valeur", "etapes", "binaire", "habitudes", "nutrition"];
const STATUTS: readonly Enums<"statut_objectif">[] = ["en_cours", "atteint", "abandonne"];

type ObjectifInput = {
  titre: string;
  description: string | null;
  categorie: Enums<"categorie_objectif">;
  type_suivi: Enums<"type_suivi_objectif">;
  date_echeance: string | null;
  valeur_cible: number | null;
  unite: string | null;
  habitude_ids: string[];
};

type ParseResult =
  | { ok: true; value: ObjectifInput }
  | { ok: false; error: string };

function parseObjectifInput(formData: FormData): ParseResult {
  const titre = String(formData.get("titre") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categorie = String(formData.get("categorie") ?? "");
  const type_suivi = String(formData.get("type_suivi") ?? "");
  const date_echeance = String(formData.get("date_echeance") ?? "").trim();
  const valeurCibleRaw = String(formData.get("valeur_cible") ?? "").trim();
  const unite = String(formData.get("unite") ?? "").trim();

  if (!titre) return { ok: false, error: "Le titre est requis." };
  if (!CATEGORIES.includes(categorie as Enums<"categorie_objectif">)) {
    return { ok: false, error: "Catégorie invalide." };
  }
  if (!TYPES_SUIVI.includes(type_suivi as Enums<"type_suivi_objectif">)) {
    return { ok: false, error: "Type de suivi invalide." };
  }

  const estValeur = type_suivi === "valeur";

  const habitude_ids =
    type_suivi === "habitudes"
      ? [...new Set(formData.getAll("habitude_ids").map(String).filter(Boolean))]
      : [];
  if (type_suivi === "habitudes" && habitude_ids.length === 0) {
    return { ok: false, error: "Choisis au moins une habitude à rattacher." };
  }

  let valeur_cible: number | null = null;
  if (estValeur && valeurCibleRaw) {
    valeur_cible = Number(valeurCibleRaw);
    if (!Number.isFinite(valeur_cible) || valeur_cible <= 0) {
      return { ok: false, error: "La valeur cible doit être un nombre positif." };
    }
  }

  return {
    ok: true,
    value: {
      titre,
      description: description || null,
      categorie: categorie as Enums<"categorie_objectif">,
      type_suivi: type_suivi as Enums<"type_suivi_objectif">,
      // Objectif Nutrition : permanent, sans échéance.
      date_echeance: type_suivi === "nutrition" ? null : date_echeance || null,
      valeur_cible,
      unite: estValeur && unite ? unite : null,
      habitude_ids,
    },
  };
}

// Remplace l'ensemble des habitudes rattachées à un objectif. Liste vide
// (objectif qui n'est plus en mode "habitudes") = plus aucun lien.
async function remplacerHabitudesLiees(objectifId: string, habitudeIds: string[]): Promise<string | null> {
  const supabase = createAdminClient();

  const { error: suppression } = await supabase
    .from("objectif_habitudes")
    .delete()
    .eq("objectif_id", objectifId);
  if (suppression) return suppression.message;

  if (habitudeIds.length === 0) return null;

  const { error: insertion } = await supabase
    .from("objectif_habitudes")
    .insert(habitudeIds.map((habitude_id) => ({ objectif_id: objectifId, habitude_id })));
  return insertion ? insertion.message : null;
}

// Habitudes proposées au rattachement dans le formulaire d'objectif.
export async function getHabitudesActives(): Promise<Pick<Tables<"habitudes">, "id" | "nom" | "icone" | "frequence_hebdo">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("habitudes")
    .select("id, nom, icone, frequence_hebdo")
    .eq("actif", true)
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Habitudes rattachées à un objectif, pour préremplir le formulaire d'édition.
export async function getHabitudeIdsDeLObjectif(objectifId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("objectif_habitudes")
    .select("habitude_id")
    .eq("objectif_id", objectifId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => l.habitude_id);
}

const MESSAGE_NUTRITION_UNIQUE = "Tu as déjà un objectif Nutrition : un seul est possible.";

// Un seul objectif de type « nutrition » (hors `exceptId`, l'objectif en
// cours d'édition). `null` : aucun doublon ; sinon le message d'erreur.
async function verifierNutritionUnique(exceptId?: string): Promise<string | null> {
  const supabase = createAdminClient();
  let requete = supabase.from("objectifs").select("id").eq("type_suivi", "nutrition").limit(1);
  if (exceptId) requete = requete.neq("id", exceptId);
  const { data, error } = await requete;
  if (error) return error.message;
  return data && data.length > 0 ? MESSAGE_NUTRITION_UNIQUE : null;
}

export async function creerObjectif(
  _prevState: ObjectifFormState,
  formData: FormData
): Promise<ObjectifFormState> {
  const parsed = parseObjectifInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  if (parsed.value.type_suivi === "nutrition") {
    const doublon = await verifierNutritionUnique();
    if (doublon) return { error: doublon };
  }

  const supabase = createAdminClient();

  const { data: dernier } = await supabase
    .from("objectifs")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { habitude_ids, ...champs } = parsed.value;
  const { data: cree, error } = await supabase
    .from("objectifs")
    .insert({ ...champs, ordre: (dernier?.ordre ?? -1) + 1 })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const lien = await remplacerHabitudesLiees(cree.id, habitude_ids);
  if (lien) return { error: lien };

  revalidatePath("/objectifs");
  revalidatePath("/habitudes");
  updateTag(HABITUDES_TAG);
  return { error: null };
}

export async function modifierObjectif(
  _prevState: ObjectifFormState,
  formData: FormData
): Promise<ObjectifFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Objectif introuvable." };

  const parsed = parseObjectifInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  if (parsed.value.type_suivi === "nutrition") {
    const doublon = await verifierNutritionUnique(id);
    if (doublon) return { error: doublon };
  }

  const supabase = createAdminClient();
  const { habitude_ids, ...champs } = parsed.value;
  const { error } = await supabase.from("objectifs").update(champs).eq("id", id);

  if (error) return { error: error.message };

  const lien = await remplacerHabitudesLiees(id, habitude_ids);
  if (lien) return { error: lien };

  revalidatePath("/objectifs");
  revalidatePath(`/objectifs/${id}`);
  revalidatePath("/habitudes");
  updateTag(HABITUDES_TAG);
  return { error: null };
}

export async function changerStatutObjectif(id: string, statut: Enums<"statut_objectif">) {
  if (!STATUTS.includes(statut)) throw new Error("Statut invalide.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("objectifs").update({ statut }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/objectifs");
  revalidatePath(`/objectifs/${id}`);
  updateTag(HABITUDES_TAG);
}

export async function supprimerObjectif(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("objectifs").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/objectifs");
  updateTag(HABITUDES_TAG);
  redirect("/objectifs");
}

export async function getObjectifs(): Promise<Tables<"objectifs">[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("objectifs")
    .select("*")
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type ObjectifDetail = {
  objectif: Tables<"objectifs">;
  etapes: Tables<"objectif_etapes">[];
  entries: Tables<"objectif_entries">[];
  // Mode "habitudes" : habitudes rattachées et progression (0 à 1).
  habitudes: { id: string; nom: string; icone: string | null; frequence_hebdo: number | null; actif: boolean; taux: number }[];
  progression: number | null;
  // Mode "nutrition" : suivi calculé depuis le Journal.
  suiviNutrition: SuiviNutrition | null;
};

// Fenêtre d'historique du Journal lue pour le suivi Nutrition : assez large
// pour une série longue, sous la limite de 1000 lignes par requête Supabase.
const NB_JOURS_SUIVI_NUTRITION = 90;

export type SuiviNutrition = {
  /** Du plus ancien au plus récent ; le dernier est aujourd'hui. */
  jours: JourBilan[];
  serie: { jours: number; tronquee: boolean };
  taux7: { reussis: number; evalues: number };
  taux30: { reussis: number; evalues: number };
  /** Au moins une cible kcal est définie dans le Journal. */
  aDesCibles: boolean;
};

export async function getObjectif(id: string): Promise<ObjectifDetail | null> {
  const supabase = createAdminClient();

  const { data: objectif, error: objectifError } = await supabase
    .from("objectifs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (objectifError) throw new Error(objectifError.message);
  if (!objectif) return null;

  const [{ data: etapes, error: etapesError }, { data: entries, error: entriesError }] =
    await Promise.all([
      supabase
        .from("objectif_etapes")
        .select("*")
        .eq("objectif_id", id)
        .order("ordre", { ascending: true }),
      supabase
        .from("objectif_entries")
        .select("*")
        .eq("objectif_id", id)
        .order("date", { ascending: true }),
    ]);

  if (etapesError) throw new Error(etapesError.message);
  if (entriesError) throw new Error(entriesError.message);

  const base = { objectif, etapes: etapes ?? [], entries: entries ?? [], habitudes: [], progression: null, suiviNutrition: null };

  if (objectif.type_suivi === "nutrition") {
    return { ...base, suiviNutrition: await calculerSuiviNutrition() };
  }
  if (objectif.type_suivi !== "habitudes") return base;

  const { habitudes, progression } = await calculerProgressionHabitudes(objectif);
  return { ...base, habitudes, progression };
}

// Suivi Nutrition : mêmes données et même évaluation que le Bilan du module
// Nutrition, mais un jour est réussi dès que les kcal sont sous la cible
// (protéines et autres macros n'entrent pas dans le verdict). Les cibles sont
// celles d'aujourd'hui, non historisées, comme dans le Bilan.
async function calculerSuiviNutrition(): Promise<SuiviNutrition> {
  const aujourdhui = aujourdhuiParis();
  const debut = shiftDate(aujourdhui, -(NB_JOURS_SUIVI_NUTRITION - 1));
  const supabase = createAdminClient();

  const [cibles, repas, datesEntrainement] = await Promise.all([
    supabase.from("objectifs_nutritionnels").select("*"),
    supabase
      .from("journal_repas")
      .select(
        "date, quantite, aliment:aliments(*), recette:recettes(id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g)))"
      )
      .gte("date", debut)
      .lte("date", aujourdhui),
    getDatesEntrainement(debut, aujourdhui),
  ]);

  const erreur = cibles.error ?? repas.error;
  if (erreur) throw new Error(erreur.message);

  const parType: Record<JourType, CiblesJour | null> = { repos: null, entrainement: null };
  for (const o of cibles.data ?? []) {
    if (estJourType(o.jour_type)) {
      parType[o.jour_type] = {
        kcal: o.kcal_cible,
        proteines: o.proteines_cible_g,
        glucides: o.glucides_cible_g,
        lipides: o.lipides_cible_g,
      };
    }
  }

  const jours = construireBilan({
    aujourdhui,
    nbJours: NB_JOURS_SUIVI_NUTRITION,
    entrees: repas.data ?? [],
    datesEntrainement,
    cibles: parType,
    proteinesRequises: false,
  });

  return {
    jours,
    serie: serieEnCours(jours),
    taux7: tauxReussite(jours.slice(-7)),
    taux30: tauxReussite(jours.slice(-30)),
    aDesCibles: parType.repos !== null || parType.entrainement !== null,
  };
}

async function calculerProgressionHabitudes(
  objectif: Tables<"objectifs">
): Promise<Pick<ObjectifDetail, "habitudes" | "progression">> {
  const supabase = createAdminClient();

  const { data: liens, error } = await supabase
    .from("objectif_habitudes")
    .select("habitudes(*)")
    .eq("objectif_id", objectif.id);
  if (error) throw new Error(error.message);

  const habitudes = (liens ?? []).flatMap((l) => (l.habitudes ? [l.habitudes] : []));
  if (habitudes.length === 0) return { habitudes: [], progression: 0 };

  const debutObjectif = objectif.created_at.slice(0, 10);
  const { data: entries, error: entriesError } = await supabase
    .from("habitude_entries")
    .select("habitude_id, date, valeur")
    .in("habitude_id", habitudes.map((h) => h.id))
    .gte("date", debutObjectif);
  if (entriesError) throw new Error(entriesError.message);

  const parHabitude = new Map<string, Map<string, number>>();
  for (const e of entries ?? []) {
    if (!parHabitude.has(e.habitude_id)) parHabitude.set(e.habitude_id, new Map());
    parHabitude.get(e.habitude_id)!.set(e.date, e.valeur);
  }

  const aujourdhui = aujourdhuiParis();
  const lies: HabitudeLiee[] = habitudes.map((h) => ({
    type: h.type,
    valeur_cible: h.valeur_cible,
    frequence_hebdo: h.frequence_hebdo,
    created_at: h.created_at,
    archivee_le: h.archivee_le,
    entriesParDate: parHabitude.get(h.id) ?? new Map(),
  }));

  return {
    habitudes: habitudes.map((h, i) => ({
      id: h.id,
      nom: h.nom,
      icone: h.icone,
      frequence_hebdo: h.frequence_hebdo,
      actif: h.actif,
      taux: progressionObjectif([lies[i]], debutObjectif, objectif.date_echeance, aujourdhui),
    })),
    progression: progressionObjectif(lies, debutObjectif, objectif.date_echeance, aujourdhui),
  };
}

// --- Étapes (type de suivi "etapes") ---

export async function ajouterEtape(objectifId: string, titre: string) {
  const trimmed = titre.trim();
  if (!trimmed) throw new Error("Le titre de l'étape est requis.");

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("objectif_etapes")
    .select("ordre")
    .eq("objectif_id", objectifId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("objectif_etapes").insert({
    objectif_id: objectifId,
    titre: trimmed,
    ordre: (derniere?.ordre ?? -1) + 1,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/objectifs/${objectifId}`);
}

export async function toggleEtape(objectifId: string, etapeId: string, fait: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("objectif_etapes")
    .update({ fait })
    .eq("id", etapeId);

  if (error) throw new Error(error.message);

  revalidatePath(`/objectifs/${objectifId}`);
}

export async function supprimerEtape(objectifId: string, etapeId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("objectif_etapes").delete().eq("id", etapeId);

  if (error) throw new Error(error.message);

  revalidatePath(`/objectifs/${objectifId}`);
}

// Réordonnance simple par échange avec l'étape voisine (pas de drag & drop
// dans le codebase) : déplace l'étape d'un cran vers le haut ou le bas en
// permutant sa colonne `ordre` avec celle de la voisine.
export async function deplacerEtape(
  objectifId: string,
  etapeId: string,
  direction: "haut" | "bas"
) {
  const supabase = createAdminClient();

  const { data: etapes, error } = await supabase
    .from("objectif_etapes")
    .select("id, ordre")
    .eq("objectif_id", objectifId)
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);
  if (!etapes) return;

  const index = etapes.findIndex((e) => e.id === etapeId);
  if (index === -1) return;

  const voisinIndex = direction === "haut" ? index - 1 : index + 1;
  if (voisinIndex < 0 || voisinIndex >= etapes.length) return;

  const courante = etapes[index];
  const voisine = etapes[voisinIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from("objectif_etapes").update({ ordre: voisine.ordre }).eq("id", courante.id),
    supabase.from("objectif_etapes").update({ ordre: courante.ordre }).eq("id", voisine.id),
  ]);

  if (err1) throw new Error(err1.message);
  if (err2) throw new Error(err2.message);

  revalidatePath(`/objectifs/${objectifId}`);
}

// --- Entrées (type de suivi "valeur") ---

// Contrat `ActionResult` (T1). La valeur arrive **brute** (texte du champ) :
// un champ vide est refusé au lieu d'être enregistré comme 0
// (`Number("") === 0` écrasait la mesure du jour, constat T2 de l'audit).
// Pour retirer une mesure, `supprimerEntreeObjectif` ci-dessous.
export async function enregistrerEntreeObjectif(
  objectifId: string,
  date: string,
  valeurSaisie: string | number
): Promise<ActionResult> {
  const texte = typeof valeurSaisie === "number" ? String(valeurSaisie) : valeurSaisie.trim().replace(",", ".");
  if (texte === "") return fail("Saisis une valeur, ou supprime la mesure de ce jour.");
  const valeur = Number(texte);
  if (!Number.isFinite(valeur)) return fail("Valeur invalide : saisis un nombre.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Date invalide.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("objectif_entries")
    .upsert({ objectif_id: objectifId, date, valeur }, { onConflict: "objectif_id,date" });

  if (error) return fail("La valeur n'a pas pu être enregistrée. Réessaie.");

  revalidatePath(`/objectifs/${objectifId}`);
  return ok();
}

// Suppression explicite d'une mesure (remplace l'ancien « champ vide = 0 »).
export async function supprimerEntreeObjectif(objectifId: string, date: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("objectif_entries")
    .delete()
    .eq("objectif_id", objectifId)
    .eq("date", date);

  if (error) return fail("La mesure n'a pas pu être supprimée. Réessaie.");

  revalidatePath(`/objectifs/${objectifId}`);
  return ok();
}
