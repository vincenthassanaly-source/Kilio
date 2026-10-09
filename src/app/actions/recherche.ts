"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { guillemetsPostgrest, motifContient } from "@/lib/supabase/like";

export type ModuleRecherche = "notes" | "taches" | "evenements" | "recettes" | "objectifs" | "courses";

export type ResultatRecherche = {
  id: string;
  module: ModuleRecherche;
  titre: string;
  sousTitre?: string;
  href: string;
};

const LIMIT_PAR_SOURCE = 5;

function commenceParQuery(champ: string, query: string) {
  return champ.toLowerCase().startsWith(query.toLowerCase());
}

export async function rechercheGlobale(query: string): Promise<ResultatRecherche[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = createAdminClient();
  const like = motifContient(q);
  const likeOr = guillemetsPostgrest(like);

  const [
    notesResult,
    tachesResult,
    recettesResult,
    objectifsResult,
    coursesResult,
    evenementsResult,
    noteItemsResult,
  ] = await Promise.allSettled([
      supabase
        .from("notes")
        .select("id, titre, contenu")
        .or(`titre.ilike.${likeOr},contenu.ilike.${likeOr}`)
        .limit(LIMIT_PAR_SOURCE),
      supabase
        .from("taches")
        .select("id, titre, echeance, liste:listes_taches(nom)")
        .ilike("titre", like)
        .limit(LIMIT_PAR_SOURCE),
      supabase
        .from("recettes")
        .select("id, nom")
        .ilike("nom", like)
        .limit(LIMIT_PAR_SOURCE),
      supabase
        .from("objectifs")
        .select("id, titre")
        .ilike("titre", like)
        .limit(LIMIT_PAR_SOURCE),
      supabase
        .from("courses_items")
        .select("id, libelle")
        .ilike("libelle", like)
        .limit(LIMIT_PAR_SOURCE),
      supabase
        .from("evenements")
        .select("id, titre, date, heure")
        .or(`titre.ilike.${likeOr},notes.ilike.${likeOr}`)
        .order("date", { ascending: false })
        .limit(LIMIT_PAR_SOURCE),
      supabase
        .from("note_items")
        .select("note_id, libelle, note:notes(titre)")
        .ilike("libelle", like)
        .limit(LIMIT_PAR_SOURCE),
    ]);

  const resultats: ResultatRecherche[] = [];

  if (notesResult.status === "fulfilled" && notesResult.value.data) {
    for (const note of notesResult.value.data) {
      resultats.push({
        id: note.id,
        module: "notes",
        titre: note.titre,
        sousTitre: note.contenu || undefined,
        href: "/notes",
      });
    }
  }

  if (tachesResult.status === "fulfilled" && tachesResult.value.data) {
    for (const tache of tachesResult.value.data) {
      resultats.push({
        id: tache.id,
        module: "taches",
        titre: tache.titre,
        sousTitre: tache.liste?.nom,
        // Une tâche datée s'ouvre dans l'agenda (deep-link ?tache=).
        href: tache.echeance ? `/agenda?tache=${tache.id}` : "/taches",
      });
    }
  }

  if (evenementsResult.status === "fulfilled" && evenementsResult.value.data) {
    for (const evenement of evenementsResult.value.data) {
      resultats.push({
        id: evenement.id,
        module: "evenements",
        titre: evenement.titre,
        sousTitre: `${evenement.date} ${evenement.heure.slice(0, 5)}`,
        href: `/agenda?date=${evenement.date}`,
      });
    }
  }

  // Éléments de checklist : un résultat par note déjà trouvée par titre/contenu
  // est inutile, on l'ajoute seulement si la note n'est pas déjà dans la liste.
  if (noteItemsResult.status === "fulfilled" && noteItemsResult.value.data) {
    const dejaVues = new Set(resultats.filter((r) => r.module === "notes").map((r) => r.id));
    for (const item of noteItemsResult.value.data) {
      if (dejaVues.has(item.note_id)) continue;
      dejaVues.add(item.note_id);
      resultats.push({
        id: item.note_id,
        module: "notes",
        titre: item.note?.titre || "Note",
        sousTitre: item.libelle,
        href: "/notes",
      });
    }
  }

  if (recettesResult.status === "fulfilled" && recettesResult.value.data) {
    for (const recette of recettesResult.value.data) {
      resultats.push({
        id: recette.id,
        module: "recettes",
        titre: recette.nom,
        href: `/nutrition/recettes/${recette.id}`,
      });
    }
  }

  if (objectifsResult.status === "fulfilled" && objectifsResult.value.data) {
    for (const objectif of objectifsResult.value.data) {
      resultats.push({
        id: objectif.id,
        module: "objectifs",
        titre: objectif.titre,
        href: `/objectifs/${objectif.id}`,
      });
    }
  }

  if (coursesResult.status === "fulfilled" && coursesResult.value.data) {
    for (const item of coursesResult.value.data) {
      resultats.push({
        id: item.id,
        module: "courses",
        titre: item.libelle,
        href: "/courses",
      });
    }
  }

  return resultats.sort((a, b) => {
    const aStart = commenceParQuery(a.titre, q);
    const bStart = commenceParQuery(b.titre, q);
    if (aStart === bStart) return 0;
    return aStart ? -1 : 1;
  });
}
