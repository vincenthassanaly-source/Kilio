// Pages détail [id] (collection, objectif) : la coquille reste servie sous
// instant(), et la donnée est préchargée côté serveur (patron
// HydrationBoundary) — présente dans le HTML sans exécuter de JavaScript,
// donc sans l'aller-retour Server Action qui suivait l'hydratation.
import { test, expect } from "@playwright/test";
import { instant } from "@next/playwright";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const DETAILS = [
  { path: `/collection/${uuid(1001)}`, retour: "‹ Collection", titre: "Voyage Lisbonne" },
  { path: `/objectifs/${uuid(1101)}`, retour: "‹ Objectifs", titre: "Courir un semi-marathon" },
];

for (const detail of DETAILS) {
  test.describe(detail.path, () => {
    test("coquille statique servie sous instant()", async ({ page, baseURL }) => {
      await instant(
        page,
        async () => {
          await page.goto(detail.path);
          await expect(page.getByRole("link", { name: detail.retour, exact: true })).toBeVisible();
          await expect(page.getByRole("navigation").getByRole("link", { name: "Plus", exact: true })).toBeVisible();
        },
        { baseURL }
      );
    });

    test("la donnée est dans le HTML serveur (sans JavaScript)", async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const page = await context.newPage();
      await page.goto(detail.path);
      await expect(page.getByText(detail.titre).first()).toBeAttached();
      await context.close();
    });
  });
}
