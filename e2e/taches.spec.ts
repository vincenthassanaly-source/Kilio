// Module Tâches : créer, cocher, supprimer (avec « Annuler ») et filtrer depuis
// /taches. On vérifie à la fois l'écran et les écritures reçues par la base
// (e2e/mock-supabase.mjs).
//
// Isolation : le cache serveur des tâches (60 s de fraîcheur) survit à la remise
// à zéro du faux Supabase, y compris d'un projet (bureau/mobile) à l'autre. Chaque
// test crée donc SA tâche, sous un nom unique, et n'affirme rien sur la liste
// entière.
import { test, expect, type Page } from "@playwright/test";
import { ecritures, reinitialiserMock } from "./ecritures";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await reinitialiserMock();
});

/** Nom unique par projet : un résidu du cache d'un autre projet ne gêne pas. */
const nom = (base: string) => `${base} ${test.info().project.name}`;

const ligne = (page: Page, titre: string) => page.getByRole("listitem").filter({ hasText: titre });

async function creerTache(page: Page, titre: string) {
  await page.goto("/taches");
  await page.getByRole("button", { name: /Ajouter une tâche Nouvelle entrée/ }).click();
  await page.getByRole("textbox", { name: "Titre" }).fill(titre);
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(ligne(page, titre)).toBeVisible();
}

test("crée une tâche depuis le formulaire", async ({ page }) => {
  const titre = nom("Appeler le plombier");
  await creerTache(page, titre);

  await expect
    .poll(async () => (await ecritures("taches", "POST")).some((t) => t.titre === titre && t.liste_id !== undefined))
    .toBe(true);
});

test("le formulaire de création n'enregistre rien sans titre", async ({ page }) => {
  await page.goto("/taches");
  await page.getByRole("button", { name: /Ajouter une tâche Nouvelle entrée/ }).click();
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  // Le titre est requis : le formulaire reste ouvert et rien n'est envoyé.
  await expect(page.getByRole("textbox", { name: "Titre" })).toBeVisible();
  expect(await ecritures("taches", "POST")).toHaveLength(0);
});

test("annuler ferme le formulaire sans rien enregistrer", async ({ page }) => {
  const titre = nom("Brouillon abandonné");
  await page.goto("/taches");
  await page.getByRole("button", { name: /Ajouter une tâche Nouvelle entrée/ }).click();
  await page.getByRole("textbox", { name: "Titre" }).fill(titre);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();

  await expect(page.getByRole("textbox", { name: "Titre" })).toHaveCount(0);
  await expect(ligne(page, titre)).toHaveCount(0);
  expect(await ecritures("taches", "POST")).toHaveLength(0);
});

test("coche une tâche : l'état est enregistré", async ({ page }) => {
  const titre = nom("Relire le contrat");
  await creerTache(page, titre);
  // Attend que la tâche soit enregistrée avant de la cocher.
  await expect.poll(async () => (await ecritures("taches", "POST")).length).toBe(1);

  await ligne(page, titre).getByRole("button", { name: "Marquer fait" }).click();

  await expect
    .poll(async () => (await ecritures("taches", "PATCH")).some((t) => t.fait === true))
    .toBe(true);
});

test("supprime une tâche, puis « Annuler » la rétablit sans l'effacer de la base", async ({ page }) => {
  const titre = nom("Ranger le garage");
  await creerTache(page, titre);

  await ligne(page, titre).getByRole("button", { name: "Suppr." }).click();
  await expect(page.getByText(`« ${titre} » supprimée`)).toBeVisible();
  await expect(ligne(page, titre)).toHaveCount(0);

  await page.getByRole("button", { name: `Annuler la suppression de « ${titre} »` }).click();
  await expect(ligne(page, titre)).toBeVisible();
  expect(await ecritures("taches", "DELETE")).toHaveLength(0);
});

test("filtre les tâches avec la recherche", async ({ page }) => {
  const rapport = nom("Rapport trimestriel");
  const train = nom("Réserver le train");
  await creerTache(page, rapport);
  await creerTache(page, train);

  const recherche = page.getByRole("textbox", { name: "Rechercher une tâche…" });
  await recherche.fill("train");
  await expect(ligne(page, train)).toBeVisible();
  await expect(ligne(page, rapport)).toHaveCount(0);

  await recherche.fill("");
  await expect(ligne(page, rapport)).toBeVisible();
});
