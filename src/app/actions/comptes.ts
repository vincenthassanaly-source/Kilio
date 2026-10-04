"use server";

import { revalidatePath, updateTag } from "next/cache";
import { BUDGET_TAG } from "@/lib/budget/tags";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { fetchAllRows } from "@/lib/supabase/pagination";
import type { Enums, Tables } from "@/lib/supabase/types";

export type CompteFormState = { error: string | null };

const TYPES_COMPTE: readonly Enums<"type_compte">[] = ["courant", "epargne", "autre"];

type CompteInput = {
  nom: string;
  type: Enums<"type_compte">;
  solde_initial: number;
};

type ParseResult = { ok: true; value: CompteInput } | { ok: false; error: string };

function parseCompteInput(formData: FormData): ParseResult {
  const nom = String(formData.get("nom") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const soldeRaw = String(formData.get("solde_initial") ?? "").trim();

  if (!nom) return { ok: false, error: "Le nom est requis." };
  if (!TYPES_COMPTE.includes(type as Enums<"type_compte">)) {
    return { ok: false, error: "Type de compte invalide." };
  }

  const solde_initial = soldeRaw === "" ? 0 : Number(soldeRaw);
  if (!Number.isFinite(solde_initial)) {
    return { ok: false, error: "Le solde initial doit être un nombre." };
  }

  return { ok: true, value: { nom, type: type as Enums<"type_compte">, solde_initial } };
}

export async function creerCompte(
  _prevState: CompteFormState,
  formData: FormData
): Promise<CompteFormState> {
  const parsed = parseCompteInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("comptes").insert(parsed.value);
  if (error) return { error: error.message };

  revalidatePath("/budget");
  revalidatePath("/budget/comptes");
  updateTag(BUDGET_TAG);
  return { error: null };
}

export async function modifierCompte(
  _prevState: CompteFormState,
  formData: FormData
): Promise<CompteFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Compte introuvable." };

  const parsed = parseCompteInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("comptes").update(parsed.value).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/budget");
  revalidatePath("/budget/comptes");
  updateTag(BUDGET_TAG);
  return { error: null };
}

export type ImpactSuppressionCompte = {
  transactions: number;
  virementsLies: number;
  recurrences: number;
};

/**
 * Ce que la suppression d'un compte efface en cascade (`on delete cascade`
 * sur transactions.compte_id / compte_destination_id et sur
 * transactions_recurrentes) : affiché dans la confirmation explicite de
 * ComptesList (constat T2). `virementsLies` : virements depuis ou vers un
 * autre compte, dont le solde changera.
 */
export async function getImpactSuppressionCompte(id: string): Promise<ActionResult<ImpactSuppressionCompte>> {
  const supabase = createAdminClient();
  const [tx, virements, recurrences] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .or(`compte_id.eq.${id},compte_destination_id.eq.${id}`),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", "virement")
      .or(`compte_id.eq.${id},compte_destination_id.eq.${id}`),
    supabase
      .from("transactions_recurrentes")
      .select("id", { count: "exact", head: true })
      .or(`compte_id.eq.${id},compte_destination_id.eq.${id}`),
  ]);
  if (tx.error || virements.error || recurrences.error) {
    return fail("Impossible de vérifier l'historique du compte. Réessaie.");
  }
  return ok({
    transactions: tx.count ?? 0,
    virementsLies: virements.count ?? 0,
    recurrences: recurrences.count ?? 0,
  });
}

export async function supprimerCompte(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("comptes").delete().eq("id", id);
  if (error) return fail("Le compte n'a pas pu être supprimé. Réessaie.");

  revalidatePath("/budget");
  revalidatePath("/budget/comptes");
  revalidatePath("/budget/transactions");
  revalidatePath("/budget/recurrentes");
  updateTag(BUDGET_TAG);
  return ok();
}

export type CompteAvecSolde = Tables<"comptes"> & { solde: number };

export async function getComptesAvecSolde(): Promise<CompteAvecSolde[]> {
  const supabase = createAdminClient();

  const [{ data: comptes, error: comptesError }, transactions] = await Promise.all([
    supabase.from("comptes").select("*").order("created_at", { ascending: true }),
    // Historique complet, non borné par une date : au-delà de 1000 lignes
    // (plafond par défaut de PostgREST), une simple `.select()` tronquerait
    // silencieusement l'historique et fausserait les soldes calculés
    // ci-dessous.
    fetchAllRows<Pick<Tables<"transactions">, "compte_id" | "compte_destination_id" | "montant" | "type">>(
      (from, to) =>
        supabase
          .from("transactions")
          .select("compte_id, compte_destination_id, montant, type")
          .range(from, to)
    ),
  ]);

  if (comptesError) throw new Error(comptesError.message);

  // Un virement ne passe pas par solde_initial : il diminue le compte source
  // et augmente le compte destination, en plus (et indépendamment) des
  // dépenses/revenus classiques.
  const mouvements = new Map<string, number>();
  function ajouter(compteId: string, delta: number) {
    mouvements.set(compteId, (mouvements.get(compteId) ?? 0) + delta);
  }
  for (const t of transactions) {
    if (t.type === "revenu") ajouter(t.compte_id, t.montant);
    else if (t.type === "depense") ajouter(t.compte_id, -t.montant);
    else if (t.type === "virement" && t.compte_destination_id) {
      ajouter(t.compte_id, -t.montant);
      ajouter(t.compte_destination_id, t.montant);
    }
  }

  return (comptes ?? []).map((compte) => ({
    ...compte,
    solde: compte.solde_initial + (mouvements.get(compte.id) ?? 0),
  }));
}
