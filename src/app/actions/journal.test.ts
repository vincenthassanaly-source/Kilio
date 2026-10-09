// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  addJournalEntry,
  getCatalogueJournal,
  getDatesEntrainement,
  getResumeNutritionJour,
  removeJournalEntry,
} from "./journal";

const ID = "11111111-1111-4111-8111-111111111111";
const ALIMENT = "22222222-2222-4222-8222-222222222222";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function form(champs: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

const saisieAliment = { type: "aliment", aliment_id: ALIMENT, quantite: "150", date: "2026-10-09", moment: "dejeuner" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("addJournalEntry : validation", () => {
  it.each([
    ["type inconnu", { ...saisieAliment, type: "boisson" }, "Type d'entrée invalide."],
    ["date invalide", { ...saisieAliment, date: "09/10/2026" }, "Date invalide."],
    ["moment invalide", { ...saisieAliment, moment: "brunch" }, "Moment du repas invalide."],
    ["quantité nulle", { ...saisieAliment, quantite: "0" }, "La quantité doit être un nombre positif."],
    ["quantité absente", { ...saisieAliment, quantite: "" }, "La quantité doit être un nombre positif."],
    ["aliment manquant", { ...saisieAliment, aliment_id: "" }, "Aliment requis."],
    ["recette manquante", { ...saisieAliment, type: "recette", recette_id: "" }, "Recette requise."],
    ["mode de saisie inconnu", { ...saisieAliment, saisie_mode: "tasse" }, "Mode de saisie invalide."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await addJournalEntry({ error: null }, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("addJournalEntry", () => {
  it("ajoute un aliment en grammes et revalide le journal et l'accueil", async () => {
    const fake = brancher();

    expect(await addJournalEntry({ error: null }, form(saisieAliment))).toEqual({ error: null, ok: true });

    expect(ecritures(fake.appels, "journal_repas", "insert")[0].payload).toEqual({
      aliment_id: ALIMENT,
      recette_id: null,
      quantite: 150,
      date: "2026-10-09",
      moment: "dejeuner",
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/journal");
    expect(etat.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("ajoute une recette (portions) sans aliment", async () => {
    const fake = brancher();
    await addJournalEntry(
      { error: null },
      form({ type: "recette", recette_id: ID, quantite: "0.5", date: "2026-10-09", moment: "diner" })
    );
    expect(ecritures(fake.appels, "journal_repas", "insert")[0].payload).toMatchObject({
      aliment_id: null,
      recette_id: ID,
      quantite: 0.5,
    });
  });

  it("prend la date du jour (Paris) quand elle est absente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    const fake = brancher();
    const sansDate: Record<string, string> = { ...saisieAliment };
    delete sansDate.date;
    await addJournalEntry({ error: null }, form(sansDate));
    expect(ecritures(fake.appels, "journal_repas", "insert")[0].payload).toMatchObject({ date: "2026-10-09" });
  });

  it("convertit des pièces en grammes avec le poids par pièce de l'aliment", async () => {
    const fake = brancher((a) => (a.table === "aliments" ? { data: { poids_unite_g: 60 } } : undefined));
    await addJournalEntry({ error: null }, form({ ...saisieAliment, saisie_mode: "piece", quantite: "2" }));
    expect(ecritures(fake.appels, "journal_repas", "insert")[0].payload).toMatchObject({ quantite: 120 });
  });

  it("refuse la saisie en pièces sans poids par pièce, ou pour un aliment introuvable", async () => {
    const fake = brancher((a) => (a.table === "aliments" ? { data: { poids_unite_g: null } } : undefined));
    expect(await addJournalEntry({ error: null }, form({ ...saisieAliment, saisie_mode: "piece" }))).toEqual({
      error: "Cet aliment n'a pas de poids par pièce défini : saisis une quantité en grammes.",
    });
    expect(ecritures(fake.appels, "journal_repas")).toHaveLength(0);

    brancher((a) => (a.table === "aliments" ? { error: { message: "absent" } } : undefined));
    expect(await addJournalEntry({ error: null }, form({ ...saisieAliment, saisie_mode: "piece" }))).toEqual({
      error: "Aliment introuvable.",
    });
  });

  it("renvoie un message lisible (pas l'erreur brute) si l'insertion échoue", async () => {
    brancher(() => ({ error: { message: "violates foreign key constraint" } }));
    expect(await addJournalEntry({ error: null }, form(saisieAliment))).toEqual({
      error: "Le repas n'a pas pu être ajouté. Réessaie.",
    });
    expect(etat.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removeJournalEntry", () => {
  it("supprime l'entrée et revalide, ou lève l'erreur", async () => {
    const fake = brancher();
    await removeJournalEntry(ID);
    expect(ecritures(fake.appels, "journal_repas", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/journal");

    brancher(() => ({ error: { message: "ko" } }));
    await expect(removeJournalEntry(ID)).rejects.toThrow("ko");
  });
});

describe("getDatesEntrainement", () => {
  it("renvoie les dates entraînées de la plage", async () => {
    const fake = brancher(() => ({ data: [{ date: "2026-10-05" }, { date: "2026-10-07" }] }));
    expect(await getDatesEntrainement("2026-10-01", "2026-10-31")).toEqual(["2026-10-05", "2026-10-07"]);
    expect(fake.appels[0].filtres).toContainEqual(["eq", "entraine", true]);
  });

  it("renvoie [] sans données et lève sur erreur", async () => {
    brancher();
    expect(await getDatesEntrainement("a", "b")).toEqual([]);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getDatesEntrainement("a", "b")).rejects.toThrow("ko");
  });
});

describe("getResumeNutritionJour", () => {
  const aliment = { kcal_100g: 200, proteines_100g: 10, glucides_100g: 20, lipides_100g: 5 };

  it("somme les entrées, ignore les entrées orphelines et lit l'objectif du bon type de jour", async () => {
    const fake = brancher((a) => {
      if (a.table === "jours_entrainement") return { data: [{ date: "2026-10-09" }] };
      if (a.table === "objectifs_nutritionnels") {
        return { data: { kcal_cible: 2500, proteines_cible_g: 150, glucides_cible_g: 300, lipides_cible_g: 70 } };
      }
      if (a.table === "journal_repas") {
        return {
          data: [
            { quantite: 150, aliment, recette: null },
            { quantite: 50, aliment, recette: null },
            { quantite: 1, aliment: null, recette: null }, // orpheline
          ],
        };
      }
      return undefined;
    });

    const res = await getResumeNutritionJour("2026-10-09");

    expect(res.jourType).toBe("entrainement");
    expect(res.consomme).toEqual({ kcal: 400, proteines: 20, glucides: 40, lipides: 10 });
    expect(res.kcalGoal).toBe(2500);
    expect(res.macroGoals).toEqual({ proteines: 150, glucides: 300, lipides: 70 });
    const objectif = fake.appels.find((a) => a.table === "objectifs_nutritionnels")!;
    expect(objectif.filtres).toContainEqual(["eq", "jour_type", "entrainement"]);
  });

  it("utilise la valeur de la recette quand elle est saisie, sinon calcule depuis ses ingrédients", async () => {
    brancher((a) => {
      if (a.table === "journal_repas") {
        return {
          data: [
            {
              quantite: 2,
              aliment: null,
              recette: { portions: 4, kcal_portion: 300, proteines_portion: 20, glucides_portion: 30, lipides_portion: 10, recette_ingredients: [] },
            },
            {
              quantite: 1,
              aliment: null,
              recette: {
                portions: 2,
                kcal_portion: null,
                proteines_portion: null,
                glucides_portion: null,
                lipides_portion: null,
                recette_ingredients: [{ quantite: 100, aliment }],
              },
            },
          ],
        };
      }
      return undefined;
    });

    const res = await getResumeNutritionJour("2026-10-10");

    expect(res.jourType).toBe("repos");
    // 2 portions à 300 kcal + 1 portion de (200 kcal / 2 portions)
    expect(res.consomme.kcal).toBe(700);
  });

  it("n'invente aucune cible quand rien n'est défini pour ce type de jour", async () => {
    brancher();
    const res = await getResumeNutritionJour("2026-10-09");
    expect(res.kcalGoal).toBeNull();
    expect(res.macroGoals).toBeNull();
    expect(res.consomme).toEqual({ kcal: 0, proteines: 0, glucides: 0, lipides: 0 });
  });
});

describe("getCatalogueJournal", () => {
  it("assemble aliments, recettes et récents", async () => {
    brancher((a) => {
      if (a.table === "aliments") {
        return {
          data: [{ id: ALIMENT, nom: "Riz", categorie: "féculents", unite: null, poids_unite_g: null, kcal_100g: 130, proteines_100g: 3, glucides_100g: 28, lipides_100g: 0.3 }],
        };
      }
      if (a.table === "recettes") {
        return {
          data: [{ id: ID, nom: "Curry", portions: 2, kcal_portion: 500, proteines_portion: 30, glucides_portion: 50, lipides_portion: 20, recette_ingredients: [] }],
        };
      }
      if (a.table === "journal_repas") {
        return { data: [{ aliment_id: ALIMENT, recette_id: null, quantite: 100, moment: "dejeuner" }] };
      }
      return undefined;
    });

    const res = await getCatalogueJournal();

    expect(res.items.map((i) => [i.type, i.nom])).toEqual([["aliment", "Riz"], ["recette", "Curry"]]);
    expect(res.items[0]).toMatchObject({ par100: { kcal: 130 } });
    expect(res.items[1]).toMatchObject({ parPortion: { kcal: 500 } });
    expect(res.recents.length).toBeGreaterThan(0);
  });

  it("lève une erreur générique si aliments ou recettes sont illisibles", async () => {
    brancher((a) => (a.table === "aliments" ? { error: { message: "ko" } } : undefined));
    await expect(getCatalogueJournal()).rejects.toThrow("Catalogue indisponible.");
    brancher((a) => (a.table === "recettes" ? { error: { message: "ko" } } : undefined));
    await expect(getCatalogueJournal()).rejects.toThrow("Catalogue indisponible.");
  });
});
