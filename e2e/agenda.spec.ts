// Agenda : non-régression des correctifs de l'audit du module (reports/audit/agenda).
// Données fournies par e2e/mock-supabase.mjs : un événement « Rendez-vous e2e »
// (09:00-10:00) et une tâche « Tâche e2e du jour », tous deux aujourd'hui.
import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await fetch(`${process.env.E2E_SUPABASE_URL}/__reset`);
});

// Instant correspondant à `heure` (HH:MM) à Paris, aujourd'hui (voir aujourdhui.spec.ts).
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

async function ouvrirAgenda(page: Page, heure = "10:50") {
  await page.clock.setFixedTime(aujourdhuiParisA(heure));
  await page.goto("/agenda");
  await expect(page.getByRole("group", { name: "Vue de l'agenda" })).toBeVisible();
}

const grille = (page: Page) => page.getByRole("region", { name: /Grille horaire du jour/ });

async function choisirVue(page: Page, vue: "Semaine" | "Mois") {
  // Le clic peut précéder l'hydratation : on réessaie tant que la vue n'est pas active.
  const bouton = page.getByRole("button", { name: vue, exact: true });
  await expect(async () => {
    if ((await bouton.getAttribute("aria-pressed")) !== "true") await bouton.click();
    await expect(bouton).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
}

test("grille Jour : l'événement déjà commencé n'est pas coupé en haut à l'ouverture", async ({ page }) => {
  await ouvrirAgenda(page);
  const bloc = grille(page).getByRole("button", { name: /Rendez-vous e2e/ });
  await expect(bloc).toBeVisible();
  // Le scroll initial vise l'heure courante (10h50) : sans correctif, le bloc de 09h00 était rogné.
  await expect
    .poll(async () => {
      const [b, g] = [await bloc.boundingBox(), await grille(page).boundingBox()];
      return b && g ? b.y - g.y : -999;
    })
    .toBeGreaterThanOrEqual(-0.5);
});

test("suppression d'un événement : plus de toast « modifié » périmé sous « supprimé »", async ({ page }) => {
  await ouvrirAgenda(page);
  await grille(page).getByRole("button", { name: /Rendez-vous e2e/ }).click();
  await page.getByRole("textbox", { name: "Titre" }).fill("Rendez-vous modifié");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Événement modifié")).toBeVisible();

  await grille(page).getByRole("button", { name: /Rendez-vous modifié/ }).click();
  await page.getByRole("button", { name: "Supprimer" }).click();

  await expect(page.getByText(/« Rendez-vous modifié » supprimé/)).toBeVisible();
  await expect(page.getByText("Événement modifié")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Annuler la suppression/ })).toBeVisible();
});

test("formulaire événement : « Le titre est requis. » apparaît juste sous le champ Titre", async ({ page }) => {
  await ouvrirAgenda(page);
  await page.getByRole("button", { name: /Ajouter une tâche ou un événement/ }).click();
  await page.getByRole("button", { name: "Événement", exact: true }).click();
  const titre = page.getByRole("textbox", { name: "Titre" });
  await expect(titre).toBeVisible();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  const alerte = page.getByRole("alert").filter({ hasText: "Le titre est requis." });
  await expect(alerte).toBeVisible();
  await expect(titre).toHaveAttribute("aria-invalid", "true");
  const [champ, message] = [await titre.boundingBox(), await alerte.boundingBox()];
  expect(message!.y - (champ!.y + champ!.height)).toBeLessThan(40);
});

test("vue Semaine : indice de défilement à droite, et message sur une semaine vide", async ({ page }, testInfo) => {
  await ouvrirAgenda(page);
  await choisirVue(page, "Semaine");
  // Sur grand écran les 7 colonnes tiennent : l'indice n'a de sens qu'en mobile.
  if (testInfo.project.name === "mobile") {
    await expect(page.getByTestId("indice-defilement-semaine")).toBeVisible();
  }
  await page.getByRole("button", { name: "Semaine suivante" }).click();
  await expect(page.getByText("Rien de prévu cette semaine.")).toBeVisible();
});

test("vue Mois : légende limitée à ce qui s'affiche, message sur un mois vide", async ({ page }) => {
  await ouvrirAgenda(page);
  await choisirVue(page, "Mois");
  await expect(page.getByText("Rien de prévu ce mois-ci.")).toHaveCount(0);
  // Plus de « tâche(s) » / « événement(s) » en forme de formulaire, ni de « 12 férié » ambigu.
  await expect(page.getByText("tâche(s)")).toHaveCount(0);
  await expect(page.getByText("événement(s)")).toHaveCount(0);
  await expect(page.getByText(/12\s*férié/)).toHaveCount(0);

  await page.getByRole("button", { name: "Mois suivant" }).click();
  await page.getByRole("button", { name: "Mois suivant" }).click();
  await expect(page.getByText("Rien de prévu ce mois-ci.")).toBeVisible();
});
