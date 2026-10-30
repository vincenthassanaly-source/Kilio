import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  arrondirRappel,
  construirePrompt,
  erreurElement,
  formDataTache,
  inputEvenement,
  jourSemaine,
  normaliserReponse,
  type ContexteSaisie,
} from "./compute";

const CTX: ContexteSaisie = {
  aujourdhui: "2026-10-30",
  heure: "10:15",
  listes: [
    { id: "l-perso", nom: "Perso" },
    { id: "l-general", nom: "Général" },
    { id: "l-maison", nom: "Maison" },
  ],
  tags: [{ id: "t-urgent", nom: "Urgent" }],
};

function brut(partiel: Record<string, unknown>) {
  return {
    type: "tache",
    titre: "Appeler le plombier",
    date: "",
    heure: "",
    heure_proposee: false,
    toute_la_journee: false,
    duree_minutes: 0,
    liste_id: "",
    tags: [],
    nouveaux_tags: [],
    sous_taches: [],
    rappel_demande: false,
    rappel_delai_minutes: 0,
    recurrence: "aucune",
    recurrence_fin: "",
    notes: "",
    ...partiel,
  };
}

function un(partiel: Record<string, unknown>) {
  const r = normaliserReponse({ elements: [brut(partiel)] }, CTX);
  expect(r).toHaveLength(1);
  return r![0];
}

describe("dates", () => {
  it("calcule le jour de la semaine et ajoute des jours", () => {
    expect(jourSemaine("2026-10-30")).toBe("vendredi");
    expect(ajouterJours("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("le prompt contient le calendrier, les listes et la phrase", () => {
    const p = construirePrompt("dentiste jeudi", CTX);
    expect(p).toContain("vendredi 2026-10-30");
    expect(p).toContain("l-maison | Maison");
    expect(p).toContain("dentiste jeudi");
  });
});

describe("arrondirRappel", () => {
  it.each([
    [0, 0],
    [3, 5],
    [10, 15],
    [45, 60],
    [120, 60],
    [4320, 1440],
  ])("%i min -> %i", (demande, attendu) => {
    expect(arrondirRappel(demande)).toBe(attendu);
  });
});

describe("normaliserReponse : forme", () => {
  it("renvoie null si la réponse est mal formée", () => {
    expect(normaliserReponse({}, CTX)).toBeNull();
    expect(normaliserReponse(null, CTX)).toBeNull();
  });

  it("ignore les éléments sans titre", () => {
    expect(normaliserReponse({ elements: [brut({ titre: "  " })] }, CTX)).toEqual([]);
  });
});

describe("normaliserReponse : heure et rappel", () => {
  it("heure donnée : conservée, rappel par défaut à l'heure exacte", () => {
    const e = un({ date: "2026-11-05", heure: "14:30" });
    expect(e).toMatchObject({ heure: "14:30", heureProposee: false, rappelMinutes: 0, rappelOrigine: "defaut" });
  });

  it("date sans heure : heure proposée à 9 h + rappel par défaut", () => {
    const e = un({ date: "2026-10-31" });
    expect(e).toMatchObject({ heure: "09:00", heureProposee: true, rappelMinutes: 0, rappelOrigine: "defaut" });
  });

  it("conserve l'heure choisie par Gemini et la marque proposée", () => {
    const e = un({ date: "2026-10-31", heure: "10:30", heure_proposee: true });
    expect(e).toMatchObject({ heure: "10:30", heureProposee: true });
  });

  it("tâche sans date : pas d'heure inventée ni de rappel", () => {
    const e = un({ heure: "14:00" });
    expect(e).toMatchObject({ date: "", heure: "", rappelMinutes: null, rappelOrigine: null });
  });

  it("rappel demandé sans délai : à l'heure", () => {
    const e = un({ date: "2026-11-05", heure: "14:00", rappel_demande: true });
    expect(e).toMatchObject({ rappelMinutes: 0, rappelOrigine: "demande" });
  });

  it("délai hors valeurs autorisées : arrondi et signalé", () => {
    const e = un({ date: "2026-11-05", heure: "14:00", rappel_demande: true, rappel_delai_minutes: 10 });
    expect(e).toMatchObject({ rappelMinutes: 15, rappelOrigine: "arrondi" });
  });

  it("délai autorisé : conservé comme demandé", () => {
    const e = un({ date: "2026-11-05", heure: "14:00", rappel_demande: true, rappel_delai_minutes: 60 });
    expect(e).toMatchObject({ rappelMinutes: 60, rappelOrigine: "demande" });
  });

  it("journée entière : pas de rappel par défaut, seulement la veille si demandé", () => {
    expect(un({ date: "2026-11-05", toute_la_journee: true })).toMatchObject({
      heure: "",
      rappelMinutes: null,
    });
    expect(
      un({ date: "2026-11-05", toute_la_journee: true, rappel_demande: true, rappel_delai_minutes: 30 })
    ).toMatchObject({ rappelMinutes: 1440, rappelOrigine: "arrondi" });
  });

  it("date invalide : ignorée", () => {
    expect(un({ date: "2026-02-31" }).date).toBe("");
  });
});

describe("normaliserReponse : liste, tags, sous-tâches", () => {
  it("liste existante : retenue et marquée déduite", () => {
    expect(un({ liste_id: "l-maison" })).toMatchObject({ listeId: "l-maison", listeDeduite: true });
  });

  it("liste inventée : repli sur Général", () => {
    expect(un({ liste_id: "inconnue" })).toMatchObject({ listeId: "l-general", listeDeduite: false });
  });

  it("sans liste Général : première liste", () => {
    const r = normaliserReponse(
      { elements: [brut({})] },
      { ...CTX, listes: [{ id: "a", nom: "Perso" }, { id: "b", nom: "Travail" }] }
    );
    expect(r![0].listeId).toBe("a");
  });

  it("un événement n'a ni liste, ni tags, ni sous-tâches", () => {
    const e = un({
      type: "evenement",
      date: "2026-11-05",
      heure: "10:00",
      liste_id: "l-maison",
      tags: ["urgent"],
      sous_taches: ["a"],
    });
    expect(e).toMatchObject({ listeId: "", tagIds: [], sousTaches: [], dureeMinutes: 60 });
  });

  it("tags : existants par nom (sans accent ni casse), nouveaux plafonnés", () => {
    const e = un({ tags: ["URGENT", "autre"], nouveaux_tags: ["#a", "b,c", "d", "e"] });
    expect(e.tagIds).toEqual(["t-urgent"]);
    expect(e.nouveauxTags).toEqual(["a", "bc", "d"]);
  });

  it("sous-tâches nettoyées", () => {
    expect(un({ sous_taches: [" valises ", "", "billets"] }).sousTaches).toEqual(["valises", "billets"]);
  });
});

describe("normaliserReponse : multi-éléments, récurrence", () => {
  it("plusieurs éléments avec clés distinctes", () => {
    const r = normaliserReponse({ elements: [brut({ titre: "A" }), brut({ titre: "B", type: "evenement" })] }, CTX)!;
    expect(r.map((e) => e.titre)).toEqual(["A", "B"]);
    expect(new Set(r.map((e) => e.cle)).size).toBe(2);
  });

  it("récurrence valide, fin avant le début ignorée", () => {
    expect(un({ date: "2026-11-02", recurrence: "hebdomadaire", recurrence_fin: "2026-12-01" })).toMatchObject({
      frequence: "hebdomadaire",
      finRecurrence: "2026-12-01",
    });
    expect(un({ date: "2026-11-02", recurrence: "hebdomadaire", recurrence_fin: "2026-10-01" }).finRecurrence).toBe("");
  });
});

describe("validation et conversion", () => {
  it("événement sans date : erreur", () => {
    const e = un({ type: "evenement", heure: "10:00" });
    expect(erreurElement(e)).toBe("La date est requise pour un événement.");
  });

  it("tâche complète : valide, FormData attendue par createTache", () => {
    const e = un({
      date: "2026-11-05",
      heure: "14:30",
      liste_id: "l-maison",
      tags: ["urgent"],
      nouveaux_tags: ["x"],
      recurrence: "mensuel",
    });
    expect(erreurElement(e)).toBeNull();
    const f = formDataTache(e);
    expect(f.get("titre")).toBe("Appeler le plombier");
    expect(f.get("echeance")).toBe("2026-11-05");
    expect(f.get("heure")).toBe("14:30");
    expect(f.get("liste_id")).toBe("l-maison");
    expect(f.get("rappel_minutes")).toBe("0");
    expect(f.getAll("tag_ids")).toEqual(["t-urgent"]);
    expect(f.get("nouveaux_tags")).toBe("x");
    expect(f.get("recurrence_frequence")).toBe("mensuel");
  });

  it("journée entière : toute_la_journee sans heure", () => {
    const f = formDataTache(un({ date: "2026-11-05", toute_la_journee: true }));
    expect(f.get("toute_la_journee")).toBe("on");
    expect(f.has("heure")).toBe(false);
    expect(f.has("rappel_minutes")).toBe(false);
  });

  it("entrée d'événement", () => {
    const e = un({ type: "evenement", titre: "Dentiste", date: "2026-11-05", heure: "14:30", duree_minutes: 45 });
    expect(inputEvenement(e)).toMatchObject({
      titre: "Dentiste",
      date: "2026-11-05",
      heure: "14:30",
      dureeMinutes: 45,
      rappelMinutes: 0,
      recurrenceFrequence: null,
    });
  });
});
