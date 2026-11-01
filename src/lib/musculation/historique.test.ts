import { describe, expect, it } from "vitest";
import {
  brouillonDepuisEntrainement,
  brouillonPourRefaire,
  formaterDateLongue,
  formaterDureeS,
  heureParisDe,
  instantParis,
  resumerEntrainement,
  routineDepuisEntrainement,
  volumeDeSeries,
  type EntrainementDetail,
} from "./historique";
import { validerPayload, versPayload } from "./seance";

const EXO = "11111111-1111-4111-8111-111111111111";
const CLE = "00000000-0000-4000-8000-000000000001";
const ID = "00000000-0000-4000-8000-000000000009";

function compteur() {
  let n = 100;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

const detail: EntrainementDetail = {
  id: ID,
  titre: "Push",
  date: "2026-10-12",
  debutA: "2026-10-12T16:00:00.000Z",
  finA: "2026-10-12T17:00:00.000Z",
  dureeS: 3600,
  routineId: null,
  typeSeance: "PUSH",
  exercices: [
    {
      cle: CLE,
      exerciceId: EXO,
      nom: "Développé couché",
      mode: "poids_reps",
      reposS: 60,
      series: [
        { type: "echauffement", poids: 40, reps: 10, duree: null, distance: null },
        { type: "normale", poids: 80, reps: 8, duree: null, distance: null },
        { type: "normale", poids: -20, reps: 8, duree: null, distance: null },
      ],
    },
  ],
};

describe("volume et synthèse", () => {
  it("ignore l'échauffement et les poids négatifs", () => {
    expect(volumeDeSeries(detail.exercices[0].series)).toBe(640);
  });

  it("résume une séance", () => {
    expect(resumerEntrainement({ id: ID, titre: "Push", date: "2026-10-12", dureeS: 3600, typeSeance: "PUSH" }, detail.exercices)).toEqual({
      id: ID,
      titre: "Push",
      date: "2026-10-12",
      dureeS: 3600,
      nbExercices: 1,
      nbSeries: 3,
      volume: 640,
      typeSeance: "PUSH",
    });
  });
});

describe("brouillonDepuisEntrainement", () => {
  it("marque toutes les séries faites, sans repos, avec des identifiants de série uniques", () => {
    const b = brouillonDepuisEntrainement(detail, compteur());
    expect(b.repos).toBeNull();
    expect(b.id).toBe(ID);
    const series = b.exercices[0].series;
    expect(series.every((s) => s.fait && s.faitA === detail.debutA)).toBe(true);
    expect(new Set(series.map((s) => s.id)).size).toBe(3);
    expect(b.exercices[0].reposS).toBe(60);
  });

  it("repasse par versPayload sans rien perdre (round-trip)", () => {
    const payload = versPayload(brouillonDepuisEntrainement(detail), detail.finA)!;
    expect(validerPayload(payload)).toBeNull();
    expect(payload.exercices[0].cle).toBe(CLE);
    expect(payload.exercices[0].series.map((s) => [s.type, s.poids, s.reps])).toEqual([
      ["echauffement", 40, 10],
      ["normale", 80, 8],
      ["normale", -20, 8],
    ]);
  });
});

describe("brouillonPourRefaire", () => {
  const MAINTENANT = "2026-10-31T10:00:00.000Z";
  const precedent = [
    { poids: 85, reps: 6, duree: null, distance: null },
    { poids: 90, reps: 5, duree: null, distance: null },
  ];

  it("reprend titre, routine, type, exercices, nombre et types de série, sans rien marquer fait", () => {
    const b = brouillonPourRefaire({ ...detail, routineId: "r-1" }, { [EXO]: precedent }, {}, MAINTENANT, compteur());
    expect(b.nom).toBe("Push");
    expect(b.routineId).toBe("r-1");
    expect(b.typeSeance).toBe("PUSH");
    expect(b.debutA).toBe(MAINTENANT);
    expect(b.repos).toBeNull();
    expect(b.id).not.toBe(ID);
    expect(b.exercices).toHaveLength(1);
    expect(b.exercices[0].exerciceId).toBe(EXO);
    expect(b.exercices[0].reposS).toBe(60);
    expect(b.exercices[0].series.map((s) => s.type)).toEqual(["echauffement", "normale", "normale"]);
    expect(b.exercices[0].series.every((s) => !s.fait && s.faitA === null)).toBe(true);
  });

  it("préremplit poids et reps avec la dernière performance, pas avec la séance copiée", () => {
    const b = brouillonPourRefaire(detail, { [EXO]: precedent }, {}, MAINTENANT, compteur());
    expect(b.exercices[0].series.map((s) => [s.poids, s.reps])).toEqual([
      [85, 6],
      [90, 5],
      [90, 5],
    ]);
    expect(b.exercices[0].precedent).toEqual(precedent);
  });

  it("démarre sans valeurs quand l'exercice n'a pas d'historique, et garde une séance libre sans routine", () => {
    const b = brouillonPourRefaire(detail, {}, {}, MAINTENANT, compteur());
    expect(b.routineId).toBeNull();
    expect(b.exercices[0].series.map((s) => [s.poids, s.reps])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("utilise le repos par défaut quand la séance copiée n'en avait pas", () => {
    const sansRepos = { ...detail, exercices: [{ ...detail.exercices[0], reposS: null }] };
    expect(brouillonPourRefaire(sansRepos, {}, {}, MAINTENANT, compteur()).exercices[0].reposS).toBe(90);
  });

  it("repasse par versPayload en séance valide une fois les séries faites", () => {
    const b = brouillonPourRefaire(detail, { [EXO]: precedent }, {}, MAINTENANT, compteur());
    const faites = {
      ...b,
      exercices: b.exercices.map((e) => ({ ...e, series: e.series.map((s) => ({ ...s, fait: true, faitA: MAINTENANT })) })),
    };
    const payload = versPayload(faites, "2026-10-31T11:00:00.000Z");
    expect(payload).not.toBeNull();
    expect(validerPayload(payload!)).toBeNull();
  });
});

describe("routineDepuisEntrainement", () => {
  it("reprend exercices, repos et séries ; l'id n'est ajouté que pour une mise à jour", () => {
    const creation = routineDepuisEntrainement(detail, { nom: "Push A", typeSeance: "PUSH", dossierId: null });
    expect(creation).not.toHaveProperty("id");
    expect(creation.exercices).toEqual([{ exerciceId: EXO, reposS: 60, series: detail.exercices[0].series }]);
    const maj = routineDepuisEntrainement(detail, { id: ID, nom: "Push A", typeSeance: null, dossierId: null });
    expect(maj.id).toBe(ID);
  });
});

describe("dates de Paris", () => {
  it("convertit heure d'hiver et heure d'été", () => {
    expect(instantParis("2026-01-15", "18:30")).toBe("2026-01-15T17:30:00.000Z");
    expect(instantParis("2026-07-15", "18:30")).toBe("2026-07-15T16:30:00.000Z");
  });

  it("gère les changements d'heure", () => {
    // 2026-10-25 : retour à l'heure d'hiver (03:00 → 02:00). 10:00 est après le changement.
    expect(instantParis("2026-10-25", "10:00")).toBe("2026-10-25T09:00:00.000Z");
    // 2026-03-29 : passage à l'heure d'été. 10:00 est après le changement.
    expect(instantParis("2026-03-29", "10:00")).toBe("2026-03-29T08:00:00.000Z");
    // Minuit la veille d'un changement reste en heure d'été / d'hiver correcte.
    expect(instantParis("2026-10-24", "23:30")).toBe("2026-10-24T21:30:00.000Z");
  });

  it("fait l'aller-retour instant ↔ heure de Paris", () => {
    for (const [d, h] of [["2026-01-15", "07:05"], ["2026-07-15", "23:59"], ["2026-10-25", "10:00"]] as const) {
      expect(heureParisDe(instantParis(d, h))).toBe(h);
    }
  });

  it("formate dates et durées", () => {
    expect(formaterDateLongue("2026-10-12")).toBe("lundi 12 octobre");
    expect(formaterDureeS(2700)).toBe("45 min");
    expect(formaterDureeS(4500)).toBe("1 h 15");
    expect(formaterDureeS(-5)).toBe("0 min");
  });
});
