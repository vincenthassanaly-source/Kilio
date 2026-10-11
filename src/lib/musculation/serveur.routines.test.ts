// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ecritures, fauxSupabase, type Appel, type Reponse } from "@/test/fake-supabase";
import {
  creerDossier,
  enregistrerRoutine,
  lireRoutine,
  listerRoutines,
  renommerDossier,
  supprimerDossier,
  supprimerRoutine,
} from "./serveur";
import type { RoutineEntree } from "./routines";

const EXO = "11111111-1111-4111-8111-111111111111";
const ROUTINE = "33333333-3333-4333-8333-333333333333";
const DOSSIER = "44444444-4444-4444-8444-444444444444";

const entree = (extra: Partial<RoutineEntree> = {}): RoutineEntree => ({
  nom: " Push A ",
  typeSeance: "PUSH",
  dossierId: DOSSIER,
  exercices: [
    {
      exerciceId: EXO,
      reposS: 60,
      series: [
        { type: "echauffement", poids: 40, reps: 10, duree: null, distance: null },
        { type: "normale", poids: 82.456, reps: 8, duree: null, distance: null },
      ],
    },
  ],
  ...extra,
});

describe("listerRoutines", () => {
  it("compte les exercices par routine et ignore un type inconnu", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "routine_dossiers") return { data: [{ id: DOSSIER, nom: "Force" }] };
      if (a.table === "routines") {
        return {
          data: [
            { id: ROUTINE, nom: "Push A", type_seance: "PUSH", dossier_id: DOSSIER },
            { id: "r2", nom: "Libre", type_seance: "ARMS", dossier_id: null },
          ],
        };
      }
      if (a.table === "routine_exercices") return { data: [{ routine_id: ROUTINE }, { routine_id: ROUTINE }] };
      return undefined;
    });

    expect(await listerRoutines(fake.client as never)).toEqual({
      dossiers: [{ id: DOSSIER, nom: "Force" }],
      routines: [
        { id: ROUTINE, nom: "Push A", typeSeance: "PUSH", dossierId: DOSSIER, nbExercices: 2 },
        { id: "r2", nom: "Libre", typeSeance: null, dossierId: null, nbExercices: 0 },
      ],
    });
  });

  it("lève l'erreur de la base", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "routines" ? { error: { message: "boom" } } : undefined,
    );
    await expect(listerRoutines(fake.client as never)).rejects.toThrow("boom");
  });
});

describe("lireRoutine", () => {
  it("assemble exercices du catalogue et séries cibles dans l'ordre", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "routines") return { data: { id: ROUTINE, nom: "Push A", type_seance: "PUSH", dossier_id: null } };
      if (a.table === "routine_exercices") {
        return { data: [{ id: "re1", exercice_id: EXO, ordre: 0, repos_s: null }, { id: "re2", exercice_id: "disparu", ordre: 1, repos_s: 30 }] };
      }
      if (a.table === "exercices") return { data: [{ id: EXO, nom: "Développé couché", mode_saisie: "poids_reps", repos_defaut_s: 120, animation: "developpe-couche" }] };
      if (a.table === "routine_series") {
        return {
          data: [
            { routine_exercice_id: "re1", ordre: 0, type_serie: "echauffement", poids_kg: 40, reps: 10, duree_s: null, distance_m: null },
            { routine_exercice_id: "re1", ordre: 1, type_serie: "bizarre", poids_kg: 80, reps: 8, duree_s: null, distance_m: null },
          ],
        };
      }
      return undefined;
    });

    const routine = await lireRoutine(fake.client as never, ROUTINE);

    expect(routine).toEqual({
      id: ROUTINE,
      nom: "Push A",
      typeSeance: "PUSH",
      dossierId: null,
      exercices: [
        {
          exerciceId: EXO,
          nom: "Développé couché",
          mode: "poids_reps",
          reposS: null,
          reposExerciceS: 120,
          animation: "developpe-couche",
          series: [
            { type: "echauffement", poids: 40, reps: 10, duree: null, distance: null },
            { type: "normale", poids: 80, reps: 8, duree: null, distance: null },
          ],
        },
      ],
    });
  });

  it("renvoie null pour une routine introuvable", async () => {
    expect(await lireRoutine(fauxSupabase().client as never, ROUTINE)).toBeNull();
  });
});

describe("enregistrerRoutine", () => {
  it("crée la routine puis ses exercices et séries", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "routine_dossiers") return { data: { id: DOSSIER } };
      if (a.table === "routines" && a.action === "insert") return { data: { id: ROUTINE } };
      return undefined;
    });

    const resultat = await enregistrerRoutine(fake.client as never, entree());

    expect(resultat).toEqual({ error: null, id: ROUTINE });
    expect(ecritures(fake.appels, "routines", "insert")[0].payload).toEqual({
      nom: "Push A",
      type_seance: "PUSH",
      dossier_id: DOSSIER,
    });
    const [lignes] = ecritures(fake.appels, "routine_exercices", "insert").map((a) => a.payload as Record<string, unknown>[]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ routine_id: ROUTINE, exercice_id: EXO, ordre: 0, repos_s: 60 });
    const series = ecritures(fake.appels, "routine_series", "insert")[0].payload as Record<string, unknown>[];
    expect(series.map((s) => [s.routine_exercice_id, s.ordre, s.type_serie, s.poids_kg])).toEqual([
      [lignes[0].id, 0, "echauffement", 40],
      [lignes[0].id, 1, "normale", 82.46],
    ]);
  });

  it("met à jour et remplace les exercices d'une routine existante", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "routine_dossiers") return { data: { id: DOSSIER } };
      if (a.table === "routines" && a.action === "update") return { data: [{ id: ROUTINE }] };
      return undefined;
    });

    const resultat = await enregistrerRoutine(fake.client as never, entree({ id: ROUTINE }));

    expect(resultat).toEqual({ error: null, id: ROUTINE });
    expect(ecritures(fake.appels, "routines", "insert")).toHaveLength(0);
    expect(ecritures(fake.appels, "routines", "update")[0].filtres).toContainEqual(["eq", "id", ROUTINE]);
    expect(ecritures(fake.appels, "routine_exercices", "delete")[0].filtres).toContainEqual(["eq", "routine_id", ROUTINE]);
  });

  it("signale une routine supprimée entre-temps, sans toucher à ses exercices", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "routines" && a.action === "update" ? { data: [] } : undefined,
    );

    const resultat = await enregistrerRoutine(fake.client as never, entree({ id: ROUTINE }));

    expect(resultat.error).toMatch(/n'existe plus/);
    expect(ecritures(fake.appels, "routine_exercices")).toHaveLength(0);
  });

  it("ignore un dossier supprimé entre-temps", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "routines" && a.action === "insert" ? { data: { id: ROUTINE } } : undefined,
    );

    await enregistrerRoutine(fake.client as never, entree());

    expect(ecritures(fake.appels, "routines", "insert")[0].payload).toMatchObject({ dossier_id: null });
  });

  it("signale un exercice disparu du catalogue, sans écrire de série", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "routines" && a.action === "insert") return { data: { id: ROUTINE } };
      if (a.table === "routine_exercices" && a.action === "insert") return { error: { message: "fk" } };
      return undefined;
    });

    const resultat = await enregistrerRoutine(fake.client as never, entree({ dossierId: null }));

    expect(resultat.error).toMatch(/catalogue/);
    expect(ecritures(fake.appels, "routine_series")).toHaveLength(0);
  });

  it("échoue proprement quand la création échoue", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "routines" ? { error: { message: "boom" } } : undefined,
    );
    expect((await enregistrerRoutine(fake.client as never, entree({ dossierId: null }))).error).not.toBeNull();
  });
});

describe("suppressions et dossiers", () => {
  it("supprime une routine par identifiant", async () => {
    const fake = fauxSupabase();
    expect(await supprimerRoutine(fake.client as never, ROUTINE)).toEqual({ error: null });
    expect(ecritures(fake.appels, "routines", "delete")[0].filtres).toContainEqual(["eq", "id", ROUTINE]);
  });

  it("crée, renomme et supprime un dossier", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "routine_dossiers" && a.action === "insert" ? { data: { id: DOSSIER } } : undefined,
    );
    expect(await creerDossier(fake.client as never, " Force ")).toEqual({ error: null, id: DOSSIER });
    expect(ecritures(fake.appels, "routine_dossiers", "insert")[0].payload).toEqual({ nom: "Force" });
    expect(await renommerDossier(fake.client as never, DOSSIER, " Masse ")).toEqual({ error: null });
    expect(ecritures(fake.appels, "routine_dossiers", "update")[0].payload).toEqual({ nom: "Masse" });
    expect(await supprimerDossier(fake.client as never, DOSSIER)).toEqual({ error: null });
  });

  it("remonte un message en cas d'échec", async () => {
    const fake = fauxSupabase(() => ({ error: { message: "boom" } }));
    expect((await supprimerRoutine(fake.client as never, ROUTINE)).error).not.toBeNull();
    expect((await creerDossier(fake.client as never, "x")).error).not.toBeNull();
    expect((await renommerDossier(fake.client as never, DOSSIER, "x")).error).not.toBeNull();
    expect((await supprimerDossier(fake.client as never, DOSSIER)).error).not.toBeNull();
  });
});
