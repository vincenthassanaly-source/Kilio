"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiISO } from "@/lib/budget/compute";
import { MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import {
  genererProgrammeParGemini,
  type HabitudeSnapshot,
  type NoteSnapshot,
  type ProgrammeGenere,
  type TacheSnapshot,
} from "@/lib/programme/generation";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { dateDuJourParis, heureParis } from "@/lib/date/paris";
import {
  dureeTotale,
  occupationsDuJour,
  plafondPropositions,
  plagesLibres,
} from "@/lib/programme/disponibilites";
import { getTachesAvecRelations } from "./taches";
import { getNotesAvecRelations } from "./notes";
import { getHabitudesDuJour } from "./habitudes";
import { getPlanningTravail, getPlanningTravailExceptions } from "./planning-travail";

// Nombre maximum d'éléments envoyés à Gemini par catégorie : un instantané
// pertinent (tâches dues/en retard, notes récentes) plutôt que l'historique
// complet, pour rester rapide et éviter le bruit des vieilles notes sans
// rapport avec aujourd'hui.
const MAX_TACHES = 15;
const MAX_NOTES = 10;
const EXTRAIT_NOTE_LONGUEUR = 140;

// Les horaires de travail enrichissent le programme sans le conditionner :
// s'ils ne se lisent pas, on génère quand même (comme un jour sans créneau).
async function avecRepliVide<T>(lecture: Promise<T[]>, message: string): Promise<T[]> {
  try {
    return await lecture;
  } catch (err) {
    console.warn(`[programme] ${message}, génération sans cette information.`, err);
    return [];
  }
}

const MESSAGE_ECHEC = "La génération du programme a échoué. Réessaie.";

export async function genererProgrammeDuJour(): Promise<ActionResult<ProgrammeGenere>> {
  // Toute exception inattendue (lecture en base, bug) est rattrapée ici : une
  // exception levée par une Server Function arrive masquée en production, et
  // le client n'afficherait qu'un message générique sans cause.
  try {
    return await programmeDuJour();
  } catch (err) {
    console.error("[programme] Exception inattendue pendant la génération.", err);
    const message = err instanceof Error ? err.message : "erreur inconnue";
    return fail(`${MESSAGE_ECHEC} (Erreur serveur : ${message.slice(0, 150)})`);
  }
}

async function programmeDuJour(): Promise<ActionResult<ProgrammeGenere>> {
  const today = aujourdhuiISO();

  const [taches, notes, habitudes, creneaux, exceptions] = await Promise.all([
    getTachesAvecRelations(),
    getNotesAvecRelations(),
    getHabitudesDuJour(today),
    avecRepliVide(getPlanningTravail(), "Horaires de travail illisibles"),
    avecRepliVide(getPlanningTravailExceptions(), "Exceptions d'horaires illisibles"),
  ]);

  const tachesPertinentes: TacheSnapshot[] = taches
    .filter((t) => !t.fait && t.echeance !== null && t.echeance <= today)
    .sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""))
    .slice(0, MAX_TACHES)
    .map((t) => {
      const enRetard = (t.echeance ?? today) < today;
      // L'heure d'une tâche en retard date d'un autre jour : elle n'occupe pas
      // aujourd'hui et ne doit pas laisser croire à un rendez-vous.
      return {
        titre: t.titre,
        heure: enRetard || t.toute_la_journee ? null : (t.heure?.slice(0, 5) ?? null),
        heureFin: enRetard || t.toute_la_journee ? null : (t.heure_fin?.slice(0, 5) ?? null),
        priorite: t.priorite,
        enRetard,
      };
    });

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

  // La journée réelle : horaires de travail d'aujourd'hui, tâches datées qui
  // ont une heure (rendez-vous), puis plages libres à partir de maintenant.
  const creneauxTravail = getCreneauxDuJour(creneaux, dateDuJourParis(), exceptions).map((c) => ({
    debut: c.heure_debut.slice(0, 5),
    fin: c.heure_fin.slice(0, 5),
  }));
  const tachesDuJourAvecHeure = taches.flatMap((t) =>
    !t.fait && t.echeance === today && t.heure && !t.toute_la_journee
      ? [{ heure: t.heure, heure_fin: t.heure_fin }]
      : []
  );
  const maintenant = heureParis();
  const libres = plagesLibres({
    maintenant,
    occupations: occupationsDuJour({ creneauxTravail, taches: tachesDuJourAvecHeure }),
  });

  // Aucune plage libre (journée pleine ou finie) : inutile d'interroger Gemini
  // pour lui faire placer des suggestions nulle part.
  if (libres.length === 0) {
    return ok({
      intro: "Il ne reste plus de plage libre aujourd'hui : la journée est pleine ou terminée.",
      propositions: [],
    });
  }

  const resultat = await genererProgrammeParGemini({
    taches: tachesPertinentes,
    notes: notesRecentes,
    habitudes: habitudesAFaire,
    contexte: {
      maintenant,
      creneauxTravail,
      plagesLibres: libres,
      plafond: plafondPropositions(dureeTotale(libres)),
    },
  });

  if (!resultat.ok) {
    // La cause exacte (statut HTTP et message de Google, délai dépassé…) suit
    // le message : sans elle, tous les échecs se ressemblent à l'écran.
    return fail(
      resultat.code === "quota"
        ? MESSAGE_QUOTA_GEMINI
        : `${MESSAGE_ECHEC} (${resultat.detail})`
    );
  }
  return ok(resultat.programme);
}
