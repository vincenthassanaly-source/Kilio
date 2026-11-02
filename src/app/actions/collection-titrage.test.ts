// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

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

import { analyserElementCollection, analyserElementsCollection, appliquerTitrage } from "./collection-titrage";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "33333333-3333-4333-8333-333333333333";
const COLLECTION = "22222222-2222-4222-8222-222222222222";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function lireElement(element: unknown): Repondre {
  return (a) => (a.table === "collection_items" && a.action === "select" ? { data: element } : undefined);
}

function reponseImage(type = "image/jpeg", octets = 4) {
  return new Response(new Uint8Array(octets), { status: 200, headers: { "content-type": type } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  // Les durées écrites par l'action dans le journal ne sont pas le sujet des tests.
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("analyserElementCollection", () => {
  it("rejette un identifiant invalide sans rien lire", async () => {
    const fake = brancher();
    const r = await analyserElementCollection("pas-un-uuid");
    expect(r).toMatchObject({ statut: "echec" });
    expect(fake.appels).toHaveLength(0);
  });

  it("envoie la photo à Gemini et renvoie la proposition nettoyée", async () => {
    brancher(lireElement({ type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: null }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseImage()));
    etat.gemini.mockResolvedValue({ ok: true, brut: { titre: "« Canapé vert. »", description: "Un canapé en velours." } });

    const r = await analyserElementCollection(ID);

    expect(r).toEqual({ statut: "ok", proposition: { titre: "Canapé vert", description: "Un canapé en velours." } });
    expect(etat.gemini.mock.calls[0][0].images).toHaveLength(1);
    expect(etat.gemini.mock.calls[0][0].etiquette).toBe("titrage-collection");
  });

  it("pour une vidéo, envoie la miniature (jamais le lien de la page)", async () => {
    brancher(
      lireElement({
        type: "tiktok",
        url: "https://www.tiktok.com/@x/video/1",
        thumbnail_url: "https://stockage.test/miniature.jpg",
        titre: "Gratin #recette",
      })
    );
    const fetchMock = vi.fn().mockResolvedValue(reponseImage());
    vi.stubGlobal("fetch", fetchMock);
    etat.gemini.mockResolvedValue({ ok: true, brut: { titre: "Gratin", description: "Une recette." } });

    await analyserElementCollection(ID);

    expect(fetchMock.mock.calls[0][0]).toBe("https://stockage.test/miniature.jpg");
  });

  it("continue avec le texte seul quand la miniature est introuvable", async () => {
    brancher(lireElement({ type: "youtube", url: "https://youtu.be/x", thumbnail_url: "https://stockage.test/m.jpg", titre: "Tuto" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    etat.gemini.mockResolvedValue({ ok: true, brut: { titre: "Tuto", description: "Un tutoriel." } });

    const r = await analyserElementCollection(ID);

    expect(r.statut).toBe("ok");
    expect(etat.gemini.mock.calls[0][0].images).toBeUndefined();
  });

  it("n'appelle pas Gemini sans image ni texte", async () => {
    brancher(lireElement({ type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: null }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    const r = await analyserElementCollection(ID);

    expect(r).toMatchObject({ statut: "echec", quota: false });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("ignore une réponse qui n'est pas une image", async () => {
    brancher(lireElement({ type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: "Légende" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseImage("text/html")));
    etat.gemini.mockResolvedValue({ ok: true, brut: { titre: "x", description: "y" } });

    await analyserElementCollection(ID);

    expect(etat.gemini.mock.calls[0][0].images).toBeUndefined();
  });

  it("signale le quota Gemini", async () => {
    brancher(lireElement({ type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: null }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseImage()));
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });

    expect(await analyserElementCollection(ID)).toEqual({ statut: "echec", erreur: "Quota atteint.", quota: true });
  });

  it("renvoie le détail d'un autre échec Gemini", async () => {
    brancher(lireElement({ type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: null }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseImage()));
    etat.gemini.mockResolvedValue({ ok: false, code: "echec", detail: "Délai dépassé" });

    const r = await analyserElementCollection(ID);

    expect(r).toMatchObject({ statut: "echec", quota: false });
    expect(r.statut === "echec" && r.erreur).toContain("Délai dépassé");
  });

  it("signale un élément introuvable", async () => {
    brancher(lireElement(null));
    expect(await analyserElementCollection(ID)).toMatchObject({ statut: "echec", erreur: "Élément introuvable." });
  });
});

describe("analyserElementsCollection (paquet)", () => {
  const parId =
    (elements: Record<string, unknown>): Repondre =>
    (a) => {
      if (a.table !== "collection_items" || a.action !== "select") return undefined;
      const id = a.filtres.find((f) => f[1] === "id")?.[2] as string;
      return { data: elements[id] ?? null };
    };

  it("renvoie un résultat par identifiant, dans l'ordre, chaque échec restant isolé", async () => {
    brancher(
      parId({
        [ID]: { type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: null },
        [ID2]: { type: "tiktok", url: "https://www.tiktok.com/@x/video/1", thumbnail_url: null, titre: null },
      })
    );
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(reponseImage())));
    etat.gemini.mockResolvedValue({ ok: true, brut: { titre: "Canapé", description: "Un canapé." } });

    const r = await analyserElementsCollection([ID, ID2]);

    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ statut: "ok", proposition: { titre: "Canapé" } });
    expect(r[1]).toMatchObject({ statut: "echec", quota: false });
    expect(etat.gemini).toHaveBeenCalledTimes(1);
  });

  it("lance les analyses en parallèle, pas l'une après l'autre", async () => {
    brancher(
      parId({
        [ID]: { type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: null },
        [ID2]: { type: "photo", url: "https://stockage.test/b.jpg", thumbnail_url: null, titre: null },
      })
    );
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(reponseImage())));
    let actifs = 0;
    let maximum = 0;
    etat.gemini.mockImplementation(async () => {
      actifs += 1;
      maximum = Math.max(maximum, actifs);
      await new Promise((resolve) => setTimeout(resolve, 20));
      actifs -= 1;
      return { ok: true, brut: { titre: "Titre", description: "Description." } };
    });

    await analyserElementsCollection([ID, ID2]);

    expect(maximum).toBe(2);
  });

  it("signale le quota sur l'élément concerné sans faire échouer les autres", async () => {
    brancher(
      parId({
        [ID]: { type: "photo", url: "https://stockage.test/a.jpg", thumbnail_url: null, titre: null },
        [ID2]: { type: "photo", url: "https://stockage.test/b.jpg", thumbnail_url: null, titre: null },
      })
    );
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(reponseImage())));
    etat.gemini
      .mockResolvedValueOnce({ ok: true, brut: { titre: "Titre", description: "Description." } })
      .mockResolvedValueOnce({ ok: false, code: "quota", detail: "429" });

    const r = await analyserElementsCollection([ID, ID2]);

    expect(r.map((x) => x.statut)).toEqual(["ok", "echec"]);
    expect(r[1]).toMatchObject({ quota: true });
  });

  it("refuse un paquet trop grand sans rien lire", async () => {
    const fake = brancher();
    const r = await analyserElementsCollection(Array.from({ length: 5 }, () => ID));
    expect(r).toHaveLength(5);
    expect(r.every((x) => x.statut === "echec")).toBe(true);
    expect(fake.appels).toHaveLength(0);
  });

  it("renvoie une liste vide pour une entrée invalide", async () => {
    brancher();
    expect(await analyserElementsCollection(undefined as unknown as string[])).toEqual([]);
  });
});

describe("appliquerTitrage", () => {
  it("écrit titre et description nettoyés, limités à la collection", async () => {
    const fake = brancher((a) => (a.action === "update" ? { data: [{ id: ID }] } : undefined));

    const r = await appliquerTitrage(COLLECTION, [{ id: ID, titre: "  Canapé   vert ", description: " Un canapé. " }]);

    expect(r).toEqual({ ok: true, data: { appliques: 1, echecs: 0 } });
    const [maj] = ecritures(fake.appels, "collection_items", "update");
    expect(maj.payload).toEqual({ titre: "Canapé vert", description: "Un canapé." });
    expect(maj.filtres).toContainEqual(["eq", "collection_id", COLLECTION]);
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/collection/${COLLECTION}`);
  });

  it("enregistre une description vide comme null", async () => {
    const fake = brancher((a) => (a.action === "update" ? { data: [{ id: ID }] } : undefined));
    await appliquerTitrage(COLLECTION, [{ id: ID, titre: "Titre", description: "  " }]);
    expect(ecritures(fake.appels, "collection_items", "update")[0].payload).toEqual({ titre: "Titre", description: null });
  });

  it("refuse un titre vide, un lot vide ou trop grand, et des identifiants invalides", async () => {
    const fake = brancher();
    expect(await appliquerTitrage(COLLECTION, [{ id: ID, titre: "  ", description: "x" }])).toMatchObject({ ok: false });
    expect(await appliquerTitrage(COLLECTION, [])).toMatchObject({ ok: false });
    expect(await appliquerTitrage("pas-un-uuid", [{ id: ID, titre: "a", description: "" }])).toMatchObject({ ok: false });
    expect(await appliquerTitrage(COLLECTION, [{ id: "x", titre: "a", description: "" }])).toMatchObject({ ok: false });
    const trop = Array.from({ length: 51 }, () => ({ id: ID, titre: "a", description: "" }));
    expect(await appliquerTitrage(COLLECTION, trop)).toMatchObject({ ok: false });
    expect(ecritures(fake.appels, "collection_items", "update")).toHaveLength(0);
  });

  it("compte les éléments introuvables ou refusés comme des échecs", async () => {
    brancher((a) => {
      if (a.action !== "update") return undefined;
      const id = a.filtres.find((f) => f[1] === "id")?.[2];
      return id === ID ? { data: [{ id }] } : { data: [] };
    });

    const r = await appliquerTitrage(COLLECTION, [
      { id: ID, titre: "A", description: "a" },
      { id: ID2, titre: "B", description: "b" },
    ]);

    expect(r).toEqual({ ok: true, data: { appliques: 1, echecs: 1 } });
  });

  it("explique que la migration manque quand la colonne description n'existe pas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    brancher((a) => (a.action === "update" ? { error: { message: "column does not exist", code: "42703" } } : undefined));

    const r = await appliquerTitrage(COLLECTION, [{ id: ID, titre: "A", description: "a" }]);

    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toContain("migration");
  });
});
