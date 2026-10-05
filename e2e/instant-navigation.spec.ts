// Garde de navigation instantanée (Cache Components) — voir
// instant-nav.rig.md et reports/2026-09-24-navigation-instantanee-cache-components.md.
//
// Sous `instant()`, les données dynamiques sont retenues : seule la coquille
// statique (chargement initial) ou la coquille préchargée (navigation client)
// peut s'afficher. Chaque test affirme que le titre de la page ET la barre du
// bas y figurent. Ce n'est pas un chronomètre : aucune temporisation propre.
import { test, expect, type Page } from "@playwright/test";
import { instant } from "@next/playwright";
import { ROUTES, type RouteContract } from "./routes";

function shellMarker(page: Page, route: Pick<RouteContract, "title" | "shellTestId">) {
  return route.shellTestId
    ? page.getByTestId(route.shellTestId)
    : page.getByRole("heading", { level: 1, name: route.title, exact: true });
}

function bottomNavPlus(page: Page) {
  return page.getByRole("navigation").getByRole("link", { name: "Plus", exact: true });
}

function urlMatcher(path: string) {
  return (url: URL) => url.pathname === path;
}

test.describe("chargement initial : la coquille statique est servie", () => {
  for (const route of ROUTES) {
    test(`${route.path}`, async ({ page, baseURL }) => {
      await instant(
        page,
        async () => {
          await page.goto(route.path);
          await expect(shellMarker(page, route)).toBeVisible();
          await expect(bottomNavPlus(page)).toBeVisible();
        },
        { baseURL }
      );
    });
  }
});

type SoftNav = { from: string; to: string; trigger: (page: Page) => ReturnType<Page["locator"]> };

const byHref = (href: string) => (page: Page) => page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
const bottomNav = (href: string) => (page: Page) => page.getByRole("navigation").locator(`a[href="${href}"]`);

// Barre du bas (modules épinglés dans le faux Supabase, comme en base réelle
// au 2026-09-24 : /, /agenda, /taches, /notes), grille "Plus" et liens
// internes des modules.
const SOFT_NAVS: SoftNav[] = [
  { from: "/plus", to: "/", trigger: bottomNav("/") },
  { from: "/plus", to: "/taches", trigger: bottomNav("/taches") },
  { from: "/plus", to: "/agenda", trigger: bottomNav("/agenda") },
  { from: "/plus", to: "/notes", trigger: bottomNav("/notes") },
  { from: "/taches", to: "/plus", trigger: bottomNav("/plus") },
  { from: "/plus", to: "/habitudes", trigger: byHref("/habitudes") },
  { from: "/plus", to: "/courses", trigger: byHref("/courses") },
  { from: "/plus", to: "/objectifs", trigger: byHref("/objectifs") },
  { from: "/plus", to: "/collection", trigger: byHref("/collection") },
  { from: "/plus", to: "/documents", trigger: byHref("/documents") },
  { from: "/plus", to: "/reglages", trigger: byHref("/reglages") },
  { from: "/nutrition/recettes", to: "/nutrition/journal", trigger: byHref("/nutrition/journal") },
  { from: "/nutrition/journal", to: "/nutrition/recettes", trigger: byHref("/nutrition/recettes") },
  { from: "/taches", to: "/taches/listes", trigger: byHref("/taches/listes") },
];

test.describe("navigation client : la coquille préchargée s'affiche au clic", () => {
  for (const nav of SOFT_NAVS) {
    const route = ROUTES.find((r) => r.path === nav.to)!;
    test(`${nav.from} → ${nav.to}`, async ({ page }) => {
      await page.goto(nav.from);
      const trigger = nav.trigger(page);
      await expect(trigger).toBeVisible({ timeout: 20000 });

      await instant(page, async () => {
        await trigger.click();
        await page.waitForURL(urlMatcher(nav.to));
        await expect(shellMarker(page, route)).toBeVisible();
        await expect(bottomNavPlus(page)).toBeVisible();
      });
    });
  }
});

// Variante auto-validante (routes dont une partie dépend de la date du
// jour) : sous le verrou, la coquille est là mais le contenu du jour est
// retenu ; il arrive en streaming dès la levée du verrou. Un build sans
// l'API de test ferait échouer le toHaveCount(0).
const DEFERRED: { from: string; to: string; trigger: SoftNav["trigger"]; deferred: (page: Page) => ReturnType<Page["locator"]> }[] = [
  { from: "/plus", to: "/", trigger: bottomNav("/"), deferred: (page) => page.getByRole("heading", { level: 1 }) },
  {
    from: "/plus",
    to: "/habitudes",
    trigger: byHref("/habitudes"),
    deferred: (page) => page.getByRole("button", { name: "Aujourd'hui", exact: true }),
  },
];

test.describe("contenu du jour : retenu sous verrou, puis streamé", () => {
  for (const nav of DEFERRED) {
    const route = ROUTES.find((r) => r.path === nav.to)!;
    test(`${nav.from} → ${nav.to}`, async ({ page }) => {
      await page.goto(nav.from);
      const trigger = nav.trigger(page);
      await expect(trigger).toBeVisible({ timeout: 20000 });

      await instant(page, async () => {
        await trigger.click();
        await page.waitForURL(urlMatcher(nav.to));
        await expect(shellMarker(page, route)).toBeVisible();
        await expect(nav.deferred(page)).toHaveCount(0);
      });
      await expect(nav.deferred(page)).toBeVisible();
    });
  }
});
