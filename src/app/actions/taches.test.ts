// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("next/cache", () => ({
  revalidatePath: etat.revalidatePath,
  revalidateTag: etat.revalidateTag,
  updateTag: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  annulerCochage,
  deleteTache,
  deplacerTaches,
  enregistrerOrdreTaches,
  planifierTache,
  reporterTaches,
  restaurerPlanification,
  restaurerTaches,
  setTacheFait,
  supprimerTaches,
} from "./taches";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const LISTE = "33333333-3333-4333-8333-333333333333";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("setTacheFait", () => {
  it("bascule simplement `fait` pour une tâche non récurrente", async () => {
    const fake = brancher((a) =>
      a.action === "select"
        ? { data: { echeance: "2026-10-09", recurrence_frequence: null, recurrence_fin: null } }
        : undefined
    );

    await setTacheFait(ID1, true);

    const [maj] = ecritures(fake.appels, "taches", "update");
    expect(maj.payload).toEqual({ fait: true, echeance: "2026-10-09" });
    expect(maj.filtres).toContainEqual(["eq", "id", ID1]);
    expect(ecritures(fake.appels, "sous_taches")).toHaveLength(0);
    expect(etat.revalidateTag).toHaveBeenCalledWith("taches", { expire: 0 });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches");
  });

  it("avance l'échéance d'une récurrente, rouvre ses sous-tâches et réarme le rappel", async () => {
    const fake = brancher((a) =>
      a.action === "select"
        ? { data: { echeance: "2026-10-09", recurrence_frequence: "quotidien", recurrence_fin: null } }
        : undefined
    );

    await setTacheFait(ID1, true);

    const [maj] = ecritures(fake.appels, "taches", "update");
    expect(maj.payload).toEqual({ fait: false, echeance: "2026-10-10", rappel_envoye_le: null });
    const [sous] = ecritures(fake.appels, "sous_taches", "update");
    expect(sous.payload).toEqual({ fait: false, termine_le: null });
    expect(sous.filtres).toContainEqual(["eq", "tache_id", ID1]);
  });

  it("ignore une coche rejouée dont l'échéance observée n'est plus celle du serveur", async () => {
    const fake = brancher((a) =>
      a.action === "select"
        ? { data: { echeance: "2026-10-10", recurrence_frequence: "quotidien", recurrence_fin: null } }
        : undefined
    );

    await setTacheFait(ID1, true, "2026-10-09");

    expect(ecritures(fake.appels, "taches")).toHaveLength(0);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches");
  });

  it("lève l'erreur de lecture, de mise à jour et de réinitialisation des sous-tâches", async () => {
    const lecture = { echeance: "2026-10-09", recurrence_frequence: "quotidien", recurrence_fin: null };

    brancher((a) => (a.action === "select" ? { error: { message: "lecture ko" } } : undefined));
    await expect(setTacheFait(ID1, true)).rejects.toThrow("lecture ko");

    brancher((a) =>
      a.action === "select" ? { data: lecture } : a.table === "taches" ? { error: { message: "maj ko" } } : undefined
    );
    await expect(setTacheFait(ID1, true)).rejects.toThrow("maj ko");

    brancher((a) =>
      a.action === "select" ? { data: lecture } : a.table === "sous_taches" ? { error: { message: "sous ko" } } : undefined
    );
    await expect(setTacheFait(ID1, true)).rejects.toThrow("sous ko");
  });
});

describe("deleteTache", () => {
  it("supprime la tâche et revalide", async () => {
    const fake = brancher();
    await deleteTache(ID1);
    expect(ecritures(fake.appels, "taches", "delete")[0].filtres).toContainEqual(["eq", "id", ID1]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/agenda");
  });

  it("lève l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(deleteTache(ID1)).rejects.toThrow("ko");
  });
});

describe("annulerCochage", () => {
  it("refuse un id qui n'est pas un UUID, sans toucher la base", async () => {
    const fake = brancher();
    expect(await annulerCochage("pas-un-uuid", false)).toEqual({ ok: false, error: "Tâche introuvable." });
    expect(fake.appels).toHaveLength(0);
  });

  it("ne change que la case sans échéance fournie", async () => {
    const fake = brancher();
    expect(await annulerCochage(ID1, false)).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "taches", "update")[0].payload).toEqual({ fait: false });
  });

  it("restaure l'échéance (même nulle) et réarme le rappel", async () => {
    const fake = brancher();
    await annulerCochage(ID1, false, null);
    expect(ecritures(fake.appels, "taches", "update")[0].payload).toEqual({
      fait: false,
      echeance: null,
      rappel_envoye_le: null,
    });
  });

  it("renvoie l'erreur Supabase au lieu de lever", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await annulerCochage(ID1, true)).toEqual({ ok: false, error: "ko" });
  });
});

describe("actions groupées", () => {
  it("reporterTaches valide la sélection et la date", async () => {
    const fake = brancher();
    expect(await reporterTaches([], "2026-10-12")).toEqual({ ok: false, error: "Sélection invalide." });
    expect(await reporterTaches(["x"], "2026-10-12")).toEqual({ ok: false, error: "Sélection invalide." });
    expect(await reporterTaches([ID1], "12/10/2026")).toEqual({ ok: false, error: "Date invalide." });
    expect(fake.appels).toHaveLength(0);
  });

  it("reporterTaches dédoublonne les ids et réarme le rappel", async () => {
    const fake = brancher();
    expect(await reporterTaches([ID1, ID1, ID2], "2026-10-12")).toMatchObject({ ok: true });
    const [maj] = ecritures(fake.appels, "taches", "update");
    expect(maj.payload).toEqual({ echeance: "2026-10-12", rappel_envoye_le: null });
    expect(maj.filtres).toContainEqual(["in", "id", [ID1, ID2]]);
  });

  it("refuse plus de 200 tâches d'un coup", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(await supprimerTaches(ids)).toEqual({ ok: false, error: "Sélection invalide." });
  });

  it("supprimerTaches supprime par lot et remonte l'erreur", async () => {
    const fake = brancher();
    expect(await supprimerTaches([ID1, ID2])).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "taches", "delete")[0].filtres).toContainEqual(["in", "id", [ID1, ID2]]);

    brancher(() => ({ error: { message: "ko" } }));
    expect(await supprimerTaches([ID1])).toEqual({ ok: false, error: "ko" });
  });

  it("deplacerTaches range les tâches à la suite de la liste cible en gardant leur ordre", async () => {
    const fake = brancher((a) => {
      if (a.action !== "select") return undefined;
      if (a.terminal === "maybeSingle") return { data: { ordre: 4 } };
      return { data: [{ id: ID1, ordre: 0 }, { id: ID2, ordre: 1 }] };
    });

    expect(await deplacerTaches([ID1, ID2], LISTE)).toMatchObject({ ok: true });

    const majs = ecritures(fake.appels, "taches", "update");
    expect(majs.map((m) => m.payload)).toEqual([
      { liste_id: LISTE, ordre: 5 },
      { liste_id: LISTE, ordre: 6 },
    ]);
  });

  it("deplacerTaches commence à 0 dans une liste vide et valide ses entrées", async () => {
    const fake = brancher((a) =>
      a.action === "select" && a.terminal !== "maybeSingle" ? { data: [{ id: ID1, ordre: 3 }] } : undefined
    );
    await deplacerTaches([ID1], LISTE);
    expect(ecritures(fake.appels, "taches", "update")[0].payload).toEqual({ liste_id: LISTE, ordre: 0 });

    expect(await deplacerTaches([ID1], "nope")).toEqual({ ok: false, error: "Liste introuvable." });
    expect(await deplacerTaches([], LISTE)).toEqual({ ok: false, error: "Sélection invalide." });
  });

  it("deplacerTaches remonte l'erreur de lecture et celle d'une mise à jour", async () => {
    brancher((a) => (a.action === "select" && a.terminal !== "maybeSingle" ? { error: { message: "lecture ko" } } : undefined));
    expect(await deplacerTaches([ID1], LISTE)).toEqual({ ok: false, error: "lecture ko" });

    brancher((a) => {
      if (a.action === "select") return a.terminal === "maybeSingle" ? undefined : { data: [{ id: ID1, ordre: 0 }] };
      return { error: { message: "maj ko" } };
    });
    expect(await deplacerTaches([ID1], LISTE)).toEqual({ ok: false, error: "maj ko" });
  });

  it("restaurerTaches rétablit échéance, liste et ordre pour chaque tâche", async () => {
    const fake = brancher();
    const etats = [
      { id: ID1, echeance: "2026-10-01", liste_id: LISTE, ordre: 2 },
      { id: ID2, echeance: null, liste_id: LISTE, ordre: 3 },
    ];
    expect(await restaurerTaches(etats)).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "taches", "update").map((m) => m.payload)).toEqual([
      { echeance: "2026-10-01", liste_id: LISTE, ordre: 2, rappel_envoye_le: null },
      { echeance: null, liste_id: LISTE, ordre: 3, rappel_envoye_le: null },
    ]);
  });

  it("restaurerTaches refuse une liste invalide et remonte une erreur", async () => {
    expect(await restaurerTaches([{ id: ID1, echeance: null, liste_id: "x", ordre: 0 }])).toEqual({
      ok: false,
      error: "Sélection invalide.",
    });
    brancher(() => ({ error: { message: "ko" } }));
    expect(await restaurerTaches([{ id: ID1, echeance: null, liste_id: LISTE, ordre: 0 }])).toEqual({
      ok: false,
      error: "ko",
    });
  });
});

describe("planification", () => {
  it("planifierTache pose date, heure et fin calculée, et écrit la durée seulement si demandé", async () => {
    const fake = brancher();
    expect(await planifierTache(ID1, "2026-10-09", "14:00", 45, true)).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "taches", "update")[0].payload).toEqual({
      echeance: "2026-10-09",
      heure: "14:00",
      heure_fin: "14:45",
      toute_la_journee: false,
      rappel_envoye_le: null,
      duree_minutes: 45,
    });

    const sans = brancher();
    await planifierTache(ID1, "2026-10-09", "14:00", 45, false);
    expect(ecritures(sans.appels, "taches", "update")[0].payload).not.toHaveProperty("duree_minutes");
  });

  it("planifierTache refuse un id, une date ou un créneau invalide", async () => {
    expect(await planifierTache("x", "2026-10-09", "14:00", 30, false)).toEqual({ ok: false, error: "Tâche introuvable." });
    expect(await planifierTache(ID1, "demain", "14:00", 30, false)).toEqual({ ok: false, error: "Date invalide." });
    expect(await planifierTache(ID1, "2026-10-09", "23:30", 120, false)).toEqual({
      ok: false,
      error: "Ce créneau ne tient pas dans la journée.",
    });
  });

  it("restaurerPlanification n'écrit la durée que si elle est fournie", async () => {
    const fake = brancher();
    const base = { echeance: "2026-10-01", heure: null, heure_fin: null, toute_la_journee: true };
    await restaurerPlanification(ID1, base);
    expect(ecritures(fake.appels, "taches", "update")[0].payload).toEqual({ ...base, rappel_envoye_le: null });

    await restaurerPlanification(ID1, { ...base, duree_minutes: null });
    expect(ecritures(fake.appels, "taches", "update")[1].payload).toMatchObject({ duree_minutes: null });

    expect(await restaurerPlanification("x", base)).toEqual({ ok: false, error: "Tâche introuvable." });
  });
});

describe("enregistrerOrdreTaches", () => {
  it("ne fait rien sans modification", async () => {
    const fake = brancher();
    await enregistrerOrdreTaches([]);
    expect(fake.appels).toHaveLength(0);
    expect(etat.revalidatePath).not.toHaveBeenCalled();
  });

  it("écrit l'ordre de chaque tâche puis lève si une écriture échoue", async () => {
    const fake = brancher();
    await enregistrerOrdreTaches([{ id: ID1, ordre: 0 }, { id: ID2, ordre: 1 }]);
    expect(ecritures(fake.appels, "taches", "update").map((m) => m.payload)).toEqual([{ ordre: 0 }, { ordre: 1 }]);

    brancher(() => ({ error: { message: "ko" } }));
    await expect(enregistrerOrdreTaches([{ id: ID1, ordre: 0 }])).rejects.toThrow("ko");
  });
});
