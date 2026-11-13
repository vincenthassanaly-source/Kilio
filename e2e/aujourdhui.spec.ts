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

  // Écran du jour unique à la racine : le h1 est la salutation (qui varie avec l'heure).
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /09:00 Rendez-vous e2e, événement de 09:00 à 10:00/ })).toBeVisible();
  // La tâche figure aussi dans la carte « Plan du jour » : on cible la liste du jour.
  await expect(page.getByLabel("Tâches").getByText("Tâche e2e du jour")).toBeVisible();
  // Le plan vit dans la section « Plan, jour libre et revue », repliée par
  // défaut, puis lui-même replié : on ouvre les deux (le clic peut précéder
  // l'hydratation, donc on ne clique que tant qu'ils ne sont pas ouverts).
  const section = page.locator("details").filter({ hasText: "Plan, jour libre et revue" });
  await expect(async () => {
    if ((await section.getAttribute("open")) === null) await section.locator("summary").click();
    await expect(section).toHaveAttribute("open", "", { timeout: 1000 });
  }).toPass();
  const bouton = page.getByRole("button", { name: /Plan du jour/ });
  await expect(async () => {
    if ((await bouton.getAttribute("aria-expanded")) !== "true") await bouton.click();
    await expect(bouton).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass();
  await expect(page.getByLabel("Plan du jour").getByText("Tâche e2e du jour")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repas" })).toBeVisible();
  // Aucune tâche en retard dans le jeu de données : pas de bandeau.
  await expect(page.getByRole("heading", { name: "En retard" })).toHaveCount(0);
});

test("ajoute un événement depuis le bouton « + »", async ({ page }) => {
  // Horloge figée le matin : la frise reste déroulée (voir le test « soirée » ci-dessous).
  await page.clock.setFixedTime(aujourdhuiParisA("07:00"));
  await page.goto("/aujourdhui");
  await page.locator("[data-masquer-saisie]").getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("button", { name: "Nouvel événement" }).click();

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
  await expect(page.getByRole("button", { name: /11:00 Dentiste e2e, événement de 11:00 à 12:00/ })).toBeVisible();
});

test("la barre « Aujourd'hui » est joignable depuis la grille Plus", async ({ page }) => {
  await page.goto("/plus");
  // `/aujourdhui` redirige vers la racine : la barre du bas pointe désormais sur `/`.
  await page.getByRole("navigation").locator('a[href="/"]').filter({ visible: true }).first().click();
  await page.waitForURL((u) => u.pathname === "/");
  // Écran du jour unique à la racine : le h1 est la salutation (qui varie avec l'heure).
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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

// Audit « aujourdhui » : en soirée, sans rien de prévu à venir, la frise ne
// montrerait que du vide : elle se replie en bandeau, dépliable à la demande.
test("la frise se replie le soir quand il ne reste rien de prévu", async ({ page }) => {
  await page.clock.setFixedTime(aujourdhuiParisA("22:00"));
  await page.goto("/aujourdhui");

  await expect(page.getByText(/Plus rien de prévu aujourd'hui/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Grille horaire du jour" })).toHaveCount(0);

  await page.getByRole("button", { name: "Voir la frise" }).click();
  await expect(page.getByRole("region", { name: "Grille horaire du jour" })).toBeVisible();
});

// Audit « structure » (lot 3) : Aujourd'hui ne garde que deux portes de création,
// la saisie naturelle et le bouton « + » (éventail). L'ajout rapide de tâche et
// le bouton « Événement » de la frise n'existent plus.
test("seules la saisie naturelle et le bouton « + » créent depuis Aujourd'hui", async ({ page }) => {
  await page.clock.setFixedTime(aujourdhuiParisA("07:00"));
  await page.goto("/aujourdhui");
  await expect(page.getByRole("form", { name: "Ajouter en langage naturel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter la tâche" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Événement", exact: true })).toHaveCount(0);

  await page.locator("[data-masquer-saisie]").getByRole("button", { name: "Ajouter", exact: true }).click();
  for (const nom of ["Ajouter un repas", "Courses", "Nouvelle tâche", "Nouvel événement", "Nouvelle note"]) {
    await expect(page.getByRole("button", { name: nom, exact: true })).toBeVisible();
  }
});
