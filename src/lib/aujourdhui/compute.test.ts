import { describe, expect, it } from "vitest";
import { libelleRetard, plagesLibresDuJour, proposerCreneaux, repasRestants, tachesDuJour, tachesEnRetard } from "./compute";

const t = (id: string, echeance: string | null, fait = false, heure: string | null = null) => ({
  id,
  echeance,
  fait,
  heure,
});

describe("tachesEnRetard", () => {
  const taches = [
    t("a", "2026-10-02"),
    t("b", "2026-10-04"),
    t("c", "2026-09-30"),
    t("d", "2026-10-01", true),
    t("e", null),
    t("f", "2026-10-02", false, "09:00"),
  ];

  it("garde les non faites à échéance passée, la plus ancienne d'abord", () => {
    expect(tachesEnRetard(taches, "2026-10-04").map((x) => x.id)).toEqual(["c", "a", "f"]);
  });

  it("une tâche d'aujourd'hui n'est jamais en retard", () => {
    expect(tachesEnRetard([t("x", "2026-10-04")], "2026-10-04")).toEqual([]);
  });
});

describe("tachesDuJour", () => {
  it("garde le jour, heure d'abord", () => {
    const liste = [t("a", "2026-10-04"), t("b", "2026-10-04", false, "14:00"), t("c", "2026-10-05"), t("d", "2026-10-04", false, "08:00")];
    expect(tachesDuJour(liste, "2026-10-04").map((x) => x.id)).toEqual(["d", "b", "a"]);
  });
});

describe("libelleRetard", () => {
  it("hier puis il y a N j", () => {
    expect(libelleRetard("2026-10-03", "2026-10-04")).toBe("hier");
    expect(libelleRetard("2026-10-01", "2026-10-04")).toBe("il y a 3 j");
    expect(libelleRetard("2026-09-30", "2026-10-04")).toBe("il y a 4 j");
  });
});

describe("repasRestants", () => {
  const consomme = { kcal: 1400, proteines: 90, glucides: 150, lipides: 70 };

  it("calcule le reste par rapport à la cible", () => {
    const r = repasRestants(consomme, 2000, { proteines: 120, glucides: 220, lipides: 65 });
    expect(r?.kcal).toEqual({ valeur: 600, depasse: false });
    expect(r?.proteines).toEqual({ valeur: 30, depasse: false });
    expect(r?.glucides).toEqual({ valeur: 70, depasse: false });
    expect(r?.lipides).toEqual({ valeur: 5, depasse: true });
  });

  it("sans objectif, ne fabrique pas de cible", () => {
    expect(repasRestants(consomme, null, null)).toBeNull();
    expect(repasRestants(consomme, 2000, null)).toBeNull();
  });
});

describe("plagesLibresDuJour", () => {
  it("retire le travail et les blocs, depuis maintenant", () => {
    const libres = plagesLibresDuJour({
      maintenant: "08:00",
      creneauxTravail: [{ heure_debut: "09:00:00", heure_fin: "12:00:00" }],
      blocs: [{ heure: "14:00:00", heure_fin: "15:00:00" }],
    });
    expect(libres).toEqual([
      { debut: "08:00", fin: "09:00" },
      { debut: "12:00", fin: "14:00" },
      { debut: "15:00", fin: "22:00" },
    ]);
  });

  it("un bloc sans heure de fin occupe 30 min, comme sur la grille", () => {
    const libres = plagesLibresDuJour({
      maintenant: "13:00",
      creneauxTravail: [],
      blocs: [{ heure: "14:00:00", heure_fin: null }],
    });
    expect(libres).toEqual([
      { debut: "13:00", fin: "14:00" },
      { debut: "14:30", fin: "22:00" },
    ]);
  });

  it("un poste de nuit qui franchit minuit court jusqu'à minuit", () => {
    const libres = plagesLibresDuJour({
      maintenant: "07:00",
      creneauxTravail: [{ heure_debut: "20:00:00", heure_fin: "06:00:00" }],
      blocs: [],
    });
    expect(libres).toEqual([{ debut: "07:00", fin: "20:00" }]);
  });

  it("plus rien de libre passé 22h", () => {
    expect(plagesLibresDuJour({ maintenant: "22:30", creneauxTravail: [], blocs: [] })).toEqual([]);
  });
});

describe("proposerCreneaux", () => {
  it("propose le plus tôt possible dans chaque trou assez long", () => {
    const libres = [
      { debut: "12:00", fin: "12:20" },
      { debut: "13:00", fin: "14:00" },
      { debut: "18:00", fin: "18:45" },
    ];
    expect(proposerCreneaux(libres, 45)).toEqual([
      { debut: "13:00", fin: "13:45" },
      { debut: "18:00", fin: "18:45" },
    ]);
  });

  it("espace les propositions dans un grand trou, calées sur la demi-heure", () => {
    const libres = [{ debut: "16:10", fin: "22:00" }];
    expect(proposerCreneaux(libres, 30)).toEqual([
      { debut: "16:10", fin: "16:40" },
      { debut: "18:00", fin: "18:30" },
      { debut: "19:30", fin: "20:00" },
    ]);
  });

  it("ne dépasse jamais le nombre demandé ni la fin du trou", () => {
    expect(proposerCreneaux([{ debut: "09:00", fin: "22:00" }], 60, 2)).toHaveLength(2);
    const dernier = proposerCreneaux([{ debut: "20:00", fin: "22:00" }], 60, 10);
    expect(dernier.at(-1)!.fin <= "22:00").toBe(true);
  });

  it("renvoie une liste vide sans trou assez long ou avec une durée invalide", () => {
    expect(proposerCreneaux([{ debut: "10:00", fin: "10:30" }], 60)).toEqual([]);
    expect(proposerCreneaux([{ debut: "10:00", fin: "12:00" }], 0)).toEqual([]);
    expect(proposerCreneaux([], 30)).toEqual([]);
  });
});
