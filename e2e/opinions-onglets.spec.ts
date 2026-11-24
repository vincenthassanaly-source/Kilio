// Module Opinions : les onglets Idées / Partis / Profil réagissent au tap.
// L'onglet actif est porté par l'URL (`?onglet=`) ; on vérifie l'écran et l'URL.
import { test, expect } from "@playwright/test";
import { reinitialiserMock } from "./ecritures";

test.beforeEach(async () => {
  await reinitialiserMock();
});

test("bascule entre Idées, Partis et Profil au tap", async ({ page }) => {
  await page.goto("/opinions", { waitUntil: "networkidle" });
  const section = page.getByRole("group", { name: "Section" });

  await expect(section.getByRole("button", { name: "Idées" })).toHaveAttribute("aria-pressed", "true");

  await section.getByRole("button", { name: "Partis" }).click();
  await expect(section.getByRole("button", { name: "Partis" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/onglet=partis/);

  await section.getByRole("button", { name: "Profil" }).click();
  await expect(section.getByRole("button", { name: "Profil" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/onglet=profil/);

  await section.getByRole("button", { name: "Idées" }).click();
  await expect(section.getByRole("button", { name: "Idées" })).toHaveAttribute("aria-pressed", "true");
});
