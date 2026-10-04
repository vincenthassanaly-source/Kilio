// Écran « Aujourd'hui » : frise du jour, tâche et événement fournis par
// e2e/mock-supabase.mjs, création d'un événement depuis l'écran.
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await fetch(`${process.env.E2E_SUPABASE_URL}/__reset`);
});

test("affiche l'événement, la tâche du jour et le résumé des repas", async ({ page }) => {
  await page.goto("/aujourdhui");

  await expect(page.getByRole("heading", { name: "Aujourd'hui", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Événement Rendez-vous e2e, de 09:00 à 10:00/ })).toBeVisible();
  await expect(page.getByText("Tâche e2e du jour")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repas" })).toBeVisible();
  // Aucune tâche en retard dans le jeu de données : pas de bandeau.
  await expect(page.getByRole("heading", { name: "En retard" })).toHaveCount(0);
});

test("ajoute un événement depuis la frise", async ({ page }) => {
  await page.goto("/aujourdhui");
  await page.getByRole("button", { name: "Événement", exact: true }).click();

  const dialogue = page.getByRole("dialog", { name: "Nouvel événement" });
  await expect(dialogue).toBeVisible();
  await dialogue.getByLabel("Titre").fill("Dentiste e2e");
  // Heure fixée : le défaut (prochaine demi-heure) dépendrait de l'heure du test.
  await dialogue.getByLabel("Heure").fill("11:00");
  await dialogue.getByLabel("Durée").selectOption("60");

  const action = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
  await dialogue.getByRole("button", { name: "Ajouter" }).click();
  expect((await action).ok()).toBe(true);

  await expect(dialogue).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Événement Dentiste e2e, de 11:00 à 12:00/ })).toBeVisible();
});

test("la barre « Aujourd'hui » est joignable depuis la grille Plus", async ({ page }) => {
  await page.goto("/plus");
  await page.locator('a[href="/aujourdhui"]').filter({ visible: true }).first().click();
  await page.waitForURL((u) => u.pathname === "/aujourdhui");
  await expect(page.getByRole("heading", { name: "Aujourd'hui", level: 1 })).toBeVisible();
});
