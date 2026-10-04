"use server";

import { revalidatePath, updateTag } from "next/cache";
import { BUDGET_TAG } from "@/lib/budget/tags";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { finDuMois } from "@/lib/budget/compute";
import { motifContient } from "@/lib/supabase/like";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { estUuid } from "@/lib/uuid";
import type { Enums, Tables } from "@/lib/supabase/types";

export type TransactionFormState = { error: string | null };

type TransactionInput = {
  compte_id: string;
  categorie_id: string;
  montant: number;
  date_operation: string;
  libelle: string | null;
};

type ParseResult = { ok: true; value: TransactionInput } | { ok: false; error: string };

// Le type (dépense/revenu) n'est jamais lu depuis le formulaire : il est
// dérivé côté serveur à partir de la catégorie choisie (cf. creerTransaction /
// modifierTransaction), pour garantir l'invariant transaction.type ===
// categorie.type sans dépendre d'un champ caché maintenu par le client.
function parseTransactionInput(formData: FormData): ParseResult {
  const compte_id = String(formData.get("compte_id") ?? "").trim();
  const categorie_id = String(formData.get("categorie_id") ?? "").trim();
  const montantRaw = String(formData.get("montant") ?? "").trim();
  const date_operation = String(formData.get("date_operation") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim();

  if (!compte_id) return { ok: false, error: "Le compte est requis." };
  if (!categorie_id) return { ok: false, error: "La catégorie est requise." };
  if (!date_operation) return { ok: false, error: "La date est requise." };

  const montant = Number(montantRaw);
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, error: "Le montant doit être un nombre positif." };
  }

  return {
    ok: true,
    value: { compte_id, categorie_id, montant, date_operation, libelle: libelle || null },
  };
}

async function getTypeCategorie(
  supabase: ReturnType<typeof createAdminClient>,
  categorieId: string
): Promise<Enums<"type_mouvement"> | null> {
  const { data, error } = await supabase
    .from("categories_budget")
    .select("type")
    .eq("id", categorieId)
    .maybeSingle();

  if (error || !data) return null;
  return data.type;
}

function revalidateTransactionPaths() {
  revalidatePath("/budget");
  revalidatePath("/budget/comptes");
  revalidatePath("/budget/transactions");
  revalidatePath("/budget/categories");
  updateTag(BUDGET_TAG);
}

export async function creerTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const parsed = parseTransactionInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const type = await getTypeCategorie(supabase, parsed.value.categorie_id);
  if (!type) return { error: "Catégorie introuvable." };

  const { error } = await supabase.from("transactions").insert({ ...parsed.value, type });
  if (error) return { error: error.message };

  revalidateTransactionPaths();
  return { error: null };
}

export async function modifierTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Transaction introuvable." };

  const parsed = parseTransactionInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const type = await getTypeCategorie(supabase, parsed.value.categorie_id);
  if (!type) return { error: "Catégorie introuvable." };

  const { error } = await supabase
    .from("transactions")
    .update({ ...parsed.value, type })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateTransactionPaths();
  return { error: null };
}

export async function supprimerTransaction(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return fail("La transaction n'a pas pu être supprimée. Réessaie.");

  revalidateTransactionPaths();
  return ok();
}

type VirementInput = {
  compte_id: string;
  compte_destination_id: string;
  montant: number;
  date_operation: string;
  libelle: string | null;
};

type ParseVirementResult = { ok: true; value: VirementInput } | { ok: false; error: string };

function parseVirementInput(formData: FormData): ParseVirementResult {
  const compte_id = String(formData.get("compte_id") ?? "").trim();
  const compte_destination_id = String(formData.get("compte_destination_id") ?? "").trim();
  const montantRaw = String(formData.get("montant") ?? "").trim();
  const date_operation = String(formData.get("date_operation") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim();

  if (!compte_id) return { ok: false, error: "Le compte source est requis." };
  if (!compte_destination_id) return { ok: false, error: "Le compte destination est requis." };
  if (compte_id === compte_destination_id) {
    return { ok: false, error: "Les comptes source et destination doivent être différents." };
  }
  if (!date_operation) return { ok: false, error: "La date est requise." };

  const montant = Number(montantRaw);
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, error: "Le montant doit être un nombre positif." };
  }

  return {
    ok: true,
    value: { compte_id, compte_destination_id, montant, date_operation, libelle: libelle || null },
  };
}

export async function creerVirement(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const parsed = parseVirementInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transactions")
    .insert({ ...parsed.value, type: "virement", categorie_id: null });
  if (error) return { error: error.message };

  revalidateTransactionPaths();
  return { error: null };
}

export async function modifierVirement(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Virement introuvable." };

  const parsed = parseVirementInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transactions")
    .update({ ...parsed.value, type: "virement", categorie_id: null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateTransactionPaths();
  return { error: null };
}

export type TransactionAvecRelations = Tables<"transactions"> & {
  compte: Pick<Tables<"comptes">, "id" | "nom"> | null;
  compte_destination: Pick<Tables<"comptes">, "id" | "nom"> | null;
  categorie: Pick<Tables<"categories_budget">, "id" | "nom" | "icone"> | null;
};

export async function getTransactions(filtres?: {
  compteId?: string;
  categorieId?: string;
  /** Format "YYYY-MM-01" (premier jour du mois). */
  mois?: string;
  /** Format "YYYY-MM-DD" : filtre sur une date exacte (vue calendrier). */
  date?: string;
  /** Recherche insensible à la casse sur `libelle` (ilike). */
  recherche?: string;
}): Promise<TransactionAvecRelations[]> {
  const supabase = createAdminClient();

  // Reconstruit à chaque page (voir plus bas) : un query builder Supabase ne
  // se rejoue pas après avoir été exécuté une première fois.
  function buildQuery() {
    // Deux FK vers `comptes` (compte_id, compte_destination_id) : il faut
    // désambiguïser chaque embed PostgREST avec le nom de la contrainte.
    let query = supabase
      .from("transactions")
      .select(
        "*, compte:comptes!transactions_compte_id_fkey(id, nom), compte_destination:comptes!transactions_compte_destination_id_fkey(id, nom), categorie:categories_budget(id, nom, icone)"
      )
      .order("date_operation", { ascending: false })
      .order("created_at", { ascending: false });

    if (filtres?.compteId && estUuid(filtres.compteId)) {
      // Un virement doit apparaître dans l'historique filtré du compte crédité
      // comme de celui débité, pas seulement de la source.
      query = query.or(
        `compte_id.eq.${filtres.compteId},compte_destination_id.eq.${filtres.compteId}`
      );
    }
    if (filtres?.categorieId) query = query.eq("categorie_id", filtres.categorieId);
    if (filtres?.date) query = query.eq("date_operation", filtres.date);
    if (filtres?.mois) {
      query = query.gte("date_operation", filtres.mois).lt("date_operation", finDuMois(filtres.mois));
    }
    // `ilike` sur une colonne nulle ne matche jamais (NULL en SQL) : une
    // transaction sans libellé est donc naturellement exclue d'une recherche
    // non vide, sans traitement particulier.
    if (filtres?.recherche?.trim()) {
      query = query.ilike("libelle", motifContient(filtres.recherche.trim()));
    }
    return query;
  }

  // `mois` et `date` bornent déjà le nombre de lignes possibles ; sans l'un
  // des deux, l'historique complet peut dépasser le plafond de 1000 lignes
  // de PostgREST et serait alors tronqué silencieusement (transactions les
  // plus anciennes manquantes sans erreur).
  if (filtres?.mois || filtres?.date) {
    const { data, error } = await buildQuery();
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return fetchAllRows<TransactionAvecRelations>((from, to) => buildQuery().range(from, to));
}

export type ResumeMois = { totalDepenses: number; totalRevenus: number };

/** @param periode Format "YYYY-MM-01" (premier jour du mois). */
export async function getResumeMois(periode: string): Promise<ResumeMois> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("montant, type")
    .gte("date_operation", periode)
    .lt("date_operation", finDuMois(periode));

  if (error) throw new Error(error.message);

  const totalDepenses = (data ?? [])
    .filter((t) => t.type === "depense")
    .reduce((acc, t) => acc + t.montant, 0);
  const totalRevenus = (data ?? [])
    .filter((t) => t.type === "revenu")
    .reduce((acc, t) => acc + t.montant, 0);

  return { totalDepenses, totalRevenus };
}

export type TotauxParJour = Record<string, { depenses: number; revenus: number }>;

/**
 * Totaux dépenses/revenus par jour sur un mois, pour la vue calendrier — une
 * seule requête sur le mois entier, agrégée en JS (pas une requête par
 * jour). Les virements n'apparaissent pas dans ces totaux, cohérent avec
 * `getResumeMois`.
 *
 * @param periode Format "YYYY-MM-01" (premier jour du mois).
 */
export async function getTransactionsParJour(periode: string): Promise<TotauxParJour> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("date_operation, montant, type")
    .in("type", ["depense", "revenu"])
    .gte("date_operation", periode)
    .lt("date_operation", finDuMois(periode));

  if (error) throw new Error(error.message);

  const totaux: TotauxParJour = {};
  for (const t of data ?? []) {
    const jour = (totaux[t.date_operation] ??= { depenses: 0, revenus: 0 });
    if (t.type === "depense") jour.depenses += t.montant;
    else jour.revenus += t.montant;
  }
  return totaux;
}

export type ResumeMoisPlage = ResumeMois & { periode: string };

/**
 * Résumé dépenses/revenus pour chacun des `nbMois` mois se terminant (mois
 * inclus) à `periodeFin` — une seule requête large sur toute la plage,
 * agrégée en JS par mois (pas de N+1 requête par mois), pour le graphique de
 * tendance de /budget/statistiques.
 *
 * @param periodeFin Format "YYYY-MM-01" (dernier mois de la plage, inclus).
 */
export async function getResumeMoisPlage(
  periodeFin: string,
  nbMois: number
): Promise<ResumeMoisPlage[]> {
  const supabase = createAdminClient();

  const [anneeFin, moisFin] = periodeFin.split("-").map(Number);
  const debutPlageDate = new Date(anneeFin, moisFin - 1 - (nbMois - 1), 1);
  const debutPlage = `${debutPlageDate.getFullYear()}-${String(debutPlageDate.getMonth() + 1).padStart(2, "0")}-01`;
  const finPlage = finDuMois(periodeFin);

  const { data, error } = await supabase
    .from("transactions")
    .select("date_operation, montant, type")
    .in("type", ["depense", "revenu"])
    .gte("date_operation", debutPlage)
    .lt("date_operation", finPlage);

  if (error) throw new Error(error.message);

  const parMois = new Map<string, ResumeMoisPlage>();
  for (let i = 0; i < nbMois; i++) {
    const d = new Date(debutPlageDate.getFullYear(), debutPlageDate.getMonth() + i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    parMois.set(cle, { periode: cle, totalDepenses: 0, totalRevenus: 0 });
  }

  for (const t of data ?? []) {
    const cle = `${t.date_operation.slice(0, 7)}-01`;
    const bucket = parMois.get(cle);
    if (!bucket) continue;
    if (t.type === "depense") bucket.totalDepenses += t.montant;
    else bucket.totalRevenus += t.montant;
  }

  return Array.from(parMois.values());
}
