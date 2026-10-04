// Parité (phase E de l'optimizer) après l'agrandissement des coquilles du
// Journal et du Budget : même contenu, mêmes états vides, même navigation
// par date/période, swipe et suppression optimiste inchangés. Données :
// e2e/mock-supabase.mjs (repas sur plusieurs jours, transactions sur trois
// mois), dates relatives au jour du test (UTC, comme le serveur).
import { test, expect, type Page } from "@playwright/test";

const MOCK = process.env.E2E_SUPABASE_URL ?? "http://localhost:54321";

function jour(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

const main = (page: Page) => page.getByRole("main");
const repas = (page: Page, nom: string) => main(page).locator("li").filter({ hasText: nom });

test.beforeEach(async () => {
  await fetch(`${MOCK}/__reset`);
});

test.describe("Journal", () => {
  test("jour du jour par défaut, puis ‹ affiche la veille avec ses repas", async ({ page }) => {
    await page.goto("/nutrition/journal");
    await expect(repas(page, "Skyr nature")).toBeVisible();
    await expect(repas(page, "Poulet riz meal prep")).toBeVisible();

    // Planning vide (rien dans nutrition_planning) : tous les jours en repos.
    await main(page).getByRole("link", { name: "Jour précédent" }).click();
    await page.waitForURL((u) => u.searchParams.get("date") === jour(-1));
    await expect(main(page).getByRole("heading", { name: "Objectif (repos)" })).toBeVisible();
    await expect(repas(page, "Blanc de poulet")).toBeVisible();
    await expect(repas(page, "Curry de légumes HelloFresh")).toBeVisible();
    await expect(repas(page, "Skyr nature")).toHaveCount(0);
  });

  test("planning : cocher un jour d'entraînement l'enregistre", async ({ page }) => {
    await page.goto(`/nutrition/journal?date=${jour(-1)}`);
    await main(page).getByRole("button", { name: "Modifier les objectifs et le planning" }).click();

    // Jour de la semaine de la veille (1 = lundi … 7 = dimanche).
    const noms = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const indexJs = new Date(`${jour(-1)}T00:00:00Z`).getUTCDay();
    await main(page).getByRole("checkbox", { name: noms[indexJs] }).check({ force: true });
    await main(page).getByRole("button", { name: "Enregistrer", exact: true }).click();

    const iso = indexJs === 0 ? 7 : indexJs;
    await expect
      .poll(async () =>
        (await (await fetch(`${MOCK}/__writes`)).json()).some(
          (w: { method: string; table: string; body: unknown }) =>
            w.table === "nutrition_planning" && JSON.stringify(w.body).includes(`"jours_entrainement":[${iso}]`)
        )
      )
      .toBe(true);
  });

  test("état vide inchangé", async ({ page }) => {
    await page.goto(`/nutrition/journal?date=${jour(-10)}`);
    await expect(main(page).getByText("Aucun repas enregistré pour ce jour.")).toBeVisible();
  });

  test("suppression optimiste : la ligne disparaît avant la réponse serveur", async ({ page }) => {
    await page.goto(`/nutrition/journal?date=${jour(-1)}`);
    await expect(repas(page, "Lait demi-écrémé")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    // Réponse de la Server Action retenue : seule la mise à jour optimiste
    // peut retirer la ligne.
    let relacher!: () => void;
    const retenue = new Promise<void>((r) => (relacher = r));
    await page.route("**/nutrition/journal**", async (route) => {
      if (route.request().method() === "POST") await retenue;
      await route.continue();
    });
    await repas(page, "Lait demi-écrémé").getByRole("button", { name: "Suppr." }).click();
    await expect(repas(page, "Lait demi-écrémé")).toHaveCount(0);
    relacher();

    await expect.poll(async () => (await (await fetch(`${MOCK}/__writes`)).json()).some((w: { method: string; table: string }) => w.method === "DELETE" && w.table === "journal_repas")).toBe(true);
    await page.reload();
    await expect(repas(page, "Blanc de poulet")).toBeVisible();
    await expect(repas(page, "Lait demi-écrémé")).toHaveCount(0);
  });
});

test.describe("Journal : swipe", () => {
  test.skip(({ hasTouch }) => !hasTouch, "geste tactile : projet mobile");

  async function swipe(page: Page, deltaX: number) {
    const cdp = await page.context().newCDPSession(page);
    const box = (await main(page).getByRole("heading", { name: "Repas du jour" }).boundingBox())!;
    const x = 195;
    const y = box.y + 20;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 5; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (deltaX * i) / 5, y }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  test("glisser vers la droite affiche la veille, vers la gauche le lendemain", async ({ page }) => {
    await page.goto(`/nutrition/journal?date=${jour(-1)}`);
    await expect(repas(page, "Blanc de poulet")).toBeVisible();

    await swipe(page, 150);
    await page.waitForURL((u) => u.searchParams.get("date") === jour(-2));
    await expect(repas(page, "Riz basmati cuit")).toBeVisible();

    await swipe(page, -150);
    await page.waitForURL((u) => u.searchParams.get("date") === jour(-1));
    await expect(repas(page, "Blanc de poulet")).toBeVisible();
  });
});

test.describe("Budget", () => {
  test("vue d'ensemble : totaux du mois courant", async ({ page }) => {
    await page.goto("/budget");
    await expect(main(page).getByText("Solde total")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Voir les 2 comptes" })).toBeVisible();
    await expect(main(page).getByText("Loisirs")).toBeVisible();
  });

  test("statistiques : ← Précédent change de mois", async ({ page }) => {
    await page.goto("/budget/statistiques");
    const [annee, mois] = jour(0).split("-").map(Number);
    const precedent = new Date(Date.UTC(annee, mois - 2, 1));
    const libelle = precedent.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
    await expect(main(page).getByText(new Date(Date.UTC(annee, mois - 1, 1)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }), { exact: true })).toBeVisible();

    await main(page).getByRole("link", { name: "← Précédent" }).click();
    await page.waitForURL((u) => u.searchParams.get("periode") === precedent.toISOString().slice(0, 10));
    await expect(main(page).getByText(libelle, { exact: true })).toBeVisible();
    await expect(main(page).getByText("Alimentation")).toBeVisible();
  });

  test("calendrier : un jour mène aux transactions filtrées, « Effacer » retire le filtre", async ({ page }) => {
    await page.goto("/budget/calendrier");
    const premier = `${jour(0).slice(0, 7)}-01`;
    await main(page).locator(`a[href="/budget/transactions?date=${premier}"]`).click();
    await page.waitForURL((u) => u.searchParams.get("date") === premier);
    await expect(main(page).getByText("Cinéma et resto")).toBeVisible();
    await main(page).getByRole("link", { name: "Effacer ✕" }).click();
    await page.waitForURL((u) => u.pathname === "/budget/transactions" && !u.searchParams.has("date"));
    await expect(main(page).getByText("Concert")).toBeVisible();
  });

  test("catégories : Suivant → conserve le type de période", async ({ page }) => {
    await page.goto("/budget/categories?type_periode=annuel&periode=2026-01-01");
    await expect(main(page).getByText("Année 2026")).toBeVisible();
    await main(page).getByRole("button", { name: "Suivant →" }).click();
    await page.waitForURL((u) => u.searchParams.get("type_periode") === "annuel" && u.searchParams.get("periode") === "2027-01-01");
    await expect(main(page).getByText("Année 2027")).toBeVisible();
  });
});
