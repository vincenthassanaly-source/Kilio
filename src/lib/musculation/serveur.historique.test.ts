// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ecritures, fauxSupabase, type Appel, type Reponse } from "@/test/fake-supabase";
import { lireEntrainement, listerEntrainements, supprimerEntrainement } from "./serveur";

const EXO = "11111111-1111-4111-8111-111111111111";

describe("listerEntrainements", () => {
  it("calcule exercices, séries et volume de chaque séance, dans l'ordre reçu", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "entrainements") {
        return {
          data: [
            { id: "e2", titre: "Pull", date: "2026-10-14", duree_s: 3000, debut_at: "x" },
            { id: "e1", titre: "Push", date: "2026-10-12", duree_s: 3600, debut_at: "x" },
          ],
        };
      }
      if (a.table === "entrainement_exercices") {
        return { data: [{ id: "l1", entrainement_id: "e1" }, { id: "l2", entrainement_id: "e1" }, { id: "l3", entrainement_id: "e2" }] };
      }
      if (a.table === "entrainement_series") {
        const s = (ligne: string, type: string, poids: number, reps: number) => ({
          entrainement_exercice_id: ligne, ordre: 0, type_serie: type, poids_kg: poids, reps, duree_s: null, distance_m: null,
        });
        return { data: [s("l1", "echauffement", 40, 10), s("l1", "normale", 80, 8), s("l2", "normale", 50, 10)] };
      }
      return undefined;
    });

    const liste = await listerEntrainements(fake.client as never, 30);

    expect(liste.map((e) => [e.id, e.nbExercices, e.nbSeries, e.volume])).toEqual([
      ["e2", 1, 0, 0],
      ["e1", 2, 3, 1140],
    ]);
    const requete = fake.appels.find((a) => a.table === "entrainements")!;
    expect(requete.modificateurs).toContainEqual(["limit", 30]);
  });

  it("borne la limite et renvoie [] sans séance", async () => {
    const fake = fauxSupabase();
    expect(await listerEntrainements(fake.client as never, 100000)).toEqual([]);
    expect(fake.appels[0].modificateurs).toContainEqual(["limit", 200]);
    expect(fake.appels).toHaveLength(1);
  });

  it("lève l'erreur de la base", async () => {
    const fake = fauxSupabase(() => ({ error: { message: "boom" } }));
    await expect(listerEntrainements(fake.client as never, 10)).rejects.toThrow("boom");
  });
});

describe("lireEntrainement", () => {
  it("assemble la séance avec son type planifié, en ignorant un exercice disparu", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "entrainements") {
        return {
          data: { id: "e1", titre: "Push", date: "2026-10-12", debut_at: "d", fin_at: "f", duree_s: 3600, seance_id: "s1", routine_id: null },
        };
      }
      if (a.table === "entrainement_exercices") {
        return { data: [{ id: "l1", exercice_id: EXO, ordre: 0, repos_s: 60 }, { id: "l2", exercice_id: "disparu", ordre: 1, repos_s: null }] };
      }
      if (a.table === "exercices") return { data: [{ id: EXO, nom: "Développé couché", mode_saisie: "poids_reps" }] };
      if (a.table === "entrainement_series") {
        return { data: [{ entrainement_exercice_id: "l1", ordre: 0, type_serie: "normale", poids_kg: 80, reps: 8, duree_s: null, distance_m: null }] };
      }
      if (a.table === "seances") return { data: { type: "PUSH" } };
      return undefined;
    });

    const detail = await lireEntrainement(fake.client as never, "e1");

    expect(detail).toEqual({
      id: "e1",
      titre: "Push",
      date: "2026-10-12",
      debutA: "d",
      finA: "f",
      dureeS: 3600,
      seanceId: "s1",
      routineId: null,
      typeSeance: "PUSH",
      exercices: [
        {
          cle: "l1",
          exerciceId: EXO,
          nom: "Développé couché",
          mode: "poids_reps",
          reposS: 60,
          series: [{ type: "normale", poids: 80, reps: 8, duree: null, distance: null }],
        },
      ],
    });
  });

  it("renvoie null pour une séance introuvable", async () => {
    expect(await lireEntrainement(fauxSupabase().client as never, "e1")).toBeNull();
  });
});

describe("supprimerEntrainement", () => {
  it("supprime par identifiant et remonte un échec", async () => {
    const fake = fauxSupabase();
    expect(await supprimerEntrainement(fake.client as never, "e1")).toEqual({ error: null });
    expect(ecritures(fake.appels, "entrainements", "delete")[0].filtres).toContainEqual(["eq", "id", "e1"]);
    const ko = fauxSupabase(() => ({ error: { message: "boom" } }));
    expect((await supprimerEntrainement(ko.client as never, "e1")).error).not.toBeNull();
  });
});
