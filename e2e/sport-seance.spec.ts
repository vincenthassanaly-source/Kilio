// Module Sport : parcours complet d'une séance (démarrer depuis une routine,
// valider des séries, minuteur de repos, terminer et enregistrer), reprise
// après rechargement, séance terminée sans réseau puis envoyée au retour, et
// création d'une routine. Données : e2e/mock-supabase.mjs.
import { test, expect, type Page } from "@playwright/test";

const MOCK = process.env.E2E_SUPABASE_URL ?? "http://localhost:54321";

type Ecriture = { method: string; table: string; body: Record<string, unknown> | Record<string, unknown>[] };

async function ecritures(table: string): Promise<Record<string, unknown>[]> {
  const toutes: Ecriture[] = await (await fetch(`${MOCK}/__writes`)).json();
  return toutes
    .filter((w) => w.method === "POST" && w.table === table)
    .flatMap((w) => (Array.isArray(w.body) ? w.body : [w.body]));
}

const NOM_BANC = "Développé couché à la barre, prise moyenne";

async function demarrerPush(page: Page) {
  await page.goto("/sport");
  const routine = page.getByRole("region", { name: "Routine Push" });
  await expect(routine).toBeVisible();
  await routine.getByRole("button", { name: "Démarrer" }).click();
  await expect(page).toHaveURL(/\/sport\/seance$/);
  const banc = page.getByRole("region", { name: NOM_BANC });
  await expect(banc.getByText("0/3 séries")).toBeVisible();
  return banc;
}

test.beforeEach(async () => {
  await fetch(`${MOCK}/__reset`);
});

test("Séance : routine → séries validées → repos → terminer et enregistrer", async ({ page }) => {
  const banc = await demarrerPush(page);

  // Valider une série lance le repos prévu (90 s) ; +15 s le rallonge.
  await banc.getByRole("button", { name: "Valider la série 1" }).click();
  const minuteur = page.getByRole("timer");
  await expect(minuteur).toHaveText(/^1:(30|29)$/);
  await page.getByRole("button", { name: "Ajouter 15 secondes" }).click();
  await expect(minuteur).toHaveText(/^1:(45|44)$/);

  await banc.getByRole("button", { name: "Valider la série 2" }).click();
  await expect(banc.getByText("2/3 séries")).toBeVisible();

  // 2 séries sur 5 : confirmation avant d'enregistrer uniquement les séries cochées.
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await expect(page.getByText(/3 séries non validées ne seront pas enregistrées/)).toBeVisible();
  await page.getByRole("button", { name: "Terminer et enregistrer" }).click();

  await expect(page).toHaveURL(/\/sport$/);
  await expect(page.getByText("Séance enregistrée")).toBeVisible();

  await expect.poll(async () => (await ecritures("sport_seances")).length).toBe(1);
  const series = await ecritures("sport_series");
  expect(series).toHaveLength(2);
  expect(series.map((s) => s.exercice_id)).toEqual(["Barbell_Bench_Press_-_Medium_Grip", "Barbell_Bench_Press_-_Medium_Grip"]);
  expect(series[0]).toMatchObject({ position: 0, ordre: 0 });
  // Le repos réellement pris est connu pour la 1re série (suivie de la 2e).
  expect(typeof series[0].repos_pris_s).toBe("number");
  // La séance fait de ce jour un jour d'entraînement dans le journal nutritionnel.
  await expect
    .poll(async () => (await ecritures("journal_jours")).some((j) => j.jour_type === "entrainement"))
    .toBe(true);

  // La dernière séance apparaît sur l'accueil Sport.
  await expect(page.getByRole("region", { name: "Dernière séance" })).toContainText("Push");
});

test("Séance : un clic sur l'exercice ouvre son aperçu sans perdre la saisie", async ({ page }) => {
  const banc = await demarrerPush(page);
  await banc.getByRole("button", { name: "Valider la série 1" }).click();

  await banc.getByRole("button", { name: `Aperçu de ${NOM_BANC}` }).click();
  const apercu = page.getByRole("dialog", { name: NOM_BANC });
  await expect(apercu).toBeVisible();
  await expect(apercu.getByRole("list", { name: "Caractéristiques" })).toBeVisible();

  // Le développé couché a des poses : illustration dessinée, pas de photo.
  await expect(apercu.locator("[data-dessin] path").first()).toBeVisible();
  await expect(apercu.locator("img")).toHaveCount(0);

  await apercu.getByRole("button", { name: "Fermer" }).click();
  await expect(apercu).toBeHidden();
  // La séance est intacte : la série validée le reste.
  await expect(banc.getByRole("button", { name: "Annuler la série 1" })).toHaveAttribute("aria-pressed", "true");
});

test("Séance : un exercice sans poses validées garde sa photo", async ({ page }) => {
  await demarrerPush(page);
  const squat = page.getByRole("region", { name: "Squat à la barre" });
  // Vignette : photo, pas de dessin.
  await expect(squat.locator("img").first()).toBeVisible();

  await squat.getByRole("button", { name: "Aperçu de Squat à la barre" }).click();
  const apercu = page.getByRole("dialog", { name: "Squat à la barre" });
  await expect(apercu.locator("img").first()).toBeVisible();
  await expect(apercu.locator("[data-dessin] path")).toHaveCount(0);
});

test("Séance : reprise après rechargement, sans perdre les séries validées", async ({ page }) => {
  const banc = await demarrerPush(page);
  await banc.getByRole("button", { name: "Valider la série 1" }).click();
  await expect(banc.getByRole("button", { name: "Annuler la série 1" })).toBeVisible();

  await page.reload();
  const bancApres = page.getByRole("region", { name: NOM_BANC });
  await expect(bancApres.getByRole("button", { name: "Annuler la série 1" })).toHaveAttribute("aria-pressed", "true");

  // Retour à l'accueil : la séance reste proposée à la reprise.
  await page.goto("/sport");
  await expect(page.getByRole("region", { name: "Séance en cours" })).toContainText("1/5 séries");
});

test("Séance terminée sans réseau : gardée sur le téléphone puis envoyée au retour", async ({ page, context }) => {
  const banc = await demarrerPush(page);
  await banc.getByRole("button", { name: "Valider la série 1" }).click();
  await page.getByRole("button", { name: "Terminer", exact: true }).click();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Terminer et enregistrer" }).click();
  await expect(page.getByText(/gardée sur ton téléphone/)).toBeVisible();
  expect(await ecritures("sport_seances")).toHaveLength(0);

  // Retour du réseau : au lancement de l'app, la séance en attente est envoyée.
  await context.setOffline(false);
  await page.goto("/sport");
  await expect(page.getByText(/Séance de sport synchronisée/)).toBeVisible();
  // Un envoi peut partir deux fois (évènement « online » puis relance de l'app) :
  // sans effet côté serveur, l'enregistrement est idempotent (même identifiant).
  const identifiants = async (table: string) => new Set((await ecritures(table)).map((ligne) => ligne.id));
  await expect.poll(async () => (await identifiants("sport_seances")).size).toBe(1);
  expect((await identifiants("sport_series")).size).toBe(1);
});

test("Routine : créer « Legs » avec un exercice", async ({ page }) => {
  await page.goto("/sport/routines/nouvelle");
  await page.getByPlaceholder("Push, Pull, Legs…").fill("Legs");
  await page.getByRole("button", { name: "+ Ajouter un exercice" }).click();

  const feuille = page.getByRole("dialog", { name: "Ajouter un exercice" });
  await feuille.getByRole("searchbox", { name: "Rechercher un exercice" }).fill("squat");
  await feuille.getByRole("button", { name: /Squat à la barre/ }).click();

  await expect(page.getByRole("region", { name: "Squat à la barre" })).toBeVisible();
  await page.getByRole("button", { name: "Plus de séries" }).click();
  await page.getByRole("button", { name: "Enregistrer la routine" }).click();

  await expect(page).toHaveURL(/\/sport$/);
  await expect.poll(async () => (await ecritures("sport_routines")).some((r) => r.nom === "Legs")).toBe(true);
  const lignes = await ecritures("sport_routine_exercices");
  expect(lignes).toHaveLength(1);
  expect(lignes[0]).toMatchObject({ exercice_id: "Barbell_Squat", nb_series: 4, position: 0 });
});
