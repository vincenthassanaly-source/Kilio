// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ecritures, fauxSupabase, type Appel, type Reponse } from "@/test/fake-supabase";
import { dernieresSeries, enregistrerEntrainement, listerExercices } from "./serveur";
import type { EntrainementPayload } from "./seance";

const ID_ENTRAINEMENT = "00000000-0000-4000-8000-000000000001";
const ID_EXERCICE = "11111111-1111-4111-8111-111111111111";
const CLE = "00000000-0000-4000-8000-000000000002";
const SERIE_1 = "00000000-0000-4000-8000-000000000003";
const SERIE_2 = "00000000-0000-4000-8000-000000000004";
const SEANCE = "22222222-2222-4222-8222-222222222222";
const ROUTINE = "33333333-3333-4333-8333-333333333333";

function payload(extra: Partial<EntrainementPayload> = {}): EntrainementPayload {
  return {
    id: ID_ENTRAINEMENT,
    nom: " Push ",
    routineId: null,
    seanceId: null,
    debutA: "2026-10-12T16:00:00.000Z",
    finA: "2026-10-12T17:00:00.000Z",
    exercices: [
      {
        cle: CLE,
        exerciceId: ID_EXERCICE,
        reposS: 90,
        series: [
          { id: SERIE_1, type: "echauffement", poids: 40, reps: 10, duree: null, distance: null },
          { id: SERIE_2, type: "normale", poids: 82.456, reps: 8, duree: null, distance: null },
        ],
      },
    ],
    ...extra,
  };
}

describe("enregistrerEntrainement", () => {
  it("remplace l'entraînement, ses exercices et ses séries, et marque le jour d'entraînement", async () => {
    const fake = fauxSupabase();

    const resultat = await enregistrerEntrainement(fake.client as never, payload());

    expect(resultat.error).toBeNull();
    const [entrainement] = ecritures(fake.appels, "entrainements", "upsert");
    expect(entrainement.payload).toMatchObject({
      id: ID_ENTRAINEMENT,
      titre: "Push",
      date: "2026-10-12",
      duree_s: 3600,
      seance_id: null,
      routine_id: null,
    });
    expect(ecritures(fake.appels, "entrainement_exercices", "delete")[0].filtres).toContainEqual([
      "eq",
      "entrainement_id",
      ID_ENTRAINEMENT,
    ]);
    expect(ecritures(fake.appels, "entrainement_exercices", "insert")[0].payload).toEqual([
      { id: CLE, entrainement_id: ID_ENTRAINEMENT, exercice_id: ID_EXERCICE, ordre: 0, repos_s: 90 },
    ]);
    const series = ecritures(fake.appels, "entrainement_series", "insert")[0].payload as Record<string, unknown>[];
    expect(series.map((s) => [s.id, s.ordre, s.type_serie, s.poids_kg])).toEqual([
      [SERIE_1, 0, "echauffement", 40],
      [SERIE_2, 1, "normale", 82.46],
    ]);
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")[0].payload).toMatchObject({
      date: "2026-10-12",
      entraine: true,
    });
  });

  it("coche la séance planifiée (qui marque aussi son jour) quand elle existe", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "seances" && a.action === "select") {
        return { data: { id: SEANCE, date: "2026-10-12", statut: "prevue" } };
      }
      return undefined;
    });

    await enregistrerEntrainement(fake.client as never, payload({ seanceId: SEANCE }));

    expect(ecritures(fake.appels, "entrainements", "upsert")[0].payload).toMatchObject({ seance_id: SEANCE });
    const [maj] = ecritures(fake.appels, "seances", "update");
    expect(maj.payload).toEqual({ statut: "faite" });
    expect(maj.filtres).toContainEqual(["eq", "id", SEANCE]);
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")[0].payload).toMatchObject({
      date: "2026-10-12",
      entraine: true,
    });
  });

  it("ignore une routine et une séance planifiée supprimées entre-temps", async () => {
    const fake = fauxSupabase(); // aucune ligne trouvée

    const resultat = await enregistrerEntrainement(fake.client as never, payload({ routineId: ROUTINE, seanceId: SEANCE }));

    expect(resultat.error).toBeNull();
    expect(ecritures(fake.appels, "entrainements", "upsert")[0].payload).toMatchObject({
      seance_id: null,
      routine_id: null,
    });
    expect(ecritures(fake.appels, "seances")).toHaveLength(0);
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")).toHaveLength(1);
  });

  it("signale un exercice disparu du catalogue", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "entrainement_exercices" && a.action === "insert" ? { error: { message: "fk" } } : undefined,
    );

    const resultat = await enregistrerEntrainement(fake.client as never, payload());

    expect(resultat.error).toMatch(/catalogue/);
    expect(ecritures(fake.appels, "entrainement_series")).toHaveLength(0);
  });

  it("échoue sans rien marquer quand l'écriture de l'entraînement échoue", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "entrainements" && a.action === "upsert" ? { error: { message: "boom" } } : undefined,
    );

    const resultat = await enregistrerEntrainement(fake.client as never, payload());

    expect(resultat.error).not.toBeNull();
    expect(ecritures(fake.appels, "jours_entrainement")).toHaveLength(0);
  });
});

describe("dernieresSeries", () => {
  it("retient la séance la plus récente de chaque exercice, sans les échauffements", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "entrainement_exercices") {
        return {
          data: [
            { id: "ee-vieux", exercice_id: ID_EXERCICE, entrainement_id: "e1" },
            { id: "ee-recent", exercice_id: ID_EXERCICE, entrainement_id: "e2" },
          ],
        };
      }
      if (a.table === "entrainements") {
        return {
          data: [
            { id: "e1", debut_at: "2026-10-01T10:00:00Z" },
            { id: "e2", debut_at: "2026-10-08T10:00:00Z" },
          ],
        };
      }
      if (a.table === "entrainement_series") {
        expect(a.filtres).toContainEqual(["in", "entrainement_exercice_id", ["ee-recent"]]);
        return {
          data: [
            { entrainement_exercice_id: "ee-recent", ordre: 0, type_serie: "echauffement", poids_kg: 40, reps: 10, duree_s: null, distance_m: null },
            { entrainement_exercice_id: "ee-recent", ordre: 1, type_serie: "normale", poids_kg: 80, reps: 8, duree_s: null, distance_m: null },
          ],
        };
      }
      return undefined;
    });

    const resultat = await dernieresSeries(fake.client as never, [ID_EXERCICE, ID_EXERCICE]);

    expect(resultat).toEqual({ [ID_EXERCICE]: [{ poids: 80, reps: 8, duree: null, distance: null }] });
  });

  it("ne requête rien sans exercice, et renvoie {} sans historique", async () => {
    const fake = fauxSupabase();
    expect(await dernieresSeries(fake.client as never, [])).toEqual({});
    expect(fake.appels).toHaveLength(0);
    expect(await dernieresSeries(fake.client as never, [ID_EXERCICE])).toEqual({});
  });
});

describe("listerExercices", () => {
  it("normalise les valeurs inconnues", async () => {
    const fake = fauxSupabase(() => ({
      data: [{ id: ID_EXERCICE, nom: "Squat", mode_saisie: "bizarre", muscle_principal: "nuque", materiel: null, repos_defaut_s: 120 }],
    }));

    expect(await listerExercices(fake.client as never)).toEqual([
      { id: ID_EXERCICE, nom: "Squat", mode: "poids_reps", muscle: "corps_entier", materiel: null, reposDefautS: 120 },
    ]);
  });
});
