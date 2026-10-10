// Module Courses : ajouter des articles et en cocher un. On vérifie l'écran et
// les écritures reçues par le faux Supabase.
//
// Isolation : le cache serveur des courses survit à la remise à zéro du faux
// Supabase (y compris d'un projet bureau/mobile à l'autre) : chaque test utilise
// ses propres articles, sous un nom unique, et n'affirme ni liste vide ni
// compteur global.
import { test, expect, type Page } from "@playwright/test";
import { ecritures, reinitialiserMock } from "./ecritures";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await reinitialiserMock();
});

const nom = (base: string) => `${base} ${test.info().project.name}`;

const ligne = (page: Page, libelle: string) => page.getByRole("listitem").filter({ hasText: libelle });

async function ouvrirAjout(page: Page) {
  await page.goto("/courses");
  await page.getByRole("button", { name: /Ajouter un article/ }).first().click();
}

async function ajouterArticle(page: Page, libelle: string) {
  await page.getByRole("combobox", { name: /Ex\. lait/ }).fill(libelle);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  // Attend la ligne définitive : pendant ~150 ms après l'ajout, l'article est
  // affiché en double (voir le test « fixme » plus bas).
  await expect(ligne(page, libelle)).toHaveCount(1);
  await expect(page.getByRole("button", { name: `Renommer « ${libelle} »` })).toBeEnabled();
}

test("ajoute un article à la liste", async ({ page }) => {
  const libelle = nom("Lait");
  await ouvrirAjout(page);
  await ajouterArticle(page, libelle);

  await expect(page.getByText(`« ${libelle} » ajouté`)).toBeVisible();
  await expect
    .poll(async () => (await ecritures("courses_items", "POST")).some((a) => a.libelle === libelle))
    .toBe(true);
});

test("ajoute plusieurs articles à la suite", async ({ page }) => {
  const pain = nom("Pain");
  const farine = nom("Farine");
  await ouvrirAjout(page);
  await ajouterArticle(page, pain);
  await ajouterArticle(page, farine);

  await expect(ligne(page, pain)).toBeVisible();
  await expect(ligne(page, farine)).toBeVisible();
  await expect
    .poll(async () => (await ecritures("courses_items", "POST")).map((a) => a.libelle).sort())
    .toEqual([farine, pain].sort());
});

// DÉFAUT CONNU (constaté à la main, ~150 ms avec 400 ms de latence réseau) :
// juste après un ajout, l'article apparaît deux fois — la ligne optimiste
// « En attente de synchro » (id temp-…) ET la ligne réelle — avant que le
// refetch ne retire la ligne optimiste. Le doublon disparaît seul ; à corriger
// dans AddCourseForm / CoursesList sans casser le mode hors ligne. Retirer
// `fixme` une fois corrigé.
test.fixme("n'affiche jamais un article en double après l'ajout", async ({ page }) => {
  const libelle = nom("Yaourt");
  await ouvrirAjout(page);
  await page.getByRole("combobox", { name: /Ex\. lait/ }).fill(libelle);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  const maxLignes = await page.evaluate(async (texte) => {
    let max = 0;
    const debut = performance.now();
    while (performance.now() - debut < 3000) {
      max = Math.max(max, [...document.querySelectorAll("li")].filter((li) => li.textContent?.includes(texte)).length);
      await new Promise((r) => setTimeout(r, 25));
    }
    return max;
  }, libelle);

  expect(maxLignes).toBe(1);
});

test("coche un article : l'état est enregistré", async ({ page }) => {
  const libelle = nom("Beurre");
  await ouvrirAjout(page);
  await ajouterArticle(page, libelle);
  // Attend que l'article soit confirmé par le serveur (id définitif) avant de le cocher.
  await expect.poll(async () => (await ecritures("courses_items", "POST")).length).toBe(1);

  const case_ = ligne(page, libelle).getByRole("button", { name: "Cocher l'article" });
  await expect(case_).toBeEnabled();
  await case_.click();

  await expect
    .poll(async () => (await ecritures("courses_items", "PATCH")).some((a) => a.coche === true))
    .toBe(true);
});
