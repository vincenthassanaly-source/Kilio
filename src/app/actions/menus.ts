"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { PLAFOND_ARTICLES_COURSES } from "@/lib/courses/compute";
import { joursDeLaSemaine, libellesCoursesDepuisMenu, repasSemaineSuivante } from "@/lib/menus/compute";
import { shiftDate } from "@/lib/date/iso";
import { lireSaisieRepas } from "@/lib/nutrition/saisie-repas";
import { ajouterArticlesCourses } from "./courses";
import type { JournalFormState } from "./journal";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revaliderMenus() {
  revalidatePath("/nutrition/menus");
}

function revaliderApresValidation() {
  revaliderMenus();
  revalidatePath("/nutrition/journal");
  revalidatePath("/nutrition/bilan");
  revalidatePath("/aujourdhui");
  revalidatePath("/");
}

/** Planifie une recette ou un aliment dans un créneau (même saisie que le Journal). */
export async function addMenuEntry(_prevState: JournalFormState, formData: FormData): Promise<JournalFormState> {
  const lecture = await lireSaisieRepas(formData);
  if ("error" in lecture) return { error: lecture.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("menus_repas").insert(lecture.saisie);
  if (error) return { error: "Le repas n'a pas pu être planifié. Réessaie." };

  revaliderMenus();
  return { error: null, ok: true };
}

/** Retire un repas du menu. Si déjà validé, l'entrée du Journal reste : on ne réécrit pas ce qui a été mangé. */
export async function removeMenuEntry(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return fail("Identifiant de repas invalide.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("menus_repas").delete().eq("id", id);
  if (error) return fail("Le repas n'a pas pu être retiré. Réessaie.");

  revaliderMenus();
  return ok();
}

/**
 * Valide « mangé » : crée l'entrée du Journal correspondante et relie les
 * deux. La bascule `mange false → true` se fait d'abord, en une seule requête
 * conditionnelle : un double tap ne crée jamais deux entrées de Journal.
 */
export async function validerMenuEntry(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return fail("Identifiant de repas invalide.");

  const supabase = createAdminClient();
  const { data: repas, error: erreurBascule } = await supabase
    .from("menus_repas")
    .update({ mange: true })
    .eq("id", id)
    .eq("mange", false)
    .select("date, moment, aliment_id, recette_id, quantite")
    .maybeSingle();

  if (erreurBascule) return fail("Le repas n'a pas pu être validé. Réessaie.");
  if (!repas) return ok(); // déjà validé (ou retiré entre-temps) : rien à faire

  const { data: entree, error: erreurJournal } = await supabase
    .from("journal_repas")
    .insert(repas)
    .select("id")
    .single();

  if (erreurJournal || !entree) {
    await supabase.from("menus_repas").update({ mange: false }).eq("id", id);
    return fail("Le repas n'a pas pu être ajouté au Journal. Réessaie.");
  }

  const { error: erreurLien } = await supabase
    .from("menus_repas")
    .update({ journal_repas_id: entree.id })
    .eq("id", id);
  if (erreurLien) {
    // Sans lien, l'annulation ne retrouverait pas l'entrée : on défait tout.
    await supabase.from("journal_repas").delete().eq("id", entree.id);
    await supabase.from("menus_repas").update({ mange: false }).eq("id", id);
    return fail("Le repas n'a pas pu être validé. Réessaie.");
  }

  revaliderApresValidation();
  return ok();
}

/** Défait la validation : supprime l'entrée du Journal créée et remet le repas « à manger ». */
export async function annulerValidationMenuEntry(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return fail("Identifiant de repas invalide.");

  const supabase = createAdminClient();
  const { data: repas, error: erreurLecture } = await supabase
    .from("menus_repas")
    .select("mange, journal_repas_id")
    .eq("id", id)
    .maybeSingle();
  if (erreurLecture) return fail("La validation n'a pas pu être annulée. Réessaie.");
  if (!repas?.mange) return ok(); // déjà annulé (ou retiré) : rien à faire

  const { error: erreurBascule } = await supabase
    .from("menus_repas")
    .update({ mange: false, journal_repas_id: null })
    .eq("id", id);
  if (erreurBascule) return fail("La validation n'a pas pu être annulée. Réessaie.");

  if (repas.journal_repas_id) {
    const { error: erreurJournal } = await supabase.from("journal_repas").delete().eq("id", repas.journal_repas_id);
    if (erreurJournal) return fail("Le repas est de nouveau à manger, mais son entrée du Journal n'a pas pu être retirée.");
  }

  revaliderApresValidation();
  return ok();
}

export type ResultatEnvoiCourses = { ajoutes: number; dejaPresents: number };

/**
 * Envoie aux Courses les ingrédients des repas pas encore mangés de la
 * semaine commençant à `lundi`. Les quantités identiques sont additionnées
 * (voir libellesCoursesDepuisMenu) et les libellés déjà présents sur la liste
 * ne sont pas dupliqués (ajouterArticlesCourses, clé de doublon commune).
 */
export async function envoyerMenuAuxCourses(lundi: string): Promise<ActionResult<ResultatEnvoiCourses>> {
  if (!DATE_REGEX.test(lundi)) return fail("Semaine invalide.");
  const jours = joursDeLaSemaine(lundi);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("menus_repas")
    .select(
      "quantite, aliment:aliments(nom, unite, poids_unite_g), recette:recettes(portions, recette_ingredients(quantite, unite, aliment:aliments(nom)), recette_ingredients_libres(nom, quantite, ordre))"
    )
    .gte("date", jours[0])
    .lte("date", jours[6])
    .eq("mange", false)
    .order("date")
    .order("created_at");
  if (error) return fail("Le menu n'a pas pu être lu. Réessaie.");

  const libelles = libellesCoursesDepuisMenu(
    (data ?? []).map((ligne) => ({
      quantite: ligne.quantite,
      aliment: ligne.aliment
        ? { nom: ligne.aliment.nom, unite: ligne.aliment.unite, poidsUniteG: ligne.aliment.poids_unite_g }
        : null,
      recette: ligne.recette
        ? {
            portions: ligne.recette.portions,
            ingredients: ligne.recette.recette_ingredients.flatMap((ing) =>
              ing.aliment ? [{ nom: ing.aliment.nom, quantite: ing.quantite, unite: ing.unite }] : []
            ),
            libres: [...ligne.recette.recette_ingredients_libres]
              .sort((a, b) => a.ordre - b.ordre)
              .map((libre) => ({ nom: libre.nom, quantite: libre.quantite })),
          }
        : null,
    }))
  );

  if (libelles.length === 0) return fail("Rien à acheter : aucun repas à venir avec des ingrédients.");

  try {
    let ajoutes = 0;
    let dejaPresents = 0;
    // L'ajout multiple est plafonné : un menu de 7 jours dépasse facilement 30 lignes.
    for (let i = 0; i < libelles.length; i += PLAFOND_ARTICLES_COURSES) {
      const resultat = await ajouterArticlesCourses(libelles.slice(i, i + PLAFOND_ARTICLES_COURSES));
      ajoutes += resultat.crees + resultat.reactives;
      dejaPresents += resultat.dejaPresents.length;
    }
    return ok({ ajoutes, dejaPresents });
  } catch {
    return fail("Les courses n'ont pas pu être mises à jour. Réessaie.");
  }
}

export type ResultatCopieSemaine = { copies: number };

/**
 * Copie les repas de la semaine précédente (`lundi` - 7 jours) sur la semaine
 * commençant à `lundi`, tous « à manger ». Refusée si la semaine cible contient
 * déjà des repas : on ne mélange jamais deux plannings. La vérification n'est
 * pas atomique avec l'insertion ; le double tap est évité côté écran (bouton
 * inactif pendant l'envoi, voir CopierSemaineBouton).
 */
export async function copierSemainePrecedente(lundi: string): Promise<ActionResult<ResultatCopieSemaine>> {
  if (!DATE_REGEX.test(lundi)) return fail("Semaine invalide.");
  const jours = joursDeLaSemaine(lundi);
  const lundiPrecedent = shiftDate(lundi, -7);
  const joursPrecedents = joursDeLaSemaine(lundiPrecedent);

  const supabase = createAdminClient();
  const { count, error: erreurCible } = await supabase
    .from("menus_repas")
    .select("id", { count: "exact", head: true })
    .gte("date", jours[0])
    .lte("date", jours[6]);
  if (erreurCible) return fail("La semaine n'a pas pu être lue. Réessaie.");
  if ((count ?? 0) > 0) return fail("Cette semaine contient déjà des repas.");

  const { data, error: erreurSource } = await supabase
    .from("menus_repas")
    .select("date, moment, aliment_id, recette_id, quantite")
    .gte("date", joursPrecedents[0])
    .lte("date", joursPrecedents[6])
    .order("created_at");
  if (erreurSource) return fail("La semaine précédente n'a pas pu être lue. Réessaie.");
  if (!data || data.length === 0) return fail("La semaine précédente est vide : rien à copier.");

  const { error } = await supabase.from("menus_repas").insert(repasSemaineSuivante(data));
  if (error) return fail("La copie n'a pas pu être enregistrée. Réessaie.");

  revaliderMenus();
  return ok({ copies: data.length });
}
