// Vague 1 de l'audit impeccable : le Journal Nutrition n'est plus en lecture
// seule. Saisie d'un repas depuis le Journal (recherche → quantité → ajout)
// et depuis la fiche recette (« Ajouter au journal »). Données :
// e2e/mock-supabase.mjs.
import { test, expect, type Page } from "@playwright/test";

const MOCK = process.env.E2E_SUPABASE_URL ?? "http://localhost:54321";

type Ecriture = { method: string; table: string; body: Record<string, unknown> | Record<string, unknown>[] };

async function insertionsJournal(): Promise<Record<string, unknown>[]> {
  const ecritures: Ecriture[] = await (await fetch(`${MOCK}/__writes`)).json();
  return ecritures
    .filter((w) => w.method === "POST" && w.table === "journal_repas")
    .flatMap((w) => (Array.isArray(w.body) ? w.body : [w.body]));
}

const main = (page: Page) => page.getByRole("main");

test.beforeEach(async () => {
  await fetch(`${MOCK}/__reset`);
});

test("Journal : rechercher un aliment, doser, ajouter", async ({ page }) => {
  await page.goto("/nutrition/journal");
  await expect(main(page).getByText("Skyr nature").first()).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un repas" }).click();
  const feuille = page.getByRole("dialog", { name: "Ajouter un repas" });
  await expect(feuille).toBeVisible();

  // Récents : les dernières saisies du journal sont proposées sans frappe.
  await expect(feuille.getByRole("heading", { name: "Récents" })).toBeVisible();

  await feuille.getByRole("searchbox", { name: "Rechercher un aliment ou une recette" }).fill("poulet");
  await feuille.getByRole("button", { name: /Blanc de poulet/ }).click();

  await feuille.getByRole("button", { name: "150" }).click();
  await feuille.getByRole("button", { name: "Dîner", exact: true }).click();
  await feuille.getByRole("button", { name: "Ajouter au dîner" }).click();

  await expect(page.getByText("« Blanc de poulet » ajouté au dîner")).toBeVisible();
  await expect(feuille).toHaveCount(0);
  await expect
    .poll(async () => (await insertionsJournal()).some((r) => r.quantite === 150 && r.moment === "diner"))
    .toBe(true);
});

test("Fiche recette : « Ajouter au journal » enregistre les portions", async ({ page }) => {
  await page.goto("/nutrition/recettes");
  await main(page).getByText("Curry de légumes HelloFresh").first().click();
  await expect(main(page).getByText("Portions consommées")).toBeVisible();

  await main(page).getByRole("button", { name: "Ajouter une portion" }).click();
  await main(page).getByRole("button", { name: "Déjeuner" }).click();
  await main(page).getByRole("button", { name: "Ajouter au journal" }).click();

  await expect(page.getByText(/2 portions de « Curry de légumes HelloFresh » ajoutées au déjeuner/)).toBeVisible();
  await expect
    .poll(async () => (await insertionsJournal()).some((r) => r.quantite === 2 && r.moment === "dejeuner" && r.recette_id))
    .toBe(true);
});
