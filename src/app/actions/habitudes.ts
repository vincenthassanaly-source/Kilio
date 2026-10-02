"use server";

import { revalidatePath, updateTag } from "next/cache";
import { calculerStreak, calculerStreakHebdo, estFait, lundiDe } from "@/lib/habitudes/compute";
import { aujourdhuiParis } from "@/lib/date/paris";
import { createAdminClient } from "@/lib/supabase/admin";
import { HABITUDES_TAG } from "@/lib/habitudes/tags";
import type { Enums, Tables } from "@/lib/supabase/types";

export type HabitudeFormState = { error: string | null };

const TYPES: readonly Enums<"habitude_type">[] = ["boolean", "streak", "quantifiee"];

type HabitudeInput = {
  nom: string;
  type: Enums<"habitude_type">;
  unite: string | null;
  valeur_cible: number | null;
  icone: string | null;
  frequence_hebdo: number | null;
};

type ParseResult =
  | { ok: true; value: HabitudeInput }
  | { ok: false; error: string };

function parseHabitudeInput(formData: FormData): ParseResult {
  const nom = String(formData.get("nom") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const unite = String(formData.get("unite") ?? "").trim();
  const valeurCibleRaw = String(formData.get("valeur_cible") ?? "").trim();
  const icone = String(formData.get("icone") ?? "").trim();
  const frequenceRaw = String(formData.get("frequence_hebdo") ?? "").trim();

  if (!nom) return { ok: false, error: "Le nom est requis." };
  if (!TYPES.includes(type as Enums<"habitude_type">)) {
    return { ok: false, error: "Type d'habitude invalide." };
  }

  const estQuantifiee = type === "quantifiee";

  let valeur_cible: number | null = null;
  if (estQuantifiee && valeurCibleRaw) {
    valeur_cible = Number(valeurCibleRaw);
    if (!Number.isFinite(valeur_cible) || valeur_cible <= 0) {
      return { ok: false, error: "L'objectif doit être un nombre positif." };
    }
  }

  // Vide = quotidienne ; sinon "X fois par semaine" (1 à 6).
  let frequence_hebdo: number | null = null;
  if (frequenceRaw) {
    frequence_hebdo = Number(frequenceRaw);
    if (!Number.isInteger(frequence_hebdo) || frequence_hebdo < 1 || frequence_hebdo > 6) {
      return { ok: false, error: "La fréquence doit être un nombre de 1 à 6 fois par semaine." };
    }
  }

  return {
    ok: true,
    value: {
      nom,
      type: type as Enums<"habitude_type">,
      frequence_hebdo,
      unite: estQuantifiee && unite ? unite : null,
      valeur_cible,
      icone: icone || null,
    },
  };
}

export async function creerHabitude(
  _prevState: HabitudeFormState,
  formData: FormData
): Promise<HabitudeFormState> {
  const parsed = parseHabitudeInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();

  const { data: dernier } = await supabase
    .from("habitudes")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("habitudes").insert({
    ...parsed.value,
    ordre: (dernier?.ordre ?? -1) + 1,
  });

  if (error) return { error: error.message };

  revalidatePath("/habitudes");
  updateTag(HABITUDES_TAG);
  return { error: null };
}

export async function modifierHabitude(
  _prevState: HabitudeFormState,
  formData: FormData
): Promise<HabitudeFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Habitude introuvable." };

  const parsed = parseHabitudeInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("habitudes").update(parsed.value).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/habitudes");
  updateTag(HABITUDES_TAG);
  return { error: null };
}

// Archivage plutôt que suppression : `actif = false` retire l'habitude de la
// vue "Aujourd'hui" tout en conservant habitude_entries (ON DELETE CASCADE
// sinon détruirait l'historique/heatmap). `archivee_le` borne la période
// comptée dans les objectifs liés (l'habitude cesse de peser dessus).
export async function supprimerHabitude(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("habitudes")
    .update({ actif: false, archivee_le: aujourdhuiParis() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/habitudes");
  updateTag(HABITUDES_TAG);
  revalidatePath("/objectifs");
}

export async function enregistrerEntreeHabitude(
  habitudeId: string,
  date: string,
  valeur: number
) {
  if (!Number.isFinite(valeur) || valeur < 0) {
    throw new Error("Valeur invalide.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("habitude_entries")
    .upsert({ habitude_id: habitudeId, date, valeur }, { onConflict: "habitude_id,date" });

  if (error) throw new Error(error.message);

  revalidatePath("/habitudes");
  updateTag(HABITUDES_TAG);
}

export type HabitudeDuJour = Tables<"habitudes"> & {
  entreeDuJour: Tables<"habitude_entries"> | null;
  // Jours (quotidienne/série) ou semaines (fréquence hebdo) consécutifs.
  streak: number;
  // Fréquence hebdo uniquement : check faits cette semaine (lundi-dimanche).
  faitsCetteSemaine: number;
  // Objectifs auxquels l'habitude contribue.
  objectifs: { id: string; titre: string }[];
};

export async function getHabitudesDuJour(date: string): Promise<HabitudeDuJour[]> {
  const supabase = createAdminClient();

  const { data: habitudes, error: habitudesError } = await supabase
    .from("habitudes")
    .select("*")
    .eq("actif", true)
    .order("ordre", { ascending: true });

  if (habitudesError) throw new Error(habitudesError.message);
  if (!habitudes || habitudes.length === 0) return [];

  const streakIds = habitudes
    .filter((h) => h.type === "streak" || h.frequence_hebdo != null)
    .map((h) => h.id);

  // Historique large (1 an) pour les habitudes de type streak, sinon
  // uniquement l'entrée du jour demandé.
  const idsAJour = habitudes.map((h) => h.id);
  const uneAnneeAvant = new Date(`${date}T00:00:00Z`);
  uneAnneeAvant.setUTCDate(uneAnneeAvant.getUTCDate() - 365);
  const dateMin = streakIds.length > 0 ? uneAnneeAvant.toISOString().slice(0, 10) : date;

  const { data: entries, error: entriesError } = await supabase
    .from("habitude_entries")
    .select("*")
    .in("habitude_id", idsAJour)
    .gte("date", dateMin)
    .lte("date", date);

  if (entriesError) throw new Error(entriesError.message);

  const entriesParHabitude = new Map<string, Map<string, number>>();
  const entreeDuJourParHabitude = new Map<string, Tables<"habitude_entries">>();
  for (const entry of entries ?? []) {
    if (!entriesParHabitude.has(entry.habitude_id)) {
      entriesParHabitude.set(entry.habitude_id, new Map());
    }
    entriesParHabitude.get(entry.habitude_id)!.set(entry.date, entry.valeur);
    if (entry.date === date) entreeDuJourParHabitude.set(entry.habitude_id, entry);
  }

  const { data: liens, error: liensError } = await supabase
    .from("objectif_habitudes")
    .select("habitude_id, objectifs(id, titre, statut)")
    .in("habitude_id", idsAJour);

  if (liensError) throw new Error(liensError.message);

  const objectifsParHabitude = new Map<string, { id: string; titre: string }[]>();
  for (const lien of liens ?? []) {
    const objectif = lien.objectifs;
    if (!objectif || objectif.statut !== "en_cours") continue;
    const liste = objectifsParHabitude.get(lien.habitude_id) ?? [];
    liste.push({ id: objectif.id, titre: objectif.titre });
    objectifsParHabitude.set(lien.habitude_id, liste);
  }

  const lundi = lundiDe(date);

  return habitudes.map((habitude) => {
    const entriesDeLHabitude = entriesParHabitude.get(habitude.id) ?? new Map<string, number>();
    const hebdo = habitude.frequence_hebdo != null;

    let faitsCetteSemaine = 0;
    if (hebdo) {
      for (const [jour, valeur] of entriesDeLHabitude) {
        if (jour >= lundi && jour <= date && estFait(habitude, valeur)) faitsCetteSemaine += 1;
      }
    }

    return {
      ...habitude,
      entreeDuJour: entreeDuJourParHabitude.get(habitude.id) ?? null,
      streak: hebdo
        ? calculerStreakHebdo(habitude, entriesDeLHabitude, date)
        : habitude.type === "streak"
          ? calculerStreak(entriesDeLHabitude, date)
          : 0,
      faitsCetteSemaine,
      objectifs: objectifsParHabitude.get(habitude.id) ?? [],
    };
  });
}

// `debutMois`/`finMois` au format ISO (yyyy-MM-dd), bornes incluses.
export async function getHistoriqueHabitude(
  habitudeId: string,
  debutMois: string,
  finMois: string
): Promise<Tables<"habitude_entries">[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("habitude_entries")
    .select("*")
    .eq("habitude_id", habitudeId)
    .gte("date", debutMois)
    .lte("date", finMois)
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}
