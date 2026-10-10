// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath, updateTag: etat.updateTag }));
vi.mock("next/navigation", () => ({ redirect: etat.redirect }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { createRecette, deleteRecette, updateRecette } from "./recettes";
import { addEtape, removeEtape, updateEtape } from "./recette-etapes";
import { addIngredient, removeIngredient, updateIngredient } from "./recette-ingredients";
import { addIngredientLibre, removeIngredientLibre, updateIngredientLibre } from "./recette-ingredients-libres";

const ID = "11111111-1111-4111-8111-111111111111";
const RECETTE = "22222222-2222-4222-8222-222222222222";
const ALIMENT = "33333333-3333-4333-8333-333333333333";

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

// Une écriture « count: exact » qui n'a touché aucune ligne (recette partagée,
// protégée par la base) renvoie count = 0.
const ligneTouchee: Repondre = () => ({ count: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  etat.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("createRecette : validation", () => {
  it.each([
    ["nom vide", { nom: " " }, "Le nom est requis."],
    ["source inconnue", { nom: "Curry", source: "marmiton" }, "Source invalide."],
    ["portions nulles", { nom: "Curry", portions: "0" }, "Le nombre de portions doit être un entier positif."],
    ["portions décimales", { nom: "Curry", portions: "2.5" }, "Le nombre de portions doit être un entier positif."],
    ["temps négatif", { nom: "Curry", temps_prepa_min: "-5" }, "Le temps de préparation doit être un entier positif."],
    ["temps décimal", { nom: "Curry", temps_prepa_min: "1.5" }, "Le temps de préparation doit être un entier positif."],
    ["nutrition négative", { nom: "Curry", kcal_portion: "-1" }, "Les valeurs nutritionnelles doivent être des nombres positifs."],
    ["nutrition non numérique", { nom: "Curry", sel_100g: "beaucoup" }, "Les valeurs nutritionnelles doivent être des nombres positifs."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await createRecette({ error: null }, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("createRecette", () => {
  it("enregistre la recette normalisée puis redirige vers sa fiche", async () => {
    const fake = brancher((a) => (a.action === "insert" ? { data: { id: RECETTE } } : undefined));

    await expect(
      createRecette(
        { error: null },
        form({
          nom: " Curry ",
          description: " Doux ",
          temps_prepa_min: "30",
          portions: "4",
          source: "hellofresh",
          ustensiles: "casserole\n\n  poêle  \n",
          kcal_portion: "550",
          sel_100g: "0.8",
        })
      )
    ).rejects.toThrow(`REDIRECT:/nutrition/recettes/${RECETTE}`);

    const payload = ecritures(fake.appels, "recettes", "insert")[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      nom: "Curry",
      description: "Doux",
      temps_prepa_min: 30,
      portions: 4,
      source: "hellofresh",
      ustensiles: ["casserole", "poêle"],
      kcal_portion: 550,
      sel_100g: 0.8,
      proteines_portion: null,
      fibres_100g: null,
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/recettes");
    expect(etat.updateTag).toHaveBeenCalledWith("recettes");
  });

  it("utilise une portion, la source manuelle et des champs vides à null par défaut", async () => {
    const fake = brancher((a) => (a.action === "insert" ? { data: { id: RECETTE } } : undefined));
    await expect(createRecette({ error: null }, form({ nom: "Salade" }))).rejects.toThrow("REDIRECT");
    expect(ecritures(fake.appels, "recettes", "insert")[0].payload).toMatchObject({
      portions: 1,
      source: "manuel",
      description: null,
      temps_prepa_min: null,
      ustensiles: null,
    });
  });

  it("accepte le zéro pour une valeur nutritionnelle", async () => {
    const fake = brancher((a) => (a.action === "insert" ? { data: { id: RECETTE } } : undefined));
    await expect(createRecette({ error: null }, form({ nom: "Eau", kcal_100g: "0" }))).rejects.toThrow("REDIRECT");
    expect(ecritures(fake.appels, "recettes", "insert")[0].payload).toMatchObject({ kcal_100g: 0 });
  });

  it("renvoie l'erreur Supabase sans rediriger ni expirer le cache", async () => {
    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await createRecette({ error: null }, form({ nom: "x" }))).toEqual({ error: "ko" });
    expect(etat.redirect).not.toHaveBeenCalled();
    expect(etat.updateTag).not.toHaveBeenCalled();
  });
});

describe("updateRecette", () => {
  it("refuse sans id ou avec une saisie invalide", async () => {
    brancher();
    expect(await updateRecette({ error: null }, form({ nom: "x" }))).toEqual({ error: "Recette introuvable." });
    expect(await updateRecette({ error: null }, form({ id: ID, nom: "" }))).toEqual({ error: "Le nom est requis." });
  });

  it("met à jour la recette ciblée et revalide sa fiche", async () => {
    const fake = brancher(ligneTouchee);
    expect(await updateRecette({ error: null }, form({ id: ID, nom: "Curry" }))).toEqual({ error: null });
    const [maj] = ecritures(fake.appels, "recettes", "update");
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/nutrition/recettes/${ID}`);
    expect(etat.updateTag).toHaveBeenCalledWith("recettes");
  });

  it("explique qu'une recette partagée n'est pas modifiable quand aucune ligne n'est touchée", async () => {
    brancher();
    expect(await updateRecette({ error: null }, form({ id: ID, nom: "Curry" }))).toEqual({
      error: "Modification impossible : cette recette est partagée et non modifiable.",
    });
    expect(etat.updateTag).not.toHaveBeenCalled();
  });

  it("renvoie l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await updateRecette({ error: null }, form({ id: ID, nom: "x" }))).toEqual({ error: "ko" });
  });
});

describe("deleteRecette", () => {
  it("supprime la recette puis redirige vers la liste", async () => {
    const fake = brancher(ligneTouchee);
    await expect(deleteRecette(ID)).rejects.toThrow("REDIRECT:/nutrition/recettes");
    expect(ecritures(fake.appels, "recettes", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
    expect(etat.updateTag).toHaveBeenCalledWith("recettes");
  });

  it("refuse de supprimer une recette partagée, sans rediriger", async () => {
    brancher();
    await expect(deleteRecette(ID)).rejects.toThrow("cette recette est partagée et non modifiable");
    expect(etat.redirect).not.toHaveBeenCalled();
  });

  it("lève l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(deleteRecette(ID)).rejects.toThrow("ko");
  });
});

describe("étapes", () => {
  it("addEtape exige une recette et une consigne", async () => {
    const fake = brancher();
    expect(await addEtape({ error: null }, form({ consigne: "Mélanger" }))).toEqual({ error: "La consigne est requise." });
    expect(await addEtape({ error: null }, form({ recette_id: RECETTE, consigne: " " }))).toEqual({
      error: "La consigne est requise.",
    });
    expect(fake.appels).toHaveLength(0);
  });

  it("addEtape calcule l'ordre côté serveur, à la suite de la dernière étape", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 2 } } : undefined));
    expect(
      await addEtape({ error: null }, form({ recette_id: RECETTE, titre: " Cuisson ", consigne: " Mélanger ", astuce: "" }))
    ).toEqual({ error: null });
    expect(ecritures(fake.appels, "recette_etapes", "insert")[0].payload).toEqual({
      recette_id: RECETTE,
      titre: "Cuisson",
      consigne: "Mélanger",
      astuce: null,
      ordre: 3,
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/nutrition/recettes/${RECETTE}`);
  });

  it("addEtape commence à 0 et renvoie l'erreur Supabase", async () => {
    const fake = brancher();
    await addEtape({ error: null }, form({ recette_id: RECETTE, consigne: "x" }));
    expect(ecritures(fake.appels, "recette_etapes", "insert")[0].payload).toMatchObject({ ordre: 0, titre: null });

    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await addEtape({ error: null }, form({ recette_id: RECETTE, consigne: "x" }))).toEqual({ error: "ko" });
  });

  it("updateEtape nettoie les champs, refuse une consigne vide et une étape introuvable", async () => {
    await expect(updateEtape(ID, RECETTE, "t", "  ", "a")).rejects.toThrow("La consigne est requise.");

    const fake = brancher(ligneTouchee);
    await updateEtape(ID, RECETTE, " ", " Cuire ", " vite ");
    expect(ecritures(fake.appels, "recette_etapes", "update")[0].payload).toEqual({ titre: null, consigne: "Cuire", astuce: "vite" });

    brancher();
    await expect(updateEtape(ID, RECETTE, "", "x", "")).rejects.toThrow("Modification impossible : cette étape est introuvable.");
    brancher(() => ({ error: { message: "ko" } }));
    await expect(updateEtape(ID, RECETTE, "", "x", "")).rejects.toThrow("ko");
  });

  it("removeEtape supprime l'étape, signale une étape introuvable et lève sur erreur", async () => {
    const fake = brancher(ligneTouchee);
    await removeEtape(ID, RECETTE);
    expect(ecritures(fake.appels, "recette_etapes", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);

    brancher();
    await expect(removeEtape(ID, RECETTE)).rejects.toThrow("Suppression impossible : cette étape est introuvable.");
    brancher(() => ({ error: { message: "ko" } }));
    await expect(removeEtape(ID, RECETTE)).rejects.toThrow("ko");
  });
});

describe("ingrédients du catalogue", () => {
  const saisie = { recette_id: RECETTE, aliment_id: ALIMENT, quantite: "150", unite: "g" };

  it("addIngredient valide l'aliment et la quantité", async () => {
    const fake = brancher();
    expect(await addIngredient({ error: null }, form({ ...saisie, aliment_id: "" }))).toEqual({ error: "Aliment requis." });
    expect(await addIngredient({ error: null }, form({ ...saisie, quantite: "0" }))).toEqual({
      error: "La quantité doit être un nombre positif.",
    });
    expect(await addIngredient({ error: null }, form({ ...saisie, quantite: "" }))).toEqual({
      error: "La quantité doit être un nombre positif.",
    });
    expect(fake.appels).toHaveLength(0);
  });

  it("addIngredient enregistre l'ingrédient et expire le cache des recettes", async () => {
    const fake = brancher();
    expect(await addIngredient({ error: null }, form(saisie))).toEqual({ error: null });
    expect(ecritures(fake.appels, "recette_ingredients", "insert")[0].payload).toEqual({
      recette_id: RECETTE,
      aliment_id: ALIMENT,
      quantite: 150,
      unite: "g",
    });
    expect(etat.updateTag).toHaveBeenCalledWith("recettes");
  });

  it("addIngredient explique un doublon d'aliment au lieu de l'erreur brute", async () => {
    brancher(() => ({ error: { message: "duplicate key", code: "23505" } }));
    expect(await addIngredient({ error: null }, form(saisie))).toEqual({
      error: "Cet aliment est déjà dans la recette : modifie sa quantité au lieu de le rajouter.",
    });
    brancher(() => ({ error: { message: "autre erreur", code: "42P01" } }));
    expect(await addIngredient({ error: null }, form(saisie))).toEqual({ error: "autre erreur" });
    expect(etat.updateTag).not.toHaveBeenCalled();
  });

  it("updateIngredient valide la quantité, met à jour et signale une recette partagée", async () => {
    await expect(updateIngredient(ID, RECETTE, 0)).rejects.toThrow("La quantité doit être un nombre positif.");
    await expect(updateIngredient(ID, RECETTE, NaN)).rejects.toThrow("La quantité doit être un nombre positif.");

    const fake = brancher(ligneTouchee);
    await updateIngredient(ID, RECETTE, 200);
    expect(ecritures(fake.appels, "recette_ingredients", "update")[0].payload).toEqual({ quantite: 200 });
    expect(etat.updateTag).toHaveBeenCalledWith("recettes");

    brancher();
    await expect(updateIngredient(ID, RECETTE, 200)).rejects.toThrow("cette recette est partagée et non modifiable");
    brancher(() => ({ error: { message: "ko" } }));
    await expect(updateIngredient(ID, RECETTE, 200)).rejects.toThrow("ko");
  });

  it("removeIngredient supprime, signale une recette partagée et lève sur erreur", async () => {
    const fake = brancher(ligneTouchee);
    await removeIngredient(ID, RECETTE);
    expect(ecritures(fake.appels, "recette_ingredients", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);

    brancher();
    await expect(removeIngredient(ID, RECETTE)).rejects.toThrow("cette recette est partagée et non modifiable");
    brancher(() => ({ error: { message: "ko" } }));
    await expect(removeIngredient(ID, RECETTE)).rejects.toThrow("ko");
  });
});

describe("ingrédients libres", () => {
  it("addIngredientLibre exige une recette et un nom", async () => {
    const fake = brancher();
    expect(await addIngredientLibre({ error: null }, form({ nom: "Sel" }))).toEqual({ error: "Nom requis." });
    expect(await addIngredientLibre({ error: null }, form({ recette_id: RECETTE, nom: " " }))).toEqual({ error: "Nom requis." });
    expect(fake.appels).toHaveLength(0);
  });

  it("addIngredientLibre calcule l'ordre côté serveur et garde la quantité en texte libre", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 4 } } : undefined));
    expect(
      await addIngredientLibre({ error: null }, form({ recette_id: RECETTE, nom: " Sel ", quantite: " 1 pincée " }))
    ).toEqual({ error: null });
    expect(ecritures(fake.appels, "recette_ingredients_libres", "insert")[0].payload).toEqual({
      recette_id: RECETTE,
      nom: "Sel",
      quantite: "1 pincée",
      ordre: 5,
    });
    expect(etat.updateTag).toHaveBeenCalledWith("recettes");
  });

  it("addIngredientLibre commence à 0, met une quantité vide à null et renvoie l'erreur Supabase", async () => {
    const fake = brancher();
    await addIngredientLibre({ error: null }, form({ recette_id: RECETTE, nom: "Poivre" }));
    expect(ecritures(fake.appels, "recette_ingredients_libres", "insert")[0].payload).toMatchObject({ quantite: null, ordre: 0 });

    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await addIngredientLibre({ error: null }, form({ recette_id: RECETTE, nom: "x" }))).toEqual({ error: "ko" });
  });

  it("updateIngredientLibre nettoie les champs, refuse un nom vide et un ingrédient introuvable", async () => {
    await expect(updateIngredientLibre(ID, RECETTE, " ", "1")).rejects.toThrow("Le nom est requis.");

    const fake = brancher(ligneTouchee);
    await updateIngredientLibre(ID, RECETTE, " Sel ", "  ");
    expect(ecritures(fake.appels, "recette_ingredients_libres", "update")[0].payload).toEqual({ nom: "Sel", quantite: null });

    brancher();
    await expect(updateIngredientLibre(ID, RECETTE, "x", "")).rejects.toThrow("Modification impossible : cet ingrédient est introuvable.");
    brancher(() => ({ error: { message: "ko" } }));
    await expect(updateIngredientLibre(ID, RECETTE, "x", "")).rejects.toThrow("ko");
  });

  it("removeIngredientLibre supprime, signale un ingrédient introuvable et lève sur erreur", async () => {
    const fake = brancher(ligneTouchee);
    await removeIngredientLibre(ID, RECETTE);
    expect(ecritures(fake.appels, "recette_ingredients_libres", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);

    brancher();
    await expect(removeIngredientLibre(ID, RECETTE)).rejects.toThrow("Suppression impossible : cet ingrédient est introuvable.");
    brancher(() => ({ error: { message: "ko" } }));
    await expect(removeIngredientLibre(ID, RECETTE)).rejects.toThrow("ko");
  });
});
