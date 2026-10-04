"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliserJours, type JourType } from "@/lib/nutrition/planning";

export type ObjectifFormState = { error: string | null };

const JOUR_TYPES: readonly JourType[] = ["repos", "entrainement"];

type CibleSaisie = {
  kcal_cible: number;
  proteines_cible_g: number;
  glucides_cible_g: number;
  lipides_cible_g: number;
};

// Lit les quatre champs d'un type de jour (`repos_kcal_cible`, …). `null` :
// type laissé vide (kcal non renseignée) ; sinon la cible, ou une erreur.
function lireCible(formData: FormData, jourType: JourType): CibleSaisie | null | { error: string } {
  const brut = String(formData.get(`${jourType}_kcal_cible`) ?? "").trim();
  if (brut === "") return null;

  const cible: CibleSaisie = {
    kcal_cible: Number(brut),
    proteines_cible_g: Number(formData.get(`${jourType}_proteines_cible_g`) ?? 0),
    glucides_cible_g: Number(formData.get(`${jourType}_glucides_cible_g`) ?? 0),
    lipides_cible_g: Number(formData.get(`${jourType}_lipides_cible_g`) ?? 0),
  };
  const valeurs = Object.values(cible);
  if (valeurs.some((n) => !Number.isFinite(n) || n < 0)) {
    return { error: "Les objectifs doivent être des nombres positifs." };
  }
  // Bornes hautes permissives mais réelles : sans elles, un objectif kcal
  // aberrant (ex. faute de frappe à un zéro près) fait toujours lire
  // l'anneau de ResumeJour.tsx comme "dans les clous" (son pourcentage est
  // clampé à 100 %), masquant un vrai dépassement plutôt que de le signaler.
  if (cible.kcal_cible > 10000) {
    return { error: "L'objectif calorique doit rester sous 10 000 kcal." };
  }
  if ([cible.proteines_cible_g, cible.glucides_cible_g, cible.lipides_cible_g].some((n) => n > 1000)) {
    return { error: "Les objectifs de macros doivent rester sous 1000 g." };
  }
  return cible;
}

/**
 * Enregistre en une fois les cibles de repos et d'entraînement et le
 * planning hebdomadaire (jours d'entraînement). Une cible est requise pour
 * chaque type réellement utilisé par le planning : repos tant qu'un jour de
 * la semaine n'est pas d'entraînement, entraînement dès qu'un jour l'est.
 */
export async function upsertObjectif(
  _prevState: ObjectifFormState,
  formData: FormData
): Promise<ObjectifFormState> {
  const jours = normaliserJours(formData.getAll("jours_entrainement"));

  const cibles: Partial<Record<JourType, CibleSaisie>> = {};
  for (const jourType of JOUR_TYPES) {
    const cible = lireCible(formData, jourType);
    if (cible && "error" in cible) return { error: cible.error };
    if (cible) cibles[jourType] = cible;
  }

  if (!cibles.repos && jours.length < 7) {
    return { error: "Renseigne l'objectif de repos (kcal)." };
  }
  if (!cibles.entrainement && jours.length > 0) {
    return { error: "Renseigne l'objectif d'entraînement (kcal) : des jours d'entraînement sont cochés." };
  }

  const supabase = createAdminClient();

  const lignes = JOUR_TYPES.flatMap((jourType) => {
    const cible = cibles[jourType];
    return cible ? [{ jour_type: jourType, ...cible }] : [];
  });
  if (lignes.length > 0) {
    const { error } = await supabase.from("objectifs_nutritionnels").upsert(lignes, { onConflict: "jour_type" });
    if (error) {
      // Ne jamais remonter le message brut du driver Postgres/Supabase en UI
      // (clarify.md : pas de code interne comme message principal) — loggé
      // côté serveur pour le diagnostic, mais l'utilisateur voit une phrase
      // actionnable.
      console.error("upsertObjectif: échec de l'upsert Supabase", error);
      return { error: "Impossible d'enregistrer l'objectif. Réessaie dans un instant." };
    }
  }

  const { error: erreurPlanning } = await supabase
    .from("nutrition_planning")
    .upsert({ id: 1, jours_entrainement: jours });
  if (erreurPlanning) {
    console.error("upsertObjectif: échec de l'enregistrement du planning", erreurPlanning);
    return { error: "Impossible d'enregistrer le planning. Réessaie dans un instant." };
  }

  revalidatePath("/nutrition/journal");
  revalidatePath("/nutrition/bilan");
  revalidatePath("/");
  return { error: null };
}
