// Écran « Aujourd'hui » : frise du jour, tâche et événement fournis par
// e2e/mock-supabase.mjs, création d'un événement depuis l'écran.
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await fetch(`${process.env.E2E_SUPABASE_URL}/__reset`);
});

// Instant correspondant à `heure` (HH:MM) à Paris, aujourd'hui. L'écran « Plan du
// jour » range les tâches dans les trous libres APRÈS l'heure courante : sans
// horloge figée, le test échouait dès que la journée était trop avancée
// (« Aucun trou libre aujourd'hui »).
function aujourdhuiParisA(heure: string): Date {
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const [hh] = heure.split(":");
  for (const decalage of ["+01:00", "+02:00"]) {
    const candidat = new Date(`${jour}T${heure}:00${decalage}`);
    const heureParis = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(candidat);
    if (heureParis === hh) return candidat;
  }
  throw new Error(`Heure ${heure} introuvable à Paris le ${jour}`);
}

test("affiche l'événement, la tâche du jour et le résumé des repas", async ({ page }) => {
  // E2E_HEURE_FIGEE permet de rejouer le test à une autre heure (HH:MM, Paris).
  await page.clock.setFixedTime(aujourdhuiParisA(process.env.E2E_HEURE_FIGEE ?? "07:00"));
  await page.goto("/aujourdhui");

  await expect(page.getByRole("heading", { name: "Aujourd'hui", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Événement Rendez-vous e2e, de 09:00 à 10:00/ })).toBeVisible();
  // La tâche figure aussi dans la carte « Plan du jour » : on cible la liste du jour.
  await expect(page.getByLabel("Tâches").getByText("Tâche e2e du jour")).toBeVisible();
  await expect(page.getByLabel("Plan du jour").getByText("Tâche e2e du jour")).toBeVisible();
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

test("planifie une tâche sans heure dans un créneau libre", async ({ page }) => {
  await page.goto("/aujourdhui");

  await page.getByRole("button", { name: "Planifier « Tâche e2e du jour »" }).click();
  const groupe = page.getByRole("group", { name: "Planifier « Tâche e2e du jour »" });
  await expect(groupe).toBeVisible();

  // Durée 15 min : un créneau existe quelle que soit l'heure du test (sauf
  // après 21h45, où il ne reste plus de trou : le test s'arrête alors là).
  await groupe.getByRole("button", { name: "15 min" }).click();
  const creneaux = groupe.getByRole("button", { name: /^Planifier de \d{2}:\d{2} à \d{2}:\d{2}$/ });
  test.skip((await creneaux.count()) === 0, "plus de trou libre à cette heure");

  const action = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
  await creneaux.first().click();
  expect((await action).ok()).toBe(true);

  // La tâche porte maintenant une heure : plus de bouton « Planifier », un bloc dans la frise.
  await expect(page.getByRole("button", { name: "Planifier « Tâche e2e du jour »" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Tâche e2e du jour, de \d{2}:\d{2} à \d{2}:\d{2}/ })).toBeVisible();

  // « Annuler » rétablit la tâche ET expire le cache serveur des tâches (60 s
  // de fraîcheur) : sans cela, le test suivant relisait la tâche déjà planifiée
  // alors que le faux serveur avait été remis à zéro. Vérifie aussi l'annulation.
  const annulation = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
  await page.getByRole("button", { name: /^Annuler :/ }).click();
  expect((await annulation).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Planifier « Tâche e2e du jour »" })).toBeVisible();
});
