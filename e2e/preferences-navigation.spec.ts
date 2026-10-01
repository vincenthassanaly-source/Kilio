// Mutation (checklist G de l'optimizer) : les préférences de navigation sont
// en cache ("use cache", tag preferences-navigation) et figées dans la
// coquille statique de chaque route. Après un épinglage depuis /plus, un
// nouveau chargement de n'importe quelle page doit montrer la nouvelle barre
// du bas (updateTag dans updateModulesBarreBasse).
//
// Les relectures se font dans un contexte navigateur neuf : `next start`
// sert les pages statiques avec `s-maxage, stale-while-revalidate`, que
// Chrome applique aussi à son propre cache HTTP ; on mesure ici la fraîcheur
// côté serveur, pas le cache du navigateur de test.
import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";

const navLink = (page: Page, href: string) => page.getByRole("navigation").locator(`a[href="${href}"]`);

// `boundingBox()` renvoie null si l'élément est re-rendu entre le contrôle de
// visibilité et la lecture (remontage à l'hydratation). On attend donc une
// boîte non nulle et identique sur deux lectures successives.
async function boite(locator: Locator) {
  type Boite = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;
  const etat: { cle: string | null; boite: Boite | null } = { cle: null, boite: null };
  await expect
    .poll(async () => {
      const lue = await locator.boundingBox();
      const cle = lue ? JSON.stringify(lue) : null;
      etat.boite = lue !== null && cle === etat.cle ? lue : null;
      etat.cle = cle;
      return etat.boite !== null;
    })
    .toBe(true);
  return etat.boite!;
}

async function epingler(page: Page, href: string, slotHref: string) {
  await page.goto("/plus");
  const tile = page.locator(`a[data-nav-edit-tile][href="${href}"]`);
  const slot = navLink(page, slotHref);
  await expect(tile).toBeVisible();
  await expect(slot).toBeVisible();

  const from = await boite(tile);
  const to = await boite(slot);
  const action = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Appui long : activationConstraint { delay: 400 } du PointerSensor.
  await page.waitForTimeout(600);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  expect((await action).ok()).toBe(true);
}

test.describe.configure({ mode: "serial" });

async function barreDuBas(browser: Browser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Plus", exact: true })).toBeVisible();
  const hrefs = await page.getByRole("navigation").locator("a").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  await context.close();
  return hrefs;
}

test("épingler un module met à jour la barre du bas au rechargement", async ({ page, browser }) => {
  await page.goto("/taches");
  await expect(navLink(page, "/agenda")).toBeVisible();
  await expect(navLink(page, "/courses")).toHaveCount(0);

  await epingler(page, "/courses", "/agenda");

  // Même onglet : l'état client est à jour sans rechargement.
  await expect(navLink(page, "/courses")).toBeVisible();
  for (const path of ["/taches", "/notes"]) {
    expect(await barreDuBas(browser, path)).toEqual(["/", "/courses", "/taches", "/notes", "/plus"]);
  }

  // Remise en état (et seconde mutation vérifiée).
  await epingler(page, "/agenda", "/courses");
  expect(await barreDuBas(browser, "/taches")).toEqual(["/", "/agenda", "/taches", "/notes", "/plus"]);
});

async function grillePlus(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/plus");
  const tiles = page.locator("a[data-nav-edit-tile]");
  await expect(tiles.first()).toBeVisible();
  const hrefs = await tiles.evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  await context.close();
  return hrefs;
}

async function deplacerTuile(page: Page, href: string, surHref: string) {
  await page.goto("/plus");
  const tile = page.locator(`a[data-nav-edit-tile][href="${href}"]`);
  const cible = page.locator(`a[data-nav-edit-tile][href="${surHref}"]`);
  await expect(tile).toBeVisible();
  const from = await boite(tile);
  const to = await boite(cible);
  const action = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  expect((await action).ok()).toBe(true);
}

test("réorganiser la grille Plus est visible au rechargement", async ({ page, browser }) => {
  const avant = await grillePlus(browser);
  expect(avant.slice(0, 3)).toEqual(["/", "/agenda", "/budget"]);

  await deplacerTuile(page, "/budget", "/");
  const apres = await grillePlus(browser);
  expect(apres.slice(0, 3)).toEqual(["/budget", "/", "/agenda"]);

  // Remise en état.
  await deplacerTuile(page, "/budget", "/agenda");
  expect(await grillePlus(browser)).toEqual(avant);
});
