// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { enregistrerMesure, getMesuresRecentes, getSyntheseSemaine, supprimerMesure } from "./sante";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

// Dimanche 2026-10-11, midi à Paris : la semaine va du 5 au 11.
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("enregistrerMesure", () => {
  it("enregistre le poids arrondi sans toucher au tour de taille déjà saisi", async () => {
    const fake = brancher();
    expect(await enregistrerMesure({ date: "2026-10-11", poidsKg: 82.44, tourTailleCm: null })).toEqual({ ok: true, data: undefined });
    const [upsert] = ecritures(fake.appels, "mesures_corps", "upsert");
    expect(upsert.payload).toEqual({ date: "2026-10-11", poids_kg: 82.4 });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/bilan");
    expect(etat.revalidatePath).toHaveBeenCalledWith("/revue");
  });

  it("enregistre les deux valeurs d'un coup", async () => {
    const fake = brancher();
    await enregistrerMesure({ date: "2026-10-10", poidsKg: 82.4, tourTailleCm: 91.25 });
    expect(ecritures(fake.appels, "mesures_corps", "upsert")[0].payload).toEqual({
      date: "2026-10-10",
      poids_kg: 82.4,
      tour_taille_cm: 91.3,
    });
  });

  it.each([
    ["date invalide", { date: "hier", poidsKg: 82, tourTailleCm: null }, "Date invalide."],
    ["date future", { date: "2026-10-12", poidsKg: 82, tourTailleCm: null }, "Un relevé ne peut pas être daté dans le futur."],
    ["rien de saisi", { date: "2026-10-11", poidsKg: null, tourTailleCm: null }, "Saisis ton poids ou ton tour de taille."],
    ["poids trop bas", { date: "2026-10-11", poidsKg: 8, tourTailleCm: null }, "Le poids doit être compris entre 30 et 300 kg."],
    ["poids NaN", { date: "2026-10-11", poidsKg: Number.NaN, tourTailleCm: null }, "Le poids doit être compris entre 30 et 300 kg."],
    ["taille trop haute", { date: "2026-10-11", poidsKg: null, tourTailleCm: 400 }, "Le tour de taille doit être compris entre 40 et 250 cm."],
  ])("refuse : %s", async (_nom, input, erreur) => {
    const fake = brancher();
    expect(await enregistrerMesure(input)).toEqual({ ok: false, error: erreur });
    expect(ecritures(fake.appels, "mesures_corps")).toHaveLength(0);
  });

  it("renvoie une erreur lisible si l'écriture échoue", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await enregistrerMesure({ date: "2026-10-11", poidsKg: 82, tourTailleCm: null })).toEqual({
      ok: false,
      error: "Le relevé n'a pas pu être enregistré. Réessaie.",
    });
  });
});

describe("supprimerMesure / getMesuresRecentes", () => {
  it("supprime le relevé de la date", async () => {
    const fake = brancher();
    expect(await supprimerMesure("2026-10-11")).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "mesures_corps", "delete")[0].filtres).toContainEqual(["eq", "date", "2026-10-11"]);
    expect(await supprimerMesure("nope")).toEqual({ ok: false, error: "Date invalide." });
  });

  it("normalise les numeric renvoyés en chaîne, ou lève l'erreur", async () => {
    const fake = brancher(() => ({ data: [{ date: "2026-10-11", poids_kg: "82.40", tour_taille_cm: null }] }));
    expect(await getMesuresRecentes(3)).toEqual([{ date: "2026-10-11", poids_kg: 82.4, tour_taille_cm: null }]);
    expect(fake.appels[0].modificateurs).toContainEqual(["limit", 3]);

    brancher(() => ({ error: { message: "ko" } }));
    await expect(getMesuresRecentes()).rejects.toThrow("ko");
  });
});

describe("getSyntheseSemaine", () => {
  const aliment = { kcal_100g: 100, proteines_100g: 10, glucides_100g: 0, lipides_100g: 0 };
  const repas = (date: string, quantite: number) => ({ date, quantite, aliment, recette: null });

  it("assemble kcal moyens, séances, poids lissé et tour de taille", async () => {
    brancher((a) => {
      if (a.table === "objectifs_nutritionnels") {
        return { data: [{ jour_type: "repos", kcal_cible: 2000, proteines_cible_g: 100, glucides_cible_g: 0, lipides_cible_g: 0 }] };
      }
      // 1800 kcal le 8, 2200 le 9 (limite 2000) ; le 11 (aujourd'hui) est en cours.
      if (a.table === "journal_repas") return { data: [repas("2026-10-08", 1800), repas("2026-10-09", 2200), repas("2026-10-11", 500)] };
      // Semaine du 5 au 11 : Push fait via sa routine, Pull fait en séance libre, Legs pas fait.
      if (a.table === "routines") {
        return { data: [{ id: "r1", nom: "Push A", type_seance: "PUSH" }, { id: "r2", nom: "Legs A", type_seance: "LEGS" }] };
      }
      if (a.table === "entrainements") {
        return { data: [{ routine_id: "r1", type_seance: "PUSH", date: "2026-10-06" }, { routine_id: null, type_seance: "PULL", date: "2026-10-08" }] };
      }
      if (a.table === "mesures_corps") {
        return {
          data: [
            { date: "2026-10-04", poids_kg: "83.00", tour_taille_cm: "92.0" },
            { date: "2026-10-11", poids_kg: "82.40", tour_taille_cm: "91.0" },
          ],
        };
      }
      return undefined; // jours_entrainement, jours_libres : rien
    });

    const synthese = await getSyntheseSemaine("2026-10-11");

    expect(synthese.kcal).toEqual({ moyenne: 2000, cibleMoyenne: 2000, nbJours: 2, nbDansLimite: 1 });
    expect(synthese.seances).toEqual({ faites: 2, total: 3 });
    expect(synthese.poids).toEqual({ actuel: 82.4, delta: -0.6, ageJours: 0 });
    expect(synthese.taille).toEqual({ actuel: 91, delta: -1, ageJours: 0 });
    expect(synthese.derniereMesure).toBe("2026-10-11");
  });

  it("n'évalue pas un jour libre, et reste vide sans données", async () => {
    brancher((a) => {
      if (a.table === "objectifs_nutritionnels") {
        return { data: [{ jour_type: "repos", kcal_cible: 2000, proteines_cible_g: 100, glucides_cible_g: 0, lipides_cible_g: 0 }] };
      }
      if (a.table === "journal_repas") return { data: [repas("2026-10-09", 4000)] };
      if (a.table === "jours_libres") return { data: [{ date: "2026-10-09" }] };
      return undefined;
    });
    expect(await getSyntheseSemaine("2026-10-11")).toEqual({
      kcal: null,
      seances: { faites: 0, total: 3 },
      poids: null,
      taille: null,
      derniereMesure: null,
    });
  });

  it("rejette une date invalide et propage une erreur de lecture", async () => {
    brancher();
    await expect(getSyntheseSemaine("demain")).rejects.toThrow("Date invalide.");
    brancher((a) => (a.table === "mesures_corps" ? { error: { message: "ko" } } : undefined));
    await expect(getSyntheseSemaine("2026-10-11")).rejects.toThrow("ko");
  });
});
