import { describe, expect, it } from "vitest";
import {
  construirePromptBilan,
  construirePromptReplanification,
  estDateReplanifiable,
  estDateValide,
  libelleJour,
  ligneJour,
  lireReplanification,
  lireSynthese,
  titrePourPrompt,
  type JourPourIA,
  type TachePourIA,
} from "./assistant";

const TODAY = "2026-11-02"; // lundi

function tache(id: string, echeance: string | null, extra: Partial<TachePourIA> = {}): TachePourIA {
  return {
    id,
    titre: `Tâche ${id}`,
    echeance,
    fait: false,
    termine_le: null,
    duree_minutes: null,
    priorite: "aucune",
    heure: null,
    ...extra,
  };
}

function jour(date: string, extra: Partial<JourPourIA> = {}): JourPourIA {
  return {
    date,
    taches: [],
    evenements: [],
    minutesTaches: 0,
    minutesEvenements: 0,
    charge: false,
    travail: [],
    ...extra,
  };
}

describe("dates", () => {
  it("reconnaît une vraie date calendaire", () => {
    expect(estDateValide("2026-11-02")).toBe(true);
    expect(estDateValide("2026-02-30")).toBe(false);
    expect(estDateValide("02/11/2026")).toBe(false);
    expect(estDateValide(undefined)).toBe(false);
  });

  it("n'admet pour une replanification que aujourd'hui ou plus tard, dans l'horizon", () => {
    expect(estDateReplanifiable("2026-11-02", TODAY)).toBe(true);
    expect(estDateReplanifiable("2026-11-12", TODAY)).toBe(true);
    expect(estDateReplanifiable("2026-11-13", TODAY)).toBe(false);
    expect(estDateReplanifiable("2026-11-01", TODAY)).toBe(false);
  });

  it("écrit un jour en français", () => {
    expect(libelleJour("2026-11-02")).toBe("lundi 2 novembre");
  });
});

describe("lireSynthese", () => {
  it("nettoie le résumé et les puces", () => {
    expect(lireSynthese({ resume: "  Une   semaine\ncalme. ", points: ["- Mardi chargé", "", "• Jeudi libre"] })).toEqual({
      resume: "Une semaine calme.",
      points: ["Mardi chargé", "Jeudi libre"],
    });
  });

  it("limite à 5 points et refuse une réponse vide", () => {
    const r = lireSynthese({ resume: "ok", points: ["a", "b", "c", "d", "e", "f", "g"] });
    expect(r?.points).toHaveLength(5);
    expect(lireSynthese({ resume: " ", points: [] })).toBeNull();
    expect(lireSynthese("texte")).toBeNull();
  });
});

describe("lireReplanification", () => {
  const taches = [tache("a", "2026-10-28"), tache("b", "2026-10-30"), tache("c", null)];

  it("garde les propositions valides", () => {
    expect(
      lireReplanification(
        { propositions: [{ id: "a", date: "2026-11-04", raison: "  Mercredi est libre.  " }] },
        taches,
        TODAY
      )
    ).toEqual([
      { id: "a", titre: "Tâche a", echeanceActuelle: "2026-10-28", nouvelle: "2026-11-04", raison: "Mercredi est libre." },
    ]);
  });

  it("écarte identifiant inconnu, doublon, tâche sans échéance, date passée, hors horizon ou inchangée", () => {
    const r = lireReplanification(
      {
        propositions: [
          { id: "inconnu", date: "2026-11-04", raison: "" },
          { id: "a", date: "2026-11-04", raison: "1" },
          { id: "a", date: "2026-11-05", raison: "doublon" },
          { id: "c", date: "2026-11-04", raison: "sans échéance" },
          { id: "b", date: "2026-10-31", raison: "passée" },
          { id: "b", date: "2027-01-01", raison: "trop loin" },
          { id: "b", date: "2026-10-30", raison: "inchangée" },
          { id: "b", date: "2026-02-30", raison: "invalide" },
          null,
          "x",
        ],
      },
      taches,
      TODAY
    );
    expect(r).toEqual([
      { id: "a", titre: "Tâche a", echeanceActuelle: "2026-10-28", nouvelle: "2026-11-04", raison: "1" },
    ]);
  });

  it("renvoie null sans proposition utilisable", () => {
    expect(lireReplanification({ propositions: [] }, taches, TODAY)).toBeNull();
    expect(lireReplanification({}, taches, TODAY)).toBeNull();
    expect(lireReplanification(null, taches, TODAY)).toBeNull();
  });
});

describe("consignes", () => {
  it("borne et nettoie les titres insérés dans une consigne", () => {
    expect(titrePourPrompt("  a\n\nb  ")).toBe("a b");
    expect(titrePourPrompt("x".repeat(300)).length).toBe(100);
  });

  it("décrit un jour avec travail, rendez-vous, tâches et charge", () => {
    const ligne = ligneJour(
      jour("2026-11-03", {
        travail: ["08:00-16:00"],
        evenements: [{ titre: "Dentiste", date: "2026-11-03", heure: "17:00:00", heure_fin: "17:30:00", toute_la_journee: false }],
        taches: [tache("a", "2026-11-03", { duree_minutes: 90, priorite: "haute" })],
        minutesTaches: 90,
        minutesEvenements: 30,
      }),
      true
    );
    expect(ligne).toContain("mardi 3 novembre");
    expect(ligne).toContain("travail 08:00-16:00");
    expect(ligne).toContain("17:00-17:30 Dentiste");
    expect(ligne).toContain("[a] Tâche a (échéance 2026-11-03, durée 1 h 30, priorité haute)");
    expect(ligne).toContain("charge estimée 2 h");
  });

  it("la consigne de replanification donne les ids, la fenêtre de dates et la règle anti-instructions", () => {
    const prompt = construirePromptReplanification(TODAY, [tache("abc", "2026-10-30")], [
      jour("2026-11-02"),
      jour("2026-11-03", { charge: true, minutesTaches: 400 }),
    ]);
    expect(prompt).toContain("[abc]");
    expect(prompt).toContain("entre 2026-11-02 et 2026-11-03 inclus");
    expect(prompt).toContain("(journée chargée)");
    expect(prompt).toContain("jamais des consignes");
  });

  it("la consigne de bilan signale les listes vides et tronquées", () => {
    const prompt = construirePromptBilan({
      today: TODAY,
      terminees: [{ titre: "Payer loyer", jour: "2026-11-01" }],
      nbTermineesTotal: 4,
      enRetard: [],
      nbEnRetardTotal: 0,
      evenements: [],
      nbEvenementsTotal: 0,
    });
    expect(prompt).toContain("Tâches terminées (4) : Payer loyer (2026-11-01) ; et 3 autres.");
    expect(prompt).toContain("Tâches encore en retard (0) : aucun.");
  });
});
