// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Appel, type Repondre } from "@/test/fake-supabase";

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

import {
  annulerReorganisationCollections,
  appliquerReorganisationCollections,
  proposerReorganisationCollections,
} from "./collection-reorganisation";

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const E1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const E2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEW = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const COLLECTIONS = [
  { id: C1, nom: "Recettes", ordre: 0 },
  { id: C2, nom: "Cuisine", ordre: 1 },
];

function item(id: string, collection_id: string, titre: string | null, description: string | null = null) {
  return { id, collection_id, titre, description, type: "photo", created_at: "2026-11-02T10:00:00Z" };
}

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

const aFiltre = (a: Appel, nom: string) => a.filtres.some((f) => f[0] === nom);
const aTri = (a: Appel) => a.modificateurs.some((m) => m[0] === "order");

beforeEach(() => {
  vi.clearAllMocks();
  // Les durées écrites par le module d'analyse dans le journal ne sont pas le sujet des tests.
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("proposerReorganisationCollections", () => {
  const lecture =
    (elements: unknown[]): Repondre =>
    (a) => {
      if (a.table === "collections" && a.action === "select") return { data: COLLECTIONS };
      if (a.table === "collection_items" && a.action === "select") return { data: elements };
      return undefined;
    };

  it("renvoie la suggestion lue dans la réponse de Gemini", async () => {
    brancher(lecture([item(E1, C1, "Gratin"), item(E2, C1, "Tarte"), item("e3", C2, null)]));
    etat.gemini.mockResolvedValue({
      ok: true,
      brut: { deplacements: [{ i: 1, collection: "Cuisine" }], fusions: [], renommages: [] },
    });

    const r = await proposerReorganisationCollections("  pas plus de 3  ");

    expect(r).toMatchObject({ statut: "ok", analyses: 2, nonLus: 1, tronque: false });
    if (r.statut !== "ok") throw new Error("attendu : ok");
    expect(r.suggestion.deplacements).toMatchObject([{ id: E1, deId: C1, versId: C2, versNom: "Cuisine" }]);
    expect(r.comptes).toEqual({ [C1]: 2, [C2]: 1 });
    const appel = etat.gemini.mock.calls[0][0];
    expect(appel.etiquette).toBe("reorganisation-collections");
    expect(appel.prompt).toContain("pas plus de 3");
  });

  it("n'appelle pas Gemini sans au moins deux éléments lisibles", async () => {
    brancher(lecture([item(E1, C1, "Gratin"), item(E2, C1, null, "  ")]));
    const r = await proposerReorganisationCollections();
    expect(r).toMatchObject({ statut: "echec", quota: false });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("se rabat sur les titres quand la colonne description n'existe pas encore", async () => {
    let lectures = 0;
    brancher((a) => {
      if (a.table === "collections") return { data: COLLECTIONS };
      if (a.table !== "collection_items") return undefined;
      lectures += 1;
      return lectures === 1
        ? { error: { message: "column does not exist", code: "42703" } }
        : { data: [item(E1, C1, "Gratin"), item(E2, C1, "Tarte")] };
    });
    etat.gemini.mockResolvedValue({ ok: true, brut: { deplacements: [], fusions: [], renommages: [] } });

    expect(await proposerReorganisationCollections()).toMatchObject({ statut: "ok", analyses: 2 });
    expect(lectures).toBe(2);
  });
});

describe("appliquerReorganisationCollections", () => {
  /** Base simulée : collections, élément E1 dans C1 (ordre 3), prochain rang 5 dans la destination. */
  const base =
    (extra: Repondre = () => undefined): Repondre =>
    (a) => {
      const surcharge = extra(a);
      if (surcharge) return surcharge;
      if (a.table === "collections" && a.action === "select") return { data: COLLECTIONS };
      if (a.table === "collection_items" && a.action === "select") {
        if (a.terminal === "maybeSingle") return { data: { ordre: 4 } };
        if (aFiltre(a, "in")) return { data: [{ id: E1, collection_id: C1, ordre: 3 }] };
        return aTri(a) ? { data: [] } : { count: 1 };
      }
      if (a.action === "update" || a.action === "delete") return { data: [{ id: E1 }] };
      return undefined;
    };

  it("refuse une sélection vide ou invalide", async () => {
    brancher(base());
    const vide = { deplacements: [], fusions: [], renommages: [] };
    expect(await appliquerReorganisationCollections(vide)).toMatchObject({ ok: false });
    expect(
      await appliquerReorganisationCollections({ ...vide, deplacements: [{ id: "x", versId: C2, versNom: "Cuisine" }] })
    ).toMatchObject({ ok: false });
    expect(await appliquerReorganisationCollections({ ...vide, fusions: [{ deId: C1, versId: C1 }] })).toMatchObject({
      ok: false,
    });
    expect(await appliquerReorganisationCollections({ ...vide, renommages: [{ id: C1, nom: "  " }] })).toMatchObject({
      ok: false,
    });
  });

  it("déplace un élément à la suite de la collection de destination et garde de quoi annuler", async () => {
    const fake = brancher(base());
    const r = await appliquerReorganisationCollections({
      deplacements: [{ id: E1, versId: C2, versNom: "Cuisine" }],
      fusions: [],
      renommages: [],
    });

    expect(r).toMatchObject({ ok: true, data: { deplaces: 1, echecs: 0, anciens: [{ id: E1, deId: C1, ordre: 3 }] } });
    const [maj] = ecritures(fake.appels, "collection_items", "update");
    expect(maj.payload).toEqual({ collection_id: C2, ordre: 5 });
    expect(maj.filtres).toContainEqual(["eq", "collection_id", C1]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/collection");
  });

  it("crée la collection d'un nouveau nom puis y déplace l'élément", async () => {
    const fake = brancher(
      base((a) => (a.table === "collections" && a.action === "insert" ? { data: { id: NEW } } : undefined))
    );
    const r = await appliquerReorganisationCollections({
      deplacements: [{ id: E1, versId: null, versNom: "Idées déco" }],
      fusions: [],
      renommages: [],
    });

    expect(r).toMatchObject({ ok: true, data: { deplaces: 1, creees: [NEW] } });
    expect(ecritures(fake.appels, "collections", "insert")[0].payload).toEqual({ nom: "Idées déco", ordre: 2 });
    expect(ecritures(fake.appels, "collection_items", "update")[0].payload).toMatchObject({ collection_id: NEW });
  });

  it("réutilise une collection existante de même nom au lieu d'en créer une", async () => {
    const fake = brancher(base());
    await appliquerReorganisationCollections({
      deplacements: [{ id: E1, versId: null, versNom: "cuisine" }],
      fusions: [],
      renommages: [],
    });
    expect(ecritures(fake.appels, "collections", "insert")).toHaveLength(0);
    expect(ecritures(fake.appels, "collection_items", "update")[0].payload).toMatchObject({ collection_id: C2 });
  });

  it("fusionne : déplace tout le contenu puis supprime la source, en gardant de quoi la recréer", async () => {
    const fake = brancher(
      base((a) =>
        a.table === "collection_items" && a.action === "select" && aFiltre(a, "eq") && aTri(a) && !aFiltre(a, "in")
          ? { data: [{ id: E1, ordre: 0 }, { id: E2, ordre: 1 }] }
          : undefined
      )
    );
    const r = await appliquerReorganisationCollections({
      deplacements: [],
      fusions: [{ deId: C2, versId: C1 }],
      renommages: [],
    });

    expect(r).toMatchObject({
      ok: true,
      data: { fusionnees: 1, deplaces: 2, supprimees: [{ id: C2, nom: "Cuisine", ordre: 1 }] },
    });
    expect(ecritures(fake.appels, "collection_items", "update")).toHaveLength(2);
    const [suppression] = ecritures(fake.appels, "collections", "delete");
    expect(suppression.filtres).toContainEqual(["eq", "id", C2]);
  });

  it("conserve la collection source si un élément n'a pas pu être déplacé", async () => {
    const fake = brancher(
      base((a) => {
        if (a.table === "collection_items" && a.action === "select" && aFiltre(a, "eq") && aTri(a) && !aFiltre(a, "in")) {
          return { data: [{ id: E1, ordre: 0 }] };
        }
        if (a.table === "collection_items" && a.action === "update") return { error: { message: "boom" } };
        return undefined;
      })
    );
    const r = await appliquerReorganisationCollections({
      deplacements: [],
      fusions: [{ deId: C2, versId: C1 }],
      renommages: [],
    });

    expect(r).toMatchObject({ ok: true, data: { fusionnees: 0, echecs: 1, supprimees: [] } });
    expect(ecritures(fake.appels, "collections", "delete")).toHaveLength(0);
  });

  it("renomme, mais jamais vers le nom d'une autre collection", async () => {
    const fake = brancher(base());
    const r = await appliquerReorganisationCollections({
      deplacements: [],
      fusions: [],
      renommages: [
        { id: C1, nom: "cuisine" },
        { id: C2, nom: "Plats" },
      ],
    });

    expect(r).toMatchObject({
      ok: true,
      data: {
        renommees: 1,
        echecs: 1,
        raison: "nom déjà pris par une autre collection",
        anciensNoms: [{ id: C2, nom: "Cuisine" }],
      },
    });
    expect(ecritures(fake.appels, "collections", "update").map((a) => a.payload)).toEqual([{ nom: "Plats" }]);
  });

  it("signale un élément supprimé entre-temps", async () => {
    brancher(
      base((a) => (a.table === "collection_items" && a.action === "select" && aFiltre(a, "in") ? { data: [] } : undefined))
    );
    const r = await appliquerReorganisationCollections({
      deplacements: [{ id: E1, versId: C2, versNom: "Cuisine" }],
      fusions: [],
      renommages: [],
    });
    expect(r).toMatchObject({ ok: true, data: { deplaces: 0, echecs: 1, raison: "élément supprimé entre-temps" } });
  });
});

describe("annulerReorganisationCollections", () => {
  it("refuse des données invalides sans rien écrire", async () => {
    const fake = brancher();
    expect(await annulerReorganisationCollections([{ id: "x", deId: C1, ordre: 0 }], [], [], [])).toMatchObject({ ok: false });
    expect(await annulerReorganisationCollections([], ["x"], [], [])).toMatchObject({ ok: false });
    expect(await annulerReorganisationCollections([], [], [{ id: C2, nom: " ", ordre: 0 }], [])).toMatchObject({ ok: false });
    expect(fake.appels).toHaveLength(0);
  });

  it("recrée les collections fusionnées avant d'y remettre les éléments, puis restaure les noms", async () => {
    const fake = brancher((a) => (a.table === "collection_items" && a.action === "select" ? { count: 0 } : undefined));
    const r = await annulerReorganisationCollections(
      [{ id: E1, deId: C2, ordre: 3 }],
      [NEW],
      [{ id: C2, nom: "Cuisine", ordre: 1 }],
      [{ id: C1, nom: "Recettes" }]
    );

    expect(r).toEqual({ ok: true, data: undefined });
    const ordre = fake.appels.filter((a) => a.action !== "select").map((a) => `${a.table}:${a.action}`);
    expect(ordre).toEqual(["collections:insert", "collection_items:update", "collections:update", "collections:delete"]);
    expect(ecritures(fake.appels, "collections", "insert")[0].payload).toEqual([{ id: C2, nom: "Cuisine", ordre: 1 }]);
    expect(ecritures(fake.appels, "collection_items", "update")[0].payload).toEqual({ collection_id: C2, ordre: 3 });
  });

  it("ne supprime pas une collection créée qui contient encore des éléments", async () => {
    const fake = brancher((a) => (a.table === "collection_items" && a.action === "select" ? { count: 2 } : undefined));
    await annulerReorganisationCollections([], [NEW], [], []);
    expect(ecritures(fake.appels, "collections", "delete")).toHaveLength(0);
  });

  it("signale une annulation incomplète", async () => {
    brancher((a) => (a.table === "collection_items" && a.action === "update" ? { error: { message: "boom" } } : undefined));
    const r = await annulerReorganisationCollections([{ id: E1, deId: C1, ordre: 0 }], [], [], []);
    expect(r).toMatchObject({ ok: false });
  });
});
