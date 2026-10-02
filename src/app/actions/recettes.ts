"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECETTES_TAG } from "@/lib/nutrition/tags";
import type { Enums } from "@/lib/supabase/types";

export type RecetteFormState = { error: string | null };

const SOURCES: readonly Enums<"recette_source">[] = ["manuel", "hellofresh"];

const NUTRITION_FIELDS = [
  "kcal_portion",
  "proteines_portion",
  "glucides_portion",
  "sucres_portion",
  "lipides_portion",
  "satures_portion",
  "fibres_portion",
  "sel_portion",
  "kcal_100g",
  "proteines_100g",
  "glucides_100g",
  "sucres_100g",
  "lipides_100g",
  "satures_100g",
  "fibres_100g",
  "sel_100g",
] as const;

type NutritionField = (typeof NUTRITION_FIELDS)[number];

type RecetteInput = {
  nom: string;
  description: string | null;
  temps_prepa_min: number | null;
  portions: number;
  source: Enums<"recette_source">;
  ustensiles: string[] | null;
} & Record<NutritionField, number | null>;

type ParseResult =
  | { ok: true; value: RecetteInput }
  | { ok: false; error: string };

function parseRecetteInput(formData: FormData): ParseResult {
  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const tempsRaw = String(formData.get("temps_prepa_min") ?? "").trim();
  const portions = Number(formData.get("portions") ?? 1);
  const source = String(formData.get("source") ?? "manuel");
  const ustensilesRaw = String(formData.get("ustensiles") ?? "");

  if (!nom) return { ok: false, error: "Le nom est requis." };
  if (!SOURCES.includes(source as Enums<"recette_source">)) {
    return { ok: false, error: "Source invalide." };
  }
  if (!Number.isInteger(portions) || portions <= 0) {
    return { ok: false, error: "Le nombre de portions doit être un entier positif." };
  }

  let temps_prepa_min: number | null = null;
  if (tempsRaw) {
    temps_prepa_min = Number(tempsRaw);
    if (!Number.isInteger(temps_prepa_min) || temps_prepa_min < 0) {
      return { ok: false, error: "Le temps de préparation doit être un entier positif." };
    }
  }

  const nutrition = {} as Record<NutritionField, number | null>;
  for (const field of NUTRITION_FIELDS) {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) {
      nutrition[field] = null;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, error: "Les valeurs nutritionnelles doivent être des nombres positifs." };
    }
    nutrition[field] = value;
  }

  const ustensiles = ustensilesRaw
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  return {
    ok: true,
    value: {
      nom,
      description: description || null,
      temps_prepa_min,
      portions,
      source: source as Enums<"recette_source">,
      ustensiles: ustensiles.length > 0 ? ustensiles : null,
      ...nutrition,
    },
  };
}

export async function createRecette(
  _prevState: RecetteFormState,
  formData: FormData
): Promise<RecetteFormState> {
  const parsed = parseRecetteInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("recettes")
    .insert(parsed.value)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/nutrition/recettes");
  updateTag(RECETTES_TAG);
  redirect(`/nutrition/recettes/${data.id}`);
}

export async function updateRecette(
  _prevState: RecetteFormState,
  formData: FormData
): Promise<RecetteFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Recette introuvable." };

  const parsed = parseRecetteInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recettes")
    .update(parsed.value, { count: "exact" })
    .eq("id", id);

  if (error) return { error: error.message };
  if (!count) {
    return {
      error: "Modification impossible : cette recette est partagée et non modifiable.",
    };
  }

  revalidatePath("/nutrition/recettes");
  updateTag(RECETTES_TAG);
  revalidatePath(`/nutrition/recettes/${id}`);
  return { error: null };
}

export async function deleteRecette(id: string) {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recettes")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) throw new Error(error.message);
  if (!count) {
    throw new Error("Suppression impossible : cette recette est partagée et non modifiable.");
  }

  revalidatePath("/nutrition/recettes");
  updateTag(RECETTES_TAG);
  redirect("/nutrition/recettes");
}
