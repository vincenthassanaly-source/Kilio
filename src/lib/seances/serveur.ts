// Accès base des séances, partagé par les Server Actions (src/app/actions/seances.ts)
// et la route appelée depuis la notification push (api/seances/[id]/decaler).
// Module neutre (ni "use server" ni "use client") : il reçoit le client admin
// en paramètre, ce qui le rend testable avec le faux Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { aujourdhuiParis } from "@/lib/date/paris";
import { shiftDate } from "@/lib/date/iso";
import {
  planReports,
  prochainJourLibre,
  seancesAMaterialiser,
  semaineDe,
  trierSeances,
  type Creneau,
  type Seance,
} from "./compute";

type Client = SupabaseClient<Database>;
type LigneSeance = Database["public"]["Tables"]["seances"]["Row"];

export type SemaineSeances = { creneaux: Creneau[]; seances: Seance[] };

const COLONNES_SEANCE = "id, creneau_id, date_prevue, date, heure, type, statut, reportee";

function enSeance(l: LigneSeance): Seance {
  return {
    id: l.id,
    creneau_id: l.creneau_id,
    date_prevue: l.date_prevue,
    date: l.date,
    heure: l.heure,
    type: l.type,
    statut: l.statut === "faite" ? "faite" : "prevue",
    reportee: l.reportee,
  };
}

async function lireSeancesDeLaSemaine(supabase: Client, debut: string, fin: string): Promise<Seance[]> {
  const { data, error } = await supabase
    .from("seances")
    .select(COLONNES_SEANCE)
    .gte("date_prevue", debut)
    .lte("date_prevue", fin);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LigneSeance[]).map(enSeance);
}

/**
 * Créneaux et séances de la semaine en cours. Idempotent : crée à la volée les
 * occurrences manquantes puis replace (une fois) les séances manquées sur un
 * jour libre de la semaine — l'ouverture de l'app suffit, pas de cron dédié.
 */
export async function lireSemaine(supabase: Client, today: string, maintenant: string): Promise<SemaineSeances> {
  const { debut, fin } = semaineDe(today);
  const { data: lignesCreneaux, error: erreurCreneaux } = await supabase
    .from("creneaux_seance")
    .select("id, jour_semaine, heure, type, actif")
    .order("jour_semaine")
    .order("heure");
  if (erreurCreneaux) throw new Error(erreurCreneaux.message);
  const creneaux = lignesCreneaux ?? [];

  let seances = await lireSeancesDeLaSemaine(supabase, debut, fin);

  const nouvelles = seancesAMaterialiser(creneaux, seances, today);
  if (nouvelles.length > 0) {
    const { error } = await supabase
      .from("seances")
      .upsert(nouvelles, { onConflict: "creneau_id,date_prevue", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    seances = await lireSeancesDeLaSemaine(supabase, debut, fin);
  }

  const reports = planReports(seances, today, maintenant, fin);
  if (reports.length > 0) {
    for (const report of reports) {
      const { error } = await supabase
        .from("seances")
        .update({ date: report.date, reportee: true, rappel_envoye_le: null })
        .eq("id", report.id);
      if (error) throw new Error(error.message);
    }
    seances = await lireSeancesDeLaSemaine(supabase, debut, fin);
  }

  return { creneaux, seances: trierSeances(seances) };
}

export type ResultatDecalage = { error: string | null; date?: string };

/** Décale une séance au prochain jour libre de sa semaine (bouton « Décaler »). */
export async function decalerSeance(
  supabase: Client,
  id: string,
  today: string = aujourdhuiParis()
): Promise<ResultatDecalage> {
  const { data: ligne, error } = await supabase.from("seances").select(COLONNES_SEANCE).eq("id", id).maybeSingle();
  if (error) return { error: "Impossible de décaler la séance. Réessaie." };
  if (!ligne) return { error: "Séance introuvable." };
  const seance = enSeance(ligne as LigneSeance);
  if (seance.statut === "faite") return { error: "Cette séance est déjà faite." };

  const { debut, fin } = semaineDe(seance.date);
  const semaine = await lireSeancesDeLaSemaine(supabase, debut, fin);
  // Une séance manquée (date passée) repart d'aujourd'hui : jamais dans le passé.
  const depart = seance.date < today ? shiftDate(today, -1) : seance.date;
  const jour = prochainJourLibre(semaine, depart, fin);
  if (!jour) return { error: "Aucun jour libre d'ici dimanche." };

  const { error: erreurMaj } = await supabase
    .from("seances")
    .update({ date: jour, reportee: true, rappel_envoye_le: null })
    .eq("id", id);
  if (erreurMaj) return { error: "Impossible de décaler la séance. Réessaie." };
  return { error: null, date: jour };
}
