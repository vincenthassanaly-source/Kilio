import type { NoteAvecRelations } from "@/app/actions/notes";
import type { TacheAvecRelations } from "@/app/actions/taches";

export function makeNote(overrides: Partial<NoteAvecRelations> = {}): NoteAvecRelations {
  return {
    id: "note-1",
    titre: "Ma note",
    contenu: "",
    type: "checklist",
    couleur: null,
    epingle: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    items: [],
    tags: [],
    ...overrides,
  };
}

export function makeTache(overrides: Partial<TacheAvecRelations> = {}): TacheAvecRelations {
  return {
    id: "tache-1",
    titre: "Ma tâche",
    fait: false,
    ordre: 0,
    liste_id: "liste-1",
    priorite: "aucune",
    programme_jour: false,
    recurrence_frequence: null,
    recurrence_fin: null,
    rappel_envoye_le: null,
    rappel_minutes: null,
    rappel_reporte_jusqua: null,
    termine_le: null,
    toute_la_journee: false,
    echeance: null,
    heure: null,
    heure_fin: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    liste: null,
    sous_taches: [],
    tags: [],
    images: [],
    ...overrides,
  };
}
