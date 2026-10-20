// Module « Vider ma tête » : écriture au stylet sur la feuille du soir.
// Les événements de pointeur sont injectés avec pointerType « pen » (Playwright
// ne simule pas un vrai stylet) : on vérifie le tracé, la gomme, le refus du
// doigt, la sauvegarde locale puis l'envoi au serveur (faux Supabase).
// Le comportement sur un vrai S Pen (pression, rejet de paume, défilement au
// doigt) reste à valider sur l'appareil.
import { test, expect, type Locator } from "@playwright/test";
import { ecritures, reinitialiserMock } from "./ecritures";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await reinitialiserMock();
});

type Point = { x: number; y: number };

async function tracer(canvas: Locator, type: "pen" | "touch" | "mouse", points: Point[], pointerId = 7) {
  const boite = (await canvas.boundingBox())!;
  const base = { pointerId, pointerType: type, isPrimary: true, bubbles: true, cancelable: true, button: 0 };
  const evenement = (nom: string, p: Point, buttons: number) =>
    canvas.dispatchEvent(nom, { ...base, clientX: boite.x + p.x, clientY: boite.y + p.y, pressure: buttons ? 0.6 : 0, buttons });
  await evenement("pointerdown", points[0], 1);
  for (const p of points.slice(1)) await evenement("pointermove", p, 1);
  await evenement("pointerup", points[points.length - 1], 0);
}

/** Nombre de pixels non transparents du canvas : 0 tant que rien n'est écrit. */
const pixelsEncres = (canvas: Locator) =>
  canvas.evaluate((c: HTMLCanvasElement) => {
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
    return n;
  });

const diagonale: Point[] = [
  { x: 40, y: 80 },
  { x: 80, y: 100 },
  { x: 120, y: 130 },
  { x: 160, y: 170 },
  { x: 200, y: 230 },
];

async function ouvrir(page: import("@playwright/test").Page) {
  await page.goto("/vider-ma-tete");
  const canvas = page.getByRole("img", { name: /Feuille du soir/ });
  await expect(canvas).toBeVisible();
  return canvas;
}

test("écrit au stylet : le trait apparaît, est gardé sur le téléphone puis envoyé au serveur", async ({ page }) => {
  const canvas = await ouvrir(page);
  expect(await pixelsEncres(canvas)).toBe(0);

  await tracer(canvas, "pen", diagonale);
  await expect.poll(() => pixelsEncres(canvas)).toBeGreaterThan(50);

  // Sauvegarde locale immédiate, puis envoi après la pause d'écriture (2 s).
  await expect(page.getByTestId("vidage-statut")).toContainText(/Enregistré|envoi en attente/);
  await expect
    .poll(async () => (await ecritures("feuilles_vidage", "POST")).some((f) => Array.isArray(f.traits) && f.traits.length === 1), {
      timeout: 15_000,
    })
    .toBe(true);
  const ligne = (await ecritures("feuilles_vidage", "POST")).find((f) => Array.isArray(f.traits) && f.traits.length === 1)!;
  expect(ligne.jour).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect((ligne.traits as { e: number; p: number[] }[])[0].e).toBe(2);
});

test("le doigt ne laisse aucun trait par défaut (il fait défiler)", async ({ page }) => {
  const canvas = await ouvrir(page);
  await tracer(canvas, "touch", diagonale, 11);
  expect(await pixelsEncres(canvas)).toBe(0);
  await expect(page.getByTestId("vidage-statut")).toHaveText("");
});

test("la gomme retire le trait touché, annuler le rétablit", async ({ page }) => {
  const canvas = await ouvrir(page);
  await tracer(canvas, "pen", diagonale);
  await expect.poll(() => pixelsEncres(canvas)).toBeGreaterThan(50);

  await page.getByRole("button", { name: "Gomme" }).click();
  await tracer(canvas, "pen", [{ x: 100, y: 110 }, { x: 140, y: 150 }], 8);
  await expect.poll(() => pixelsEncres(canvas)).toBe(0);

  await page.getByRole("button", { name: "Annuler" }).click();
  await expect.poll(() => pixelsEncres(canvas)).toBeGreaterThan(50);
});

test("la feuille écrite est retrouvée après un rechargement", async ({ page }) => {
  const canvas = await ouvrir(page);
  await tracer(canvas, "pen", diagonale);
  await expect.poll(() => pixelsEncres(canvas)).toBeGreaterThan(50);
  await expect(page.getByTestId("vidage-statut")).toContainText("Enregistré");

  await page.reload();
  const apres = page.getByRole("img", { name: /Feuille du soir/ });
  await expect(apres).toBeVisible();
  await expect.poll(() => pixelsEncres(apres)).toBeGreaterThan(50);
});

const defilement = (page: import("@playwright/test").Page) => page.locator("main").evaluate((m) => m.scrollTop);

test("le stylet n'a jamais le droit de faire défiler la page, le doigt si", async ({ page }) => {
  const canvas = await ouvrir(page);
  const defilable = await page.locator("main").evaluate((m) => m.scrollHeight > m.clientHeight + 200);
  expect(defilable).toBe(true);
  const depart = await defilement(page);

  // Trait vertical au stylet : la feuille écrit, la page ne bouge pas.
  await tracer(canvas, "pen", [{ x: 60, y: 100 }, { x: 62, y: 180 }, { x: 64, y: 260 }, { x: 66, y: 340 }], 7);
  await expect.poll(() => pixelsEncres(canvas)).toBeGreaterThan(50);
  expect(await defilement(page)).toBe(depart);

  // Glissé du doigt vers le haut : la page défile (recréé par l'app, sans défilement natif).
  await tracer(canvas, "touch", [{ x: 150, y: 500 }, { x: 150, y: 420 }, { x: 150, y: 340 }, { x: 150, y: 260 }], 21);
  await expect.poll(() => defilement(page)).toBeGreaterThan(depart + 100);
});

test("effacer la feuille demande confirmation puis se laisse annuler", async ({ page }) => {
  const canvas = await ouvrir(page);
  await expect(page.getByRole("button", { name: "Effacer la feuille" })).toBeDisabled();
  await tracer(canvas, "pen", diagonale);
  await expect.poll(() => pixelsEncres(canvas)).toBeGreaterThan(50);

  // « Garder » referme sans rien effacer.
  await page.getByRole("button", { name: "Effacer la feuille" }).click();
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toContainText("Tu pourras revenir en arrière");
  await dialogue.getByRole("button", { name: "Garder" }).click();
  await expect(dialogue).toHaveCount(0);
  expect(await pixelsEncres(canvas)).toBeGreaterThan(50);

  // Confirmer vide la feuille ; le serveur reçoit la suppression de la ligne du jour.
  await page.getByRole("button", { name: "Effacer la feuille" }).click();
  await dialogue.getByRole("button", { name: "Effacer la feuille" }).click();
  await expect.poll(() => pixelsEncres(canvas)).toBe(0);
  await expect.poll(async () => (await ecritures("feuilles_vidage", "DELETE")).length, { timeout: 15_000 }).toBeGreaterThan(0);

  // Annuler restaure toute la feuille.
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect.poll(() => pixelsEncres(canvas)).toBeGreaterThan(50);
});

test("la barre du bas est masquée sur la feuille du soir mais pas sur le calendrier", async ({ page }) => {
  await ouvrir(page);
  await expect(page.getByRole("toolbar", { name: "Outils d'écriture" })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);

  await page.goto("/vider-ma-tete/calendrier");
  await expect(page.getByRole("heading", { name: "Relire" })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(1);
});
