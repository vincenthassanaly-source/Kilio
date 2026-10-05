// Parité (phase E de l'optimizer) : ce que la coquille statique a déplacé
// hors du serveur doit se comporter comme avant.
import { test, expect } from "@playwright/test";

// Le layout racine ne lit plus le cookie de thème côté serveur :
// themeInitScript (inline, synchrone, dans <head>) pose la classe `dark`
// avant le premier paint. Priorité inchangée : cookie > localStorage > système.
test.describe("thème appliqué avant le premier paint", () => {
  const cas = [
    { nom: "cookie sombre", cookie: "dark", stockage: null, systeme: "light", sombre: true },
    { nom: "cookie clair malgré un système sombre", cookie: "light", stockage: "dark", systeme: "dark", sombre: false },
    { nom: "sans cookie : localStorage", cookie: null, stockage: "dark", systeme: "light", sombre: true },
    { nom: "sans cookie ni stockage : système", cookie: null, stockage: null, systeme: "dark", sombre: true },
  ] as const;

  for (const c of cas) {
    test(c.nom, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ colorScheme: c.systeme });
      if (c.cookie) await context.addCookies([{ name: "kilio-theme", value: c.cookie, url: baseURL! }]);
      if (c.stockage) await context.addInitScript((v) => localStorage.setItem("kilio-theme", v), c.stockage);
      const page = await context.newPage();
      // Classe relevée à l'insertion de <body> par le parseur : aucun
      // contenu n'a encore pu être peint à ce moment-là.
      await page.addInitScript(() => {
        const w = window as unknown as { __darkAvantBody?: boolean };
        const observer = new MutationObserver(() => {
          if (!document.body) return;
          w.__darkAvantBody = document.documentElement.classList.contains("dark");
          observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      await page.goto("/taches");
      await expect(page.locator("html")).toHaveClass(c.sombre ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      expect(await page.evaluate(() => (window as unknown as { __darkAvantBody?: boolean }).__darkAvantBody)).toBe(c.sombre);
      await context.close();
    });
  }
});

test("le service worker s'enregistre toujours", async ({ page }) => {
  await page.goto("/taches");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe("/");
});

test("AppResumeRefresh relance un rendu serveur au retour au premier plan", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.getByRole("heading", { level: 1, name: "Courses" })).toBeVisible();
  const rsc = page.waitForRequest((r) => r.headers()["rsc"] === "1" && new URL(r.url()).pathname === "/courses");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await rsc;
});

// Cache TanStack Query partagé entre le Dashboard et /taches (même query
// key) : une tâche cochée depuis le Dashboard apparaît faite sur /taches,
// sans rechargement, maintenant que le Dashboard lit la date du jour sous
// <Suspense>. Tâche fournie par e2e/mock-supabase.mjs.
test("cocher une tâche du jour depuis le Dashboard met /taches à jour", async ({ page }) => {
  await fetch(`${process.env.E2E_SUPABASE_URL}/__reset`);
  await page.goto("/");
  await expect(page.getByText("Tâche e2e du jour")).toBeVisible();

  const action = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
  await page.getByRole("button", { name: "Marquer fait", exact: true }).click();
  // La carte "Aujourd'hui" ne liste que les tâches non faites.
  await expect(page.getByText("Tâche e2e du jour")).toHaveCount(0);

  await page.getByRole("navigation").locator('a[href="/taches"]').click();
  await page.waitForURL((u) => u.pathname === "/taches");
  // Coches uniquement (les segments du SegmentedControl portent aussi
  // `aria-pressed` depuis la vague 2, mais pas d'`aria-label` « … fait »).
  const coches = 'button[aria-pressed][aria-label*="fait"]';
  const toggles = page.locator("li, div").filter({ hasText: "Tâche e2e du jour" }).locator(coches);
  await expect(toggles.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`${coches}[aria-pressed="false"]`)).toHaveCount(0);

  expect((await action).ok()).toBe(true);
  await fetch(`${process.env.E2E_SUPABASE_URL}/__reset`);
});
