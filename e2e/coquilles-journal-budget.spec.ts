// Coquilles du Journal et du Budget — voir instant-nav.rig.md et
// reports/2026-09-24-partial-prefetching-coquilles-journal-budget.md.
//
// Sous `instant()`, seule la coquille (statique au chargement initial,
// préchargée en navigation client) peut s'afficher. Chaque contrat affirme
// que le VRAI en-tête de la page y figure (sous-navigation, liens d'en-tête,
// sélecteur de période, bouton d'ajout) — et non le skeleton générique d'un
// loading.tsx — et que le contenu qui dépend de l'URL, de la date du jour ou
// de Supabase est retenu sous le verrou (auto-validant : un build sans l'API
// de test ferait échouer le toHaveCount(0)), puis arrive en streaming.
import { test, expect, type Page, type Locator } from "@playwright/test";
import { instant } from "@next/playwright";

type Contrat = {
  path: string;
  /** Page d'où partir pour la navigation client, et lien à cliquer. */
  depuis: string;
  declencheur: (page: Page) => Locator;
  /** Élément du vrai en-tête, absent du loading.tsx d'origine. */
  entete: (page: Page) => Locator;
  /** Contenu dépendant des données, retenu sous le verrou. */
  contenu: (page: Page) => Locator;
};

const lien = (href: string) => (page: Page) => page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
const main = (page: Page) => page.getByRole("main");

const CONTRATS: Contrat[] = [
  {
    path: "/nutrition/journal",
    depuis: "/nutrition/recettes",
    declencheur: lien("/nutrition/journal"),
    entete: (page) => main(page).getByRole("link", { name: "Recettes", exact: true }),
    contenu: (page) => main(page).getByRole("heading", { name: "Repas du jour" }),
  },
  {
    path: "/budget",
    depuis: "/plus",
    declencheur: lien("/budget"),
    entete: (page) => main(page).getByRole("link", { name: "Statistiques" }),
    contenu: (page) => main(page).getByText("Solde total"),
  },
  {
    path: "/budget/transactions",
    depuis: "/budget",
    declencheur: lien("/budget/transactions"),
    entete: (page) => main(page).getByRole("link", { name: "Calendrier", exact: true }),
    contenu: (page) => main(page).getByText("Cinéma et resto"),
  },
  {
    path: "/budget/comptes",
    depuis: "/budget",
    declencheur: lien("/budget/comptes"),
    entete: (page) => main(page).getByRole("button", { name: /Ajouter un compte/ }),
    contenu: (page) => main(page).getByText("Livret A"),
  },
  {
    path: "/budget/categories",
    depuis: "/budget",
    declencheur: lien("/budget/categories"),
    entete: (page) => main(page).getByRole("button", { name: "Mois", exact: true }),
    contenu: (page) => main(page).getByText("Alimentation").first(),
  },
  {
    path: "/budget/statistiques",
    depuis: "/budget",
    declencheur: lien("/budget/statistiques"),
    entete: (page) => main(page).getByRole("link", { name: "Calendrier", exact: true }),
    contenu: (page) => main(page).getByText("Livret A"),
  },
  {
    path: "/budget/recurrentes",
    depuis: "/budget",
    declencheur: lien("/budget/recurrentes"),
    entete: (page) => main(page).getByRole("heading", { level: 1, name: "Transactions récurrentes" }),
    contenu: (page) => main(page).getByText("Loyer"),
  },
  {
    path: "/budget/calendrier",
    depuis: "/budget",
    declencheur: lien("/budget/calendrier"),
    entete: (page) => main(page).getByRole("link", { name: "Liste", exact: true }),
    contenu: (page) => main(page).getByText("+2 400", { exact: true }),
  },
];

test.describe("coquille Journal/Budget : chargement initial", () => {
  for (const c of CONTRATS) {
    test(c.path, async ({ page, baseURL }) => {
      await instant(
        page,
        async () => {
          await page.goto(c.path);
          await expect(c.entete(page)).toBeVisible();
          await expect(c.contenu(page)).toHaveCount(0);
        },
        { baseURL }
      );
    });
  }
});

test.describe("coquille Journal/Budget : navigation client", () => {
  for (const c of CONTRATS) {
    test(`${c.depuis} → ${c.path}`, async ({ page }) => {
      await page.goto(c.depuis);
      const declencheur = c.declencheur(page);
      await expect(declencheur).toBeVisible({ timeout: 20000 });

      await instant(page, async () => {
        await declencheur.click();
        await page.waitForURL((url) => url.pathname === c.path);
        await expect(c.entete(page)).toBeVisible();
        await expect(c.contenu(page)).toHaveCount(0);
      });
      await expect(c.contenu(page)).toBeVisible();
    });
  }
});
