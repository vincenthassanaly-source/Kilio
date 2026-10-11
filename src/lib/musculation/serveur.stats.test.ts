// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fauxSupabase, type Appel, type Reponse } from "@/test/fake-supabase";
import { exercicesAvecHistorique, recordsDesExercices, resumeDePeriode, seriesDeExercice } from "./serveur";

const EXO = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

const ligne = (exo: string, ent: string, date: string, extra: Record<string, unknown> = {}) => ({
  type_serie: "normale",
  poids_kg: 80,
  reps: 8,
  duree_s: null,
  distance_m: null,
  entrainement_exercices: { exercice_id: exo, entrainement_id: ent, entrainements: { date, debut_at: `${date}T10:00:00Z` } },
  ...extra,
});

describe("seriesDeExercice", () => {
  it("filtre sur l'exercice et aplatit les lignes, en ignorant une ligne orpheline", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "entrainement_series"
        ? { data: [ligne(EXO, "e1", "2026-10-01"), { ...ligne(EXO, "e2", "2026-10-02"), entrainement_exercices: null }] }
        : undefined,
    );

    const series = await seriesDeExercice(fake.client as never, EXO);

    expect(fake.appels[0].filtres).toContainEqual(["eq", "entrainement_exercices.exercice_id", EXO]);
    expect(series).toEqual([
      {
        entrainementId: "e1",
        date: "2026-10-01",
        debutA: "2026-10-01T10:00:00Z",
        exerciceId: EXO,
        type: "normale",
        poids: 80,
        reps: 8,
        duree: null,
        distance: null,
      },
    ]);
  });

  it("lève l'erreur de la base", async () => {
    const fake = fauxSupabase(() => ({ error: { message: "boom" } }));
    await expect(seriesDeExercice(fake.client as never, EXO)).rejects.toThrow("boom");
  });
});

describe("recordsDesExercices", () => {
  it("calcule les records de chaque exercice demandé", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "entrainement_series"
        ? { data: [ligne(EXO, "e1", "2026-10-01"), ligne(EXO, "e2", "2026-10-08", { poids_kg: 90 }), ligne(AUTRE, "e1", "2026-10-01", { poids_kg: 20 })] }
        : undefined,
    );

    const records = await recordsDesExercices(fake.client as never, [EXO, AUTRE, EXO]);

    expect(fake.appels[0].filtres).toContainEqual(["in", "entrainement_exercices.exercice_id", [EXO, AUTRE]]);
    expect(records[EXO].poidsMax).toEqual({ valeur: 90, date: "2026-10-08" });
    expect(records[AUTRE].poidsMax).toEqual({ valeur: 20, date: "2026-10-01" });
  });

  it("ne requête rien sans exercice", async () => {
    const fake = fauxSupabase();
    expect(await recordsDesExercices(fake.client as never, [])).toEqual({});
    expect(fake.appels).toHaveLength(0);
  });
});

describe("exercicesAvecHistorique", () => {
  it("compte les séances distinctes, garde la dernière date et trie par pratique", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "entrainement_exercices") {
        return {
          data: [
            { exercice_id: EXO, entrainement_id: "e1", entrainements: { date: "2026-10-01" } },
            { exercice_id: EXO, entrainement_id: "e2", entrainements: { date: "2026-10-08" } },
            { exercice_id: EXO, entrainement_id: "e2", entrainements: { date: "2026-10-08" } },
            { exercice_id: AUTRE, entrainement_id: "e1", entrainements: { date: "2026-10-01" } },
            { exercice_id: AUTRE, entrainement_id: "e9", entrainements: null },
          ],
        };
      }
      if (a.table === "exercices") {
        return { data: [{ id: AUTRE, nom: "Curl", muscle_principal: "biceps" }, { id: EXO, nom: "Squat", muscle_principal: "nuque" }] };
      }
      return undefined;
    });

    expect(await exercicesAvecHistorique(fake.client as never)).toEqual([
      { id: EXO, nom: "Squat", muscle: "corps_entier", nbSeances: 2, derniereSeance: "2026-10-08" },
      { id: AUTRE, nom: "Curl", muscle: "biceps", nbSeances: 1, derniereSeance: "2026-10-01" },
    ]);
  });

  it("renvoie [] sans historique", async () => {
    expect(await exercicesAvecHistorique(fauxSupabase().client as never)).toEqual([]);
  });
});

describe("resumeDePeriode", () => {
  it("résume la période avec la répartition par muscle principal", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "entrainements") return { data: [{ id: "e1", date: "2026-10-12", duree_s: 3600 }] };
      if (a.table === "entrainement_series") {
        return {
          data: [
            { type_serie: "normale", poids_kg: 80, reps: 8, entrainement_exercices: { exercice_id: EXO, entrainement_id: "e1" } },
            { type_serie: "echauffement", poids_kg: 40, reps: 10, entrainement_exercices: { exercice_id: EXO, entrainement_id: "e1" } },
            { type_serie: "normale", poids_kg: 20, reps: 10, entrainement_exercices: { exercice_id: AUTRE, entrainement_id: "e1" } },
          ],
        };
      }
      if (a.table === "exercices") {
        return { data: [{ id: EXO, muscle_principal: "pectoraux" }, { id: AUTRE, muscle_principal: "biceps" }] };
      }
      return undefined;
    });

    const resume = await resumeDePeriode(fake.client as never, "2026-10-12", "2026-10-18");

    const requeteSeries = fake.appels.find((a) => a.table === "entrainement_series")!;
    expect(requeteSeries.filtres).toContainEqual(["gte", "entrainement_exercices.entrainements.date", "2026-10-12"]);
    expect(requeteSeries.filtres).toContainEqual(["lte", "entrainement_exercices.entrainements.date", "2026-10-18"]);
    expect(resume).toMatchObject({
      nbSeances: 1,
      dureeS: 3600,
      nbSeries: 2,
      volume: 840,
      jours: ["2026-10-12"],
      parMuscle: [{ muscle: "biceps", nbSeries: 1 }, { muscle: "pectoraux", nbSeries: 1 }],
    });
  });

  it("ne lit pas les séries quand la période est vide", async () => {
    const fake = fauxSupabase();
    const resume = await resumeDePeriode(fake.client as never, "2026-10-12", "2026-10-18");
    expect(resume.nbSeances).toBe(0);
    expect(fake.appels.map((a) => a.table)).toEqual(["entrainements"]);
  });
});
