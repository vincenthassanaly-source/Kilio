import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import { aujourdhuiParis } from "@/lib/date/paris";

const MOMENTS: readonly Enums<"moment_repas">[] = ["petit_dej", "dejeuner", "diner", "collation"];

export type SaisieRepas = {
  aliment_id: string | null;
  recette_id: string | null;
  /** Grammes/ml pour un aliment (pièces déjà converties), portions pour une recette. */
  quantite: number;
  date: string;
  moment: Enums<"moment_repas">;
};

/**
 * Lit et valide la saisie d'un repas envoyée par AjoutRepasPanneau (champs
 * `type`, `aliment_id` / `recette_id`, `quantite`, `saisie_mode`, `date`,
 * `moment`). Partagée par le Journal (`addJournalEntry`) et les Menus
 * (`addMenuEntry`) : les deux écrans acceptent exactement la même saisie.
 * Sans `date`, le jour courant côté serveur.
 */
export async function lireSaisieRepas(formData: FormData): Promise<{ error: string } | { saisie: SaisieRepas }> {
  const type = String(formData.get("type") ?? "");
  const aliment_id = String(formData.get("aliment_id") ?? "").trim();
  const recette_id = String(formData.get("recette_id") ?? "").trim();
  const quantiteSaisie = Number(formData.get("quantite"));
  const saisieMode = String(formData.get("saisie_mode") ?? "grammes");
  const date = String(formData.get("date") ?? "").trim() || aujourdhuiParis();
  const moment = String(formData.get("moment") ?? "");

  if (type !== "aliment" && type !== "recette") {
    return { error: "Type d'entrée invalide." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };
  if (!MOMENTS.includes(moment as Enums<"moment_repas">)) {
    return { error: "Moment du repas invalide." };
  }
  if (!Number.isFinite(quantiteSaisie) || quantiteSaisie <= 0) {
    return { error: "La quantité doit être un nombre positif." };
  }
  if (type === "aliment" && !aliment_id) return { error: "Aliment requis." };
  if (type === "recette" && !recette_id) return { error: "Recette requise." };
  if (saisieMode !== "grammes" && saisieMode !== "piece") {
    return { error: "Mode de saisie invalide." };
  }

  let quantite = quantiteSaisie;
  if (type === "aliment" && saisieMode === "piece") {
    const supabase = createAdminClient();
    const { data: aliment, error: alimentError } = await supabase
      .from("aliments")
      .select("poids_unite_g")
      .eq("id", aliment_id)
      .single();

    if (alimentError || !aliment) return { error: "Aliment introuvable." };
    if (aliment.poids_unite_g === null) {
      return {
        error: "Cet aliment n'a pas de poids par pièce défini : saisis une quantité en grammes.",
      };
    }
    quantite = quantiteSaisie * aliment.poids_unite_g;
  }

  return {
    saisie: {
      aliment_id: type === "aliment" ? aliment_id : null,
      recette_id: type === "recette" ? recette_id : null,
      quantite,
      date,
      moment: moment as Enums<"moment_repas">,
    },
  };
}
