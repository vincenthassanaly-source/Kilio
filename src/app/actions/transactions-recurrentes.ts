"use server";

import { revalidatePath, updateTag } from "next/cache";
import { BUDGET_TAG } from "@/lib/budget/tags";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiISO, calculerProchaineOccurrence } from "@/lib/budget/compute";
import type { Enums, Tables, TablesInsert } from "@/lib/supabase/types";

export type RecurrenceFormState = { error: string | null };

const FREQUENCES: readonly Enums<"frequence_recurrence">[] = [
  "quotidien",
  "hebdomadaire",
  "mensuel",
  "annuel",
];

function revalidateRecurrencePaths() {
  revalidatePath("/budget");
  revalidatePath("/budget/transactions");
  revalidatePath("/budget/recurrentes");
  updateTag(BUDGET_TAG);
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

type RecurrenceInput = {
  compte_id: string;
  categorie_id: string;
  montant: number;
  frequence: Enums<"frequence_recurrence">;
  date_debut: string;
  date_fin: string | null;
  libelle: string | null;
};

type ParseResult = { ok: true; value: RecurrenceInput } | { ok: false; error: string };

function parseRecurrenceInput(formData: FormData): ParseResult {
  const compte_id = String(formData.get("compte_id") ?? "").trim();
  const categorie_id = String(formData.get("categorie_id") ?? "").trim();
  const montantRaw = String(formData.get("montant") ?? "").trim();
  const frequence = String(formData.get("frequence") ?? "");
  const date_debut = String(formData.get("date_debut") ?? "").trim();
  const date_finRaw = String(formData.get("date_fin") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim();

  if (!compte_id) return { ok: false, error: "Le compte est requis." };
  if (!categorie_id) return { ok: false, error: "La catégorie est requise." };
  if (!FREQUENCES.includes(frequence as Enums<"frequence_recurrence">)) {
    return { ok: false, error: "Fréquence invalide." };
  }
  if (!date_debut) return { ok: false, error: "La date de début est requise." };

  const montant = Number(montantRaw);
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, error: "Le montant doit être un nombre positif." };
  }

  const date_fin = date_finRaw || null;
  if (date_fin && date_fin < date_debut) {
    return { ok: false, error: "La date de fin doit être postérieure à la date de début." };
  }

  return {
    ok: true,
    value: {
      compte_id,
      categorie_id,
      montant,
      frequence: frequence as Enums<"frequence_recurrence">,
      date_debut,
      date_fin,
      libelle: libelle || null,
    },
  };
}

export async function creerRecurrence(
  _prevState: RecurrenceFormState,
  formData: FormData
): Promise<RecurrenceFormState> {
  const parsed = parseRecurrenceInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const type = await getTypeCategorie(supabase, parsed.value.categorie_id);
  if (!type) return { error: "Catégorie introuvable." };

  const { error } = await supabase.from("transactions_recurrentes").insert({
    ...parsed.value,
    type,
    prochaine_occurrence: parsed.value.date_debut,
  });
  if (error) return { error: error.message };

  revalidateRecurrencePaths();
  return { error: null };
}

// date_debut (et donc prochaine_occurrence, son point de départ) n'est
// jamais modifiable après création : c'est un curseur interne de
// génération, pas un champ utilisateur — l'éditer après coup rejouerait ou
// sauterait des occurrences déjà générées. Pour corriger une date de début
// erronée avant toute génération, il faut supprimer et recréer le modèle.
export async function modifierRecurrence(
  _prevState: RecurrenceFormState,
  formData: FormData
): Promise<RecurrenceFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Récurrence introuvable." };

  const parsed = parseRecurrenceInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const type = await getTypeCategorie(supabase, parsed.value.categorie_id);
  if (!type) return { error: "Catégorie introuvable." };

  const { compte_id, categorie_id, montant, frequence, date_fin, libelle } = parsed.value;
  const { error } = await supabase
    .from("transactions_recurrentes")
    .update({ compte_id, categorie_id, montant, frequence, date_fin, libelle, type })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateRecurrencePaths();
  return { error: null };
}

type RecurrenceVirementInput = {
  compte_id: string;
  compte_destination_id: string;
  montant: number;
  frequence: Enums<"frequence_recurrence">;
  date_debut: string;
  date_fin: string | null;
  libelle: string | null;
};

type ParseVirementResult =
  | { ok: true; value: RecurrenceVirementInput }
  | { ok: false; error: string };

function parseRecurrenceVirementInput(formData: FormData): ParseVirementResult {
  const compte_id = String(formData.get("compte_id") ?? "").trim();
  const compte_destination_id = String(formData.get("compte_destination_id") ?? "").trim();
  const montantRaw = String(formData.get("montant") ?? "").trim();
  const frequence = String(formData.get("frequence") ?? "");
  const date_debut = String(formData.get("date_debut") ?? "").trim();
  const date_finRaw = String(formData.get("date_fin") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim();

  if (!compte_id) return { ok: false, error: "Le compte source est requis." };
  if (!compte_destination_id) return { ok: false, error: "Le compte destination est requis." };
  if (compte_id === compte_destination_id) {
    return { ok: false, error: "Les comptes source et destination doivent être différents." };
  }
  if (!FREQUENCES.includes(frequence as Enums<"frequence_recurrence">)) {
    return { ok: false, error: "Fréquence invalide." };
  }
  if (!date_debut) return { ok: false, error: "La date de début est requise." };

  const montant = Number(montantRaw);
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, error: "Le montant doit être un nombre positif." };
  }

  const date_fin = date_finRaw || null;
  if (date_fin && date_fin < date_debut) {
    return { ok: false, error: "La date de fin doit être postérieure à la date de début." };
  }

  return {
    ok: true,
    value: {
      compte_id,
      compte_destination_id,
      montant,
      frequence: frequence as Enums<"frequence_recurrence">,
      date_debut,
      date_fin,
      libelle: libelle || null,
    },
  };
}

export async function creerRecurrenceVirement(
  _prevState: RecurrenceFormState,
  formData: FormData
): Promise<RecurrenceFormState> {
  const parsed = parseRecurrenceVirementInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("transactions_recurrentes").insert({
    ...parsed.value,
    type: "virement",
    categorie_id: null,
    prochaine_occurrence: parsed.value.date_debut,
  });
  if (error) return { error: error.message };

  revalidateRecurrencePaths();
  return { error: null };
}

export async function modifierRecurrenceVirement(
  _prevState: RecurrenceFormState,
  formData: FormData
): Promise<RecurrenceFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Récurrence introuvable." };

  const parsed = parseRecurrenceVirementInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();
  const { compte_id, compte_destination_id, montant, frequence, date_fin, libelle } = parsed.value;
  const { error } = await supabase
    .from("transactions_recurrentes")
    .update({
      compte_id,
      compte_destination_id,
      montant,
      frequence,
      date_fin,
      libelle,
      type: "virement",
      categorie_id: null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateRecurrencePaths();
  return { error: null };
}

export async function supprimerRecurrence(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  // on delete set null sur transactions.transaction_recurrente_id : les
  // transactions déjà générées ne sont pas supprimées, juste détachées.
  const { error } = await supabase.from("transactions_recurrentes").delete().eq("id", id);
  if (error) return fail("La récurrence n'a pas pu être supprimée. Réessaie.");

  revalidateRecurrencePaths();
  return ok();
}

export async function basculerActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transactions_recurrentes")
    .update({ active })
    .eq("id", id);
  if (error) return fail("La récurrence n'a pas pu être mise à jour. Réessaie.");

  revalidateRecurrencePaths();
  return ok();
}

export type RecurrenceAvecRelations = Tables<"transactions_recurrentes"> & {
  compte: Pick<Tables<"comptes">, "id" | "nom"> | null;
  compte_destination: Pick<Tables<"comptes">, "id" | "nom"> | null;
  categorie: Pick<Tables<"categories_budget">, "id" | "nom" | "icone"> | null;
};

export async function getRecurrences(): Promise<RecurrenceAvecRelations[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactions_recurrentes")
    .select(
      "*, compte:comptes!transactions_recurrentes_compte_id_fkey(id, nom), compte_destination:comptes!transactions_recurrentes_compte_destination_id_fkey(id, nom), categorie:categories_budget(id, nom, icone)"
    )
    .order("prochaine_occurrence", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Génération paresseuse : pas de cron dans ce repo, donc appelée en tout
 * début des Server Components /budget et /budget/transactions, avant les
 * autres lectures (getResumeMois, getTransactions, getComptesAvecSolde...)
 * pour que les occurrences dues apparaissent immédiatement dans les
 * totaux/l'historique du chargement en cours.
 *
 * Rattrape toutes les occurrences en retard, pas seulement la dernière : si
 * l'app n'a pas été ouverte depuis 3 mois sur une récurrence mensuelle, les
 * 3 transactions manquantes sont générées en une fois, et
 * `prochaine_occurrence` avance à chaque insertion jusqu'à dépasser
 * aujourd'hui.
 */
export async function genererOccurrencesDues(): Promise<boolean> {
  const supabase = createAdminClient();
  const aujourdhui = aujourdhuiISO();

  const { data: recurrences, error } = await supabase
    .from("transactions_recurrentes")
    .select("*")
    .eq("active", true)
    .lte("prochaine_occurrence", aujourdhui);

  if (error) throw new Error(error.message);
  if (!recurrences || recurrences.length === 0) return false;

  // Modèles indépendants les uns des autres : un insert/update par modèle,
  // lancés en parallèle (Promise.all) plutôt qu'attendus séquentiellement
  // dans une boucle `for` — cette génération s'exécute avant les autres
  // lectures du Server Component /budget (voir commentaire ci-dessus).
  const resultats = await Promise.all(
    recurrences.map(async (modele) => {
      let prochaine = modele.prochaine_occurrence;
      const occurrences: TablesInsert<"transactions">[] = [];

      while (prochaine <= aujourdhui && (modele.date_fin === null || prochaine <= modele.date_fin)) {
        occurrences.push({
          compte_id: modele.compte_id,
          categorie_id: modele.categorie_id,
          compte_destination_id: modele.compte_destination_id,
          montant: modele.montant,
          type: modele.type,
          date_operation: prochaine,
          libelle: modele.libelle,
          transaction_recurrente_id: modele.id,
        });
        prochaine = calculerProchaineOccurrence(prochaine, modele.frequence);
      }

      let insertError = null;
      if (occurrences.length > 0) {
        // `upsert` + `ignoreDuplicates` plutôt qu'`insert` : deux rendus
        // concurrents de /budget ou /budget/transactions peuvent lancer cette
        // génération en même temps ; l'index unique partiel sur
        // (transaction_recurrente_id, date_operation) — voir
        // scripts/migration-budget-recurrences-unique-2026-09-26.sql — évite
        // alors une occurrence dupliquée plutôt que de la laisser échouer en
        // erreur ou s'insérer deux fois.
        ({ error: insertError } = await supabase.from("transactions").upsert(occurrences, {
          onConflict: "transaction_recurrente_id,date_operation",
          ignoreDuplicates: true,
        }));
      }

      // date_fin dépassée après cette génération : le modèle se suspend tout
      // seul, même si aucune occurrence n'a été générée à ce passage (cf.
      // rapport — évite le bug où un modèle dont la date_fin a été
      // raccourcie sous prochaine_occurrence ne serait jamais désactivé).
      const desactiver = modele.date_fin !== null && prochaine > modele.date_fin;
      let updateError = null;
      if (prochaine !== modele.prochaine_occurrence || desactiver) {
        ({ error: updateError } = await supabase
          .from("transactions_recurrentes")
          .update({ prochaine_occurrence: prochaine, active: !desactiver })
          .eq("id", modele.id));
      }

      return { insertError, updateError };
    })
  );

  for (const { insertError, updateError } of resultats) {
    if (insertError) throw new Error(insertError.message);
    if (updateError) throw new Error(updateError.message);
  }
  return true;
}
