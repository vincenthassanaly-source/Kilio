"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiISO } from "@/lib/budget/compute";
import {
  genererProgrammeParGemini,
  type HabitudeSnapshot,
  type NoteSnapshot,
  type ProgrammeGenere,
  type TacheSnapshot,
} from "@/lib/programme/generation";
import { getTachesAvecRelations } from "./taches";
import { getNotesAvecRelations } from "./notes";
import { getHabitudesDuJour } from "./habitudes";

// Nombre maximum d'éléments envoyés à Gemini par catégorie : un instantané
// pertinent (tâches dues/en retard, notes récentes) plutôt que l'historique
// complet, pour rester rapide et éviter le bruit des vieilles notes sans
// rapport avec aujourd'hui.
const MAX_TACHES = 15;
const MAX_NOTES = 10;
const EXTRAIT_NOTE_LONGUEUR = 140;

export async function genererProgrammeDuJour(): Promise<ActionResult<ProgrammeGenere>> {
  const today = aujourdhuiISO();

  const [taches, notes, habitudes] = await Promise.all([
    getTachesAvecRelations(),
    getNotesAvecRelations(),
    getHabitudesDuJour(today),
  ]);

  const tachesPertinentes: TacheSnapshot[] = taches
    .filter((t) => !t.fait && t.echeance !== null && t.echeance <= today)
    .sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""))
    .slice(0, MAX_TACHES)
    .map((t) => ({
      titre: t.titre,
      heure: t.heure,
      priorite: t.priorite,
      enRetard: (t.echeance ?? today) < today,
    }));

  const notesRecentes: NoteSnapshot[] = notes.slice(0, MAX_NOTES).map((n) => ({
    titre: n.titre,
    extrait: n.contenu.slice(0, EXTRAIT_NOTE_LONGUEUR),
  }));

  const habitudesAFaire: HabitudeSnapshot[] = habitudes
    .filter((h) => h.entreeDuJour === null)
    .map((h) => ({ nom: h.nom, faite: false }));

  // Rien à analyser : pas la peine d'appeler Gemini pour se le faire dire.
  if (tachesPertinentes.length === 0 && notesRecentes.length === 0 && habitudesAFaire.length === 0) {
    return ok({ intro: "Rien de particulier n'attend aujourd'hui — profite du calme.", propositions: [] });
  }

  const resultat = await genererProgrammeParGemini({
    taches: tachesPertinentes,
    notes: notesRecentes,
    habitudes: habitudesAFaire,
  });

  if (!resultat) return fail("La génération du programme a échoué. Réessaie.");
  return ok(resultat);
}
