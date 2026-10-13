import { describe, expect, it } from "vitest";
import { fauxSupabase, type Appel, type Reponse } from "@/test/fake-supabase";
import { lireSemaine } from "./serveur";

// Semaine du lundi 2026-10-12 au dimanche 2026-10-18.
const ROUTINES = [
  { id: "r-push-a", nom: "Push A", type_seance: "PUSH" },
  { id: "r-legs-a", nom: "Legs A", type_seance: "LEGS" },
  { id: "r-legs-b", nom: "Legs B", type_seance: "LEGS" },
];

describe("lireSemaine", () => {
  it("lit les entraînements de la semaine du jour donné, lundi à dimanche", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => (a.table === "routines" ? { data: ROUTINES } : undefined));

    await lireSemaine(fake.client as never, "2026-10-14");

    const lecture = fake.appels.find((a) => a.table === "entrainements");
    expect(lecture?.filtres).toContainEqual(["gte", "date", "2026-10-12"]);
    expect(lecture?.filtres).toContainEqual(["lte", "date", "2026-10-18"]);
  });

  it("coche la pastille de la routine suivie et le type, avec le nombre d'exercices", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "routines") return { data: ROUTINES };
      if (a.table === "routine_exercices") return { data: [{ routine_id: "r-legs-a" }, { routine_id: "r-legs-a" }] };
      if (a.table === "entrainements") return { data: [{ routine_id: "r-legs-a", type_seance: "LEGS", date: "2026-10-13" }] };
      return undefined;
    });

    const { groupes } = await lireSemaine(fake.client as never, "2026-10-14");

    expect(groupes.map((g) => [g.type, g.faite])).toEqual([
      ["PUSH", false],
      ["PULL", false],
      ["LEGS", true],
    ]);
    expect(groupes[2].routines).toEqual([
      { id: "r-legs-a", nom: "Legs A", pastille: "A", nbExercices: 2, faite: true },
      { id: "r-legs-b", nom: "Legs B", pastille: "B", nbExercices: 0, faite: false },
    ]);
  });

  it("lève l'erreur de lecture", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined => (a.table === "entrainements" ? { error: { message: "ko" } } : undefined));
    await expect(lireSemaine(fake.client as never, "2026-10-14")).rejects.toThrow("ko");
  });
});
