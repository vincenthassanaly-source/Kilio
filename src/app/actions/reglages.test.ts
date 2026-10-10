// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { getReglagesBriefing, updateReglagesBriefing, updateReglagesRevue } from "./briefing";
import { upsertObjectif } from "./objectifs-nutritionnels";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function form(champs: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

const repos = {
  repos_kcal_cible: "2000",
  repos_proteines_cible_g: "120",
  repos_glucides_cible_g: "220",
  repos_lipides_cible_g: "60",
};

const entrainement = {
  entrainement_kcal_cible: "2600",
  entrainement_proteines_cible_g: "160",
  entrainement_glucides_cible_g: "320",
  entrainement_lipides_cible_g: "75",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("upsertObjectif : validation", () => {
  it.each([
    ["aucune cible de repos", {}, "Renseigne l'objectif de repos (kcal)."],
    ["seulement l'entraînement", entrainement, "Renseigne l'objectif de repos (kcal)."],
    ["kcal négatives", { ...repos, repos_kcal_cible: "-10" }, "Les objectifs doivent être des nombres positifs."],
    ["kcal non numériques", { ...repos, repos_kcal_cible: "beaucoup" }, "Les objectifs doivent être des nombres positifs."],
    ["macro négative", { ...repos, repos_lipides_cible_g: "-1" }, "Les objectifs doivent être des nombres positifs."],
    ["kcal au-dessus de 10 000", { ...repos, repos_kcal_cible: "10001" }, "L'objectif calorique doit rester sous 10 000 kcal."],
    ["macro au-dessus de 1000 g", { ...repos, repos_glucides_cible_g: "1001" }, "Les objectifs de macros doivent rester sous 1000 g."],
    ["erreur sur l'entraînement", { ...repos, ...entrainement, entrainement_kcal_cible: "20000" }, "L'objectif calorique doit rester sous 10 000 kcal."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await upsertObjectif({ error: null }, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });

  it("accepte les bornes exactes (10 000 kcal, 1000 g)", async () => {
    brancher();
    const res = await upsertObjectif(
      { error: null },
      form({ ...repos, repos_kcal_cible: "10000", repos_proteines_cible_g: "1000" })
    );
    expect(res).toEqual({ error: null });
  });
});

describe("upsertObjectif", () => {
  it("enregistre uniquement la cible de repos quand l'entraînement est vide", async () => {
    const fake = brancher();
    expect(await upsertObjectif({ error: null }, form(repos))).toEqual({ error: null });
    expect(ecritures(fake.appels, "objectifs_nutritionnels", "upsert")[0].payload).toEqual([
      { jour_type: "repos", kcal_cible: 2000, proteines_cible_g: 120, glucides_cible_g: 220, lipides_cible_g: 60 },
    ]);
  });

  it("enregistre repos et entraînement en une seule écriture", async () => {
    const fake = brancher();
    await upsertObjectif({ error: null }, form({ ...repos, ...entrainement }));
    const lignes = ecritures(fake.appels, "objectifs_nutritionnels", "upsert");
    expect(lignes).toHaveLength(1);
    expect((lignes[0].payload as { jour_type: string }[]).map((l) => l.jour_type)).toEqual(["repos", "entrainement"]);
  });

  it("met à 0 les macros non renseignées", async () => {
    const fake = brancher();
    await upsertObjectif({ error: null }, form({ repos_kcal_cible: "1800" }));
    expect(ecritures(fake.appels, "objectifs_nutritionnels", "upsert")[0].payload).toEqual([
      { jour_type: "repos", kcal_cible: 1800, proteines_cible_g: 0, glucides_cible_g: 0, lipides_cible_g: 0 },
    ]);
  });

  it("revalide le journal, le bilan et l'accueil", async () => {
    brancher();
    await upsertObjectif({ error: null }, form(repos));
    for (const chemin of ["/nutrition/journal", "/nutrition/bilan", "/"]) {
      expect(etat.revalidatePath).toHaveBeenCalledWith(chemin);
    }
  });

  it("n'expose jamais l'erreur brute du driver, mais la journalise", async () => {
    brancher(() => ({ error: { message: 'duplicate key value violates unique constraint "x"' } }));
    expect(await upsertObjectif({ error: null }, form(repos))).toEqual({
      error: "Impossible d'enregistrer l'objectif. Réessaie dans un instant.",
    });
    expect(console.error).toHaveBeenCalled();
    expect(etat.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("briefing", () => {
  it("getReglagesBriefing lit la ligne unique (id 1) et lève sur erreur", async () => {
    const fake = brancher(() => ({ data: { id: 1, actif: true, heure: "08:00" } }));
    expect(await getReglagesBriefing()).toEqual({ id: 1, actif: true, heure: "08:00" });
    expect(fake.appels[0].filtres).toContainEqual(["eq", "id", 1]);

    brancher(() => ({ error: { message: "ko" } }));
    await expect(getReglagesBriefing()).rejects.toThrow("ko");
  });

  it.each([["8h"], ["24:00"], ["12:60"], [""]])("updateReglagesBriefing refuse l'heure %j", async (heure) => {
    const fake = brancher();
    expect(await updateReglagesBriefing(true, heure)).toEqual({ ok: false, error: "Heure invalide (format HH:MM)." });
    expect(fake.appels).toHaveLength(0);
  });

  it("updateReglagesBriefing change l'activation et l'heure sans toucher au dernier envoi", async () => {
    const fake = brancher();
    expect(await updateReglagesBriefing(false, "07:30")).toMatchObject({ ok: true });
    const [maj] = ecritures(fake.appels, "reglages_briefing", "update");
    expect(maj.payload).toEqual({ actif: false, heure: "07:30" });
    expect(maj.filtres).toContainEqual(["eq", "id", 1]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/reglages");
  });

  it("updateReglagesBriefing masque l'erreur brute", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await updateReglagesBriefing(true, "08:00")).toEqual({
      ok: false,
      error: "Le réglage n'a pas pu être enregistré. Réessaie.",
    });
  });

  it.each([[-1], [7], [1.5], [NaN]])("updateReglagesRevue refuse le jour %s", async (jour) => {
    const fake = brancher();
    expect(await updateReglagesRevue(true, jour, "18:00")).toEqual({ ok: false, error: "Jour invalide." });
    expect(fake.appels).toHaveLength(0);
  });

  it("updateReglagesRevue refuse une heure invalide et accepte les jours 0 à 6", async () => {
    brancher();
    expect(await updateReglagesRevue(true, 0, "18h")).toEqual({ ok: false, error: "Heure invalide (format HH:MM)." });

    const fake = brancher();
    expect(await updateReglagesRevue(true, 0, "18:00")).toMatchObject({ ok: true });
    expect(await updateReglagesRevue(false, 6, "09:15")).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "reglages_briefing", "update").map((m) => m.payload)).toEqual([
      { revue_actif: true, revue_jour: 0, revue_heure: "18:00" },
      { revue_actif: false, revue_jour: 6, revue_heure: "09:15" },
    ]);
  });

  it("updateReglagesRevue masque l'erreur brute", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await updateReglagesRevue(true, 1, "18:00")).toEqual({
      ok: false,
      error: "Le réglage n'a pas pu être enregistré. Réessaie.",
    });
  });
});
