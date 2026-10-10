// Module Notes : créer une note texte colorée et une checklist depuis /notes.
// On vérifie l'écran et les écritures reçues par le faux Supabase.
//
// Isolation : le cache serveur des notes survit à la remise à zéro du faux
// Supabase (y compris d'un projet bureau/mobile à l'autre) : chaque test crée sa
// note sous un nom unique et n'affirme rien sur la liste entière.
import { test, expect } from "@playwright/test";
import { ecritures, reinitialiserMock } from "./ecritures";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await reinitialiserMock();
});

const nom = (base: string) => `${base} ${test.info().project.name}`;

test("crée une note texte avec une couleur", async ({ page }) => {
  const titre = nom("Idées de voyage");
  await page.goto("/notes");

  await page.getByRole("button", { name: /Ajouter une note/ }).first().click();
  await page.getByRole("textbox", { name: "Titre" }).fill(titre);
  await page.getByRole("textbox", { name: "Contenu" }).fill("Lisbonne en mai");
  await page.getByRole("button", { name: "Sauge" }).click();
  await page.getByRole("button", { name: "Créer la note" }).click();

  await expect(page.getByRole("main").getByText(titre)).toBeVisible();
  await expect
    .poll(async () =>
      (await ecritures("notes", "POST")).some(
        (n) => n.titre === titre && n.contenu === "Lisbonne en mai" && n.type === "texte" && n.couleur === "sauge"
      )
    )
    .toBe(true);
});

test("crée une checklist avec ses éléments, dans l'ordre", async ({ page }) => {
  const titre = nom("Courses du week-end");
  await page.goto("/notes");
  await page.getByRole("button", { name: /Ajouter une note/ }).first().click();
  await page.getByRole("button", { name: "Checklist" }).click();
  await page.getByRole("textbox", { name: "Titre" }).fill(titre);

  const item = page.getByRole("textbox", { name: "Ajouter un item…" });
  await item.fill("Pain");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await item.fill("Lait");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  await page.getByRole("button", { name: "Créer la note" }).click();

  await expect(page.getByRole("main").getByText(titre)).toBeVisible();
  await expect
    .poll(async () => (await ecritures("note_items", "POST")).map((i) => [i.libelle, i.position]))
    .toEqual([["Pain", 0], ["Lait", 1]]);
});

test("annuler ferme le formulaire sans créer de note", async ({ page }) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: /Ajouter une note/ }).first().click();
  await page.getByRole("textbox", { name: "Titre" }).fill(nom("Brouillon"));
  await page.getByRole("button", { name: "Annuler", exact: true }).click();

  await expect(page.getByRole("textbox", { name: "Titre" })).toHaveCount(0);
  expect(await ecritures("notes", "POST")).toHaveLength(0);
});
