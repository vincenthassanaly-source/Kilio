// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAction } from "@/lib/actions/runAction";
import { fauxSupabase, type Appel, type Repondre } from "@/test/fake-supabase";

/** Toutes les écritures, dans l'ordre où elles ont été faites. */
function ecritures(appels: Appel[]): Appel[] {
  return appels.filter((a) => a.action !== "select");
}

const etat = vi.hoisted(() => ({
  client: null as unknown,
  revalidatePath: vi.fn(),
  gemini: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({
  appelerGemini: etat.gemini,
  MESSAGE_QUOTA_GEMINI: "Quota atteint.",
}));

import { annulerReorganisation, appliquerReorganisation, proposerReorganisation } from "./documents-reorganisation";

const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const D3 = "33333333-3333-4333-8333-333333333333";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

const CATEGORIES = [{ nom: "Autre" }, { nom: "Santé" }];

function documents() {
  return [
    { id: D1, nom: "Fiche de paie - mars", categorie: "Autre", notes: null, en_vrac: false, created_at: "2026-03-01T00:00:00Z" },
    { id: D2, nom: "Fiche de paie - avril", categorie: "Autre", notes: null, en_vrac: false, created_at: "2026-02-01T00:00:00Z" },
    { id: D3, nom: "scan0042", categorie: "Autre", notes: null, en_vrac: true, created_at: "2026-01-01T00:00:00Z" },
  ];
}

function filtre(appel: Appel, type: string): unknown[] | undefined {
  return appel.filtres.find((f) => f[0] === type);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proposerReorganisation", () => {
  it("envoie les documents classés à Gemini et rend les changements, vrac compté à part", async () => {
    brancher((a) => {
      if (a.table === "documents" && a.action === "select") return { data: documents() };
      if (a.table === "documents_categories") return { data: CATEGORIES };
      return undefined;
    });
    etat.gemini.mockResolvedValue({
      ok: true,
      brut: { documents: [{ i: 1, categorie: "Travail" }, { i: 2, categorie: "Travail" }] },
    });

    const resultat = await proposerReorganisation("  pas plus de 8 catégories ");

    expect(resultat).toMatchObject({ statut: "ok", analyses: 2, tronque: false, comptes: { Autre: 3 } });
    if (resultat.statut !== "ok") throw new Error("attendu : ok");
    expect(resultat.changements.map((c) => [c.id, c.de, c.vers, c.nouvelle])).toEqual([
      [D1, "Autre", "Travail", true],
      [D2, "Autre", "Travail", true],
    ]);
    const { prompt } = etat.gemini.mock.calls[0][0];
    expect(prompt).toContain("1. Fiche de paie - mars");
    expect(prompt).not.toContain("scan0042");
    expect(prompt).toContain("« pas plus de 8 catégories »");
  });

  it("refuse s'il y a moins de deux documents classés, sans appeler Gemini", async () => {
    brancher((a) => (a.table === "documents" ? { data: documents().slice(0, 1) } : { data: CATEGORIES }));
    expect(await proposerReorganisation()).toMatchObject({ statut: "echec", quota: false });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("signale le quota Gemini", async () => {
    brancher((a) => (a.table === "documents" ? { data: documents() } : { data: CATEGORIES }));
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });
    expect(await proposerReorganisation()).toEqual({ statut: "echec", erreur: "Quota atteint.", quota: true });
  });

  it("donne la raison d'un échec de Gemini", async () => {
    brancher((a) => (a.table === "documents" ? { data: documents() } : { data: CATEGORIES }));
    etat.gemini.mockResolvedValue({ ok: false, code: "echec", detail: "délai dépassé" });
    expect(await proposerReorganisation()).toMatchObject({
      statut: "echec",
      erreur: expect.stringContaining("délai dépassé"),
    });
  });

  it("arrive intacte jusqu'au composant à travers runAction", async () => {
    brancher((a) => (a.table === "documents" ? { data: documents() } : { data: CATEGORIES }));
    etat.gemini.mockResolvedValue({ ok: true, brut: { documents: [] } });

    const resultat = await runAction(() => proposerReorganisation(), { silencieux: true });

    expect(resultat.ok).toBe(true);
    expect(resultat.data).toMatchObject({ statut: "ok", changements: [] });
  });
});

describe("appliquerReorganisation", () => {
  it("refuse une liste vide ou invalide sans toucher à la base", async () => {
    const fake = brancher();
    expect(await appliquerReorganisation([], true)).toEqual({ ok: false, error: "Rien à appliquer." });
    expect(await appliquerReorganisation([{ id: "pas-un-uuid", vers: "Travail" }], true)).toMatchObject({ ok: false });
    expect(await appliquerReorganisation([{ id: D1, vers: "  " }], true)).toMatchObject({ ok: false });
    expect(fake.appels).toHaveLength(0);
  });

  it("crée les catégories nouvelles, déplace les documents et supprime la catégorie vidée", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents" && a.action === "select" && filtre(a, "in")) {
        return { data: [{ id: D1, categorie: "Autre" }, { id: D2, categorie: "Autre" }] };
      }
      if (a.table === "documents" && a.action === "select") return { count: 0 };
      if (a.table === "documents" && a.action === "update") return { data: [{ id: D1 }, { id: D2 }] };
      if (a.table === "documents_categories" && a.action === "select") return { data: CATEGORIES };
      return undefined;
    });

    const resultat = await appliquerReorganisation(
      [{ id: D1, vers: "Travail" }, { id: D2, vers: "travail" }],
      true
    );

    expect(resultat).toEqual({
      ok: true,
      data: {
        appliques: 2,
        echecs: 0,
        raison: null,
        anciennes: [{ id: D1, de: "Autre" }, { id: D2, de: "Autre" }],
        creees: ["Travail"],
        supprimees: ["Autre"],
      },
    });
    expect(ecritures(fake.appels)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "documents_categories", action: "insert", payload: [{ nom: "Travail" }] }),
        expect.objectContaining({ table: "documents", action: "update", payload: { categorie: "Travail" } }),
        expect.objectContaining({ table: "documents_categories", action: "delete" }),
      ])
    );
    expect(etat.revalidatePath).toHaveBeenCalledWith("/documents");
  });

  it("garde la catégorie d'origine quand elle contient encore un document (le vrac, par exemple)", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents" && a.action === "select" && filtre(a, "in")) {
        return { data: [{ id: D1, categorie: "Autre" }] };
      }
      if (a.table === "documents" && a.action === "select") return { count: 1 };
      if (a.table === "documents" && a.action === "update") return { data: [{ id: D1 }] };
      if (a.table === "documents_categories" && a.action === "select") return { data: CATEGORIES };
      return undefined;
    });

    const resultat = await appliquerReorganisation([{ id: D1, vers: "Santé" }], true);

    expect(resultat).toMatchObject({ ok: true, data: { appliques: 1, supprimees: [] } });
    expect(fake.appels.some((a) => a.table === "documents_categories" && a.action === "delete")).toBe(false);
  });

  it("ne supprime aucune catégorie quand la case est décochée", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents" && a.action === "select" && filtre(a, "in")) {
        return { data: [{ id: D1, categorie: "Autre" }] };
      }
      if (a.table === "documents" && a.action === "update") return { data: [{ id: D1 }] };
      if (a.table === "documents_categories" && a.action === "select") return { data: CATEGORIES };
      return undefined;
    });

    expect(await appliquerReorganisation([{ id: D1, vers: "Santé" }], false)).toMatchObject({
      ok: true,
      data: { supprimees: [] },
    });
    expect(fake.appels.some((a) => a.table === "documents_categories" && a.action === "delete")).toBe(false);
  });

  it("retire la catégorie créée si la base refuse les déplacements, et dit pourquoi", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents" && a.action === "select" && filtre(a, "in")) {
        return { data: [{ id: D1, categorie: "Autre" }] };
      }
      if (a.table === "documents" && a.action === "update") return { error: { message: "check", code: "23514" } };
      if (a.table === "documents_categories" && a.action === "select") return { data: CATEGORIES };
      return undefined;
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultat = await appliquerReorganisation([{ id: D1, vers: "Travail" }], true);

    expect(resultat).toEqual({
      ok: true,
      data: { appliques: 0, echecs: 1, raison: "catégorie refusée par la base", anciennes: [], creees: [], supprimees: [] },
    });
    expect(fake.appels).toContainEqual(
      expect.objectContaining({ table: "documents_categories", action: "delete", filtres: [["in", "nom", ["Travail"]]] })
    );
  });

  it("compte comme échec un document sorti du classement depuis l'aperçu", async () => {
    brancher((a) => {
      if (a.table === "documents" && a.action === "select" && filtre(a, "in")) return { data: [] };
      if (a.table === "documents_categories" && a.action === "select") return { data: CATEGORIES };
      return undefined;
    });

    expect(await appliquerReorganisation([{ id: D1, vers: "Santé" }], true)).toMatchObject({
      ok: true,
      data: { appliques: 0, echecs: 1, raison: "déjà sorti du classement ou supprimé" },
    });
  });
});

describe("annulerReorganisation", () => {
  it("refuse une liste vide ou invalide", async () => {
    const fake = brancher();
    expect(await annulerReorganisation([], [], [])).toEqual({ ok: false, error: "Rien à annuler." });
    expect(await annulerReorganisation([{ id: "x", de: "Autre" }], [], [])).toMatchObject({ ok: false });
    expect(await annulerReorganisation([{ id: D1, de: "  " }], [], [])).toMatchObject({ ok: false });
    expect(fake.appels).toHaveLength(0);
  });

  it("recrée les catégories supprimées, remet chaque document en place et retire les catégories créées", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories" && a.action === "select") {
        return { data: [{ nom: "Santé" }, { nom: "Travail" }] };
      }
      if (a.table === "documents" && a.action === "update") return { data: [{ id: D1 }, { id: D2 }] };
      if (a.table === "documents" && a.action === "select") return { count: 0 };
      return undefined;
    });

    const resultat = await annulerReorganisation(
      [{ id: D1, de: "Autre" }, { id: D2, de: "Autre" }],
      ["Travail"],
      ["Autre"]
    );

    expect(resultat).toEqual({ ok: true, data: { restaures: 2 } });
    const ecrits = ecritures(fake.appels);
    // La catégorie supprimée revient AVANT que les documents n'y retournent.
    const indexInsert = ecrits.findIndex((e) => e.table === "documents_categories" && e.action === "insert");
    const indexUpdate = ecrits.findIndex((e) => e.table === "documents" && e.action === "update");
    expect(indexInsert).toBeGreaterThanOrEqual(0);
    expect(indexInsert).toBeLessThan(indexUpdate);
    expect(ecrits[indexInsert]).toMatchObject({ payload: [{ nom: "Autre" }] });
    expect(ecrits[indexUpdate]).toMatchObject({ payload: { categorie: "Autre" } });
    expect(ecrits).toContainEqual(
      expect.objectContaining({ table: "documents_categories", action: "delete", filtres: [["eq", "nom", "Travail"]] })
    );
  });

  it("remet à « sans catégorie » un document qui n'en avait pas", async () => {
    const fake = brancher((a) => (a.table === "documents" && a.action === "update" ? { data: [{ id: D1 }] } : undefined));
    expect(await annulerReorganisation([{ id: D1, de: null }], [], [])).toEqual({ ok: true, data: { restaures: 1 } });
    expect(ecritures(fake.appels)).toContainEqual(
      expect.objectContaining({ table: "documents", action: "update", payload: { categorie: null } })
    );
  });

  it("garde une catégorie créée qui contient encore des documents", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents" && a.action === "update") return { data: [{ id: D1 }] };
      if (a.table === "documents" && a.action === "select") return { count: 2 };
      return undefined;
    });
    await annulerReorganisation([{ id: D1, de: "Autre" }], ["Travail"], []);
    expect(fake.appels.some((a) => a.table === "documents_categories" && a.action === "delete")).toBe(false);
  });
});
