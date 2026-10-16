// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ecritures, fauxSupabase, type Appel, type Reponse } from "@/test/fake-supabase";
import { dernieresSeries, enregistrerEntrainement, listerExercices, supprimerEntrainement } from "./serveur";
import type { EntrainementPayload } from "./seance";

const ID_ENTRAINEMENT = "00000000-0000-4000-8000-000000000001";
const ID_EXERCICE = "11111111-1111-4111-8111-111111111111";
const CLE = "00000000-0000-4000-8000-000000000002";
const SERIE_1 = "00000000-0000-4000-8000-000000000003";
const SERIE_2 = "00000000-0000-4000-8000-000000000004";
const ROUTINE = "33333333-3333-4333-8333-333333333333";

/** Réponse de base : l'exercice de la séance existe au catalogue. */
function avecCatalogue(repondre: (a: Appel) => Reponse | undefined = () => undefined) {
  return (a: Appel): Reponse | undefined =>
    repondre(a) ?? (a.table === "exercices" && a.action === "select" ? { data: [{ id: ID_EXERCICE }] } : undefined);
}

function payload(extra: Partial<EntrainementPayload> = {}): EntrainementPayload {
  return {
    id: ID_ENTRAINEMENT,
    nom: " Push ",
    routineId: null,
    typeSeance: null,
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
    const fake = fauxSupabase(avecCatalogue());

    const resultat = await enregistrerEntrainement(fake.client as never, payload());

    expect(resultat.error).toBeNull();
    const [entrainement] = ecritures(fake.appels, "entrainements", "upsert");
    expect(entrainement.payload).toMatchObject({
      id: ID_ENTRAINEMENT,
      titre: "Push",
      date: "2026-10-12",
      duree_s: 3600,
      type_seance: null,
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

  it("enregistre le type choisi pour une séance libre", async () => {
    const fake = fauxSupabase(avecCatalogue());

    await enregistrerEntrainement(fake.client as never, payload({ typeSeance: "PULL" }));

    expect(ecritures(fake.appels, "entrainements", "upsert")[0].payload).toMatchObject({ type_seance: "PULL", routine_id: null });
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")[0].payload).toMatchObject({
      date: "2026-10-12",
      entraine: true,
    });
  });

  it("reprend le type de la routine suivie, quel que soit le type envoyé", async () => {
    const fake = fauxSupabase(avecCatalogue((a: Appel): Reponse | undefined =>
      a.table === "routines" && a.action === "select" ? { data: { id: ROUTINE, type_seance: "LEGS" } } : undefined,
    ));

    await enregistrerEntrainement(fake.client as never, payload({ routineId: ROUTINE, typeSeance: "PUSH" }));

    expect(ecritures(fake.appels, "entrainements", "upsert")[0].payload).toMatchObject({
      routine_id: ROUTINE,
      type_seance: "LEGS",
    });
  });

  it("garde le type d'une routine sans type : celui de la séance, sinon aucun", async () => {
    const fake = fauxSupabase(avecCatalogue((a: Appel): Reponse | undefined =>
      a.table === "routines" && a.action === "select" ? { data: { id: ROUTINE, type_seance: null } } : undefined,
    ));

    await enregistrerEntrainement(fake.client as never, payload({ routineId: ROUTINE }));

    expect(ecritures(fake.appels, "entrainements", "upsert")[0].payload).toMatchObject({
      routine_id: ROUTINE,
      type_seance: null,
    });
  });

  it("ignore une routine supprimée entre-temps", async () => {
    const fake = fauxSupabase(avecCatalogue()); // aucune ligne trouvée

    const resultat = await enregistrerEntrainement(fake.client as never, payload({ routineId: ROUTINE }));

    expect(resultat.error).toBeNull();
    expect(ecritures(fake.appels, "entrainements", "upsert")[0].payload).toMatchObject({
      routine_id: null,
      type_seance: null,
    });
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")).toHaveLength(1);
  });

  it("signale un exercice disparu du catalogue", async () => {
    const fake = fauxSupabase(avecCatalogue((a: Appel): Reponse | undefined =>
      a.table === "entrainement_exercices" && a.action === "insert" ? { error: { message: "fk" } } : undefined,
    ));

    const resultat = await enregistrerEntrainement(fake.client as never, payload());

    expect(resultat.error).toMatch(/catalogue/);
    expect(ecritures(fake.appels, "entrainement_series")).toHaveLength(0);
    // Pas de séance fantôme : l'entête est retiré.
    expect(ecritures(fake.appels, "entrainements", "delete")).toHaveLength(1);
  });

  it("n'écrit rien quand un exercice n'est plus au catalogue", async () => {
    const fake = fauxSupabase(); // le catalogue ne renvoie aucun exercice

    const resultat = await enregistrerEntrainement(fake.client as never, payload());

    expect(resultat.error).toMatch(/catalogue/);
    expect(ecritures(fake.appels, "entrainements")).toHaveLength(0);
    expect(ecritures(fake.appels, "jours_entrainement")).toHaveLength(0);
  });

  it("retire la séance incomplète quand l'écriture des séries échoue", async () => {
    const fake = fauxSupabase(avecCatalogue((a: Appel): Reponse | undefined =>
      a.table === "entrainement_series" && a.action === "insert" ? { error: { message: "boom" } } : undefined,
    ));

    const resultat = await enregistrerEntrainement(fake.client as never, payload());

    expect(resultat.error).not.toBeNull();
    expect(ecritures(fake.appels, "entrainements", "delete")).toHaveLength(1);
    expect(ecritures(fake.appels, "jours_entrainement")).toHaveLength(0);
  });

  it("échoue sans rien marquer quand l'écriture de l'entraînement échoue", async () => {
    const fake = fauxSupabase(avecCatalogue((a: Appel): Reponse | undefined =>
      a.table === "entrainements" && a.action === "upsert" ? { error: { message: "boom" } } : undefined,
    ));

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
      data: [{ id: ID_EXERCICE, nom: "Squat", mode_saisie: "bizarre", muscle_principal: "nuque", materiel: null, repos_defaut_s: 120, animation: "inconnue" }],
    }));

    expect(await listerExercices(fake.client as never)).toEqual([
      { id: ID_EXERCICE, nom: "Squat", mode: "poids_reps", muscle: "corps_entier", materiel: null, reposDefautS: 120, animation: null },
    ]);
  });
});

describe("supprimerEntrainement", () => {
  function repondre(restantes: number) {
    return (a: Appel): Reponse | undefined => {
      if (a.table !== "entrainements" || a.action !== "select") return undefined;
      return a.terminal === "maybeSingle" ? { data: { date: "2026-10-12" } } : { count: restantes };
    };
  }

  it("décoche le jour d'entraînement quand c'était la dernière séance du jour", async () => {
    const fake = fauxSupabase(repondre(0));

    const resultat = await supprimerEntrainement(fake.client as never, ID_ENTRAINEMENT);

    expect(resultat.error).toBeNull();
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")[0].payload).toMatchObject({
      date: "2026-10-12",
      entraine: false,
    });
  });

  it("garde le jour d'entraînement s'il reste une séance ce jour-là", async () => {
    const fake = fauxSupabase(repondre(1));

    await supprimerEntrainement(fake.client as never, ID_ENTRAINEMENT);

    expect(ecritures(fake.appels, "jours_entrainement")).toHaveLength(0);
  });
});
