// Garde : la coquille statique est rendue par le SERVEUR, pas seulement par le
// JavaScript — voir instant-nav.rig.md et reports/2026-11-04-nuit-performance.md.
//
// instant() ne voit pas ce défaut : son verrou retient les données dynamiques
// du serveur, pas le rendu côté client. Jusqu'au 2026-11-04, un Date.now()
// lu au rendu par SeanceFlottante rendait dynamique la frontière <Suspense>
// du layout (app) : la barre du bas et toute la page sortaient du HTML
// statique, React les rendait côté client après le chargement du JS (erreur
// #419) et le premier affichage utile attendait l'exécution de tout le JS.
//
// 1. Sans JavaScript, le titre (ou le marqueur de coquille) et la barre du bas
//    sont visibles : ils sont dans le HTML statique, en ligne.
// 2. Avec JavaScript, aucune frontière ne bascule en rendu client (#419) et
//    l'hydratation ne diverge pas (#418, #423, #425).
import { test, expect, type Page } from "@playwright/test";
import { ROUTES, type RouteContract } from "./routes";

function shellMarker(page: Page, route: Pick<RouteContract, "title" | "shellTestId">) {
  return route.shellTestId
    ? page.getByTestId(route.shellTestId)
    : page.getByRole("heading", { level: 1, name: route.title, exact: true });
}

function bottomNavPlus(page: Page) {
  return page.getByRole("navigation").getByRole("link", { name: "Plus", exact: true });
}

// Routes dont la coquille, volumineuse, est émise par React en segment caché
// révélé par son script inline ($RC) : sans JS elle reste cachée, mais elle
// est bien dans le HTML serveur. L'accueil (tableau de bord, pas de
// loading.tsx) est dans ce cas ; avec JS, elle s'affiche dès la première
// image (LCP = FCP, voir le rapport).
const SEGMENT_REVELE_PAR_SCRIPT = new Set(["/"]);

test.describe("coquille rendue par le serveur (sans JavaScript)", () => {
  test.use({ javaScriptEnabled: false });
  for (const route of ROUTES) {
    test(`${route.path}`, async ({ page, request }) => {
      if (SEGMENT_REVELE_PAR_SCRIPT.has(route.path)) {
        const html = await (await request.get(route.path)).text();
        expect(html).toContain('aria-label="Navigation principale"');
        expect(html).toContain(`data-testid="${route.shellTestId}"`);
        return;
      }
      await page.goto(route.path);
      await expect(shellMarker(page, route)).toBeVisible();
      await expect(bottomNavPlus(page)).toBeVisible();
    });
  }
});

const ERREURS_RENDU = /Minified React error #(418|419|423|425)\b/;

test.describe("chargement initial : ni rendu client de repli, ni hydratation divergente", () => {
  for (const route of ROUTES) {
    test(`${route.path}`, async ({ page }) => {
      const erreurs: string[] = [];
      page.on("pageerror", (e) => {
        if (ERREURS_RENDU.test(e.message)) erreurs.push(e.message.slice(0, 120));
      });
      page.on("console", (m) => {
        if (m.type() === "error" && ERREURS_RENDU.test(m.text())) erreurs.push(m.text().slice(0, 120));
      });
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(shellMarker(page, route)).toBeVisible();
      expect(erreurs).toEqual([]);
    });
  }
});
