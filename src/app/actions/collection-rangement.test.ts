// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  gemini: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({
  appelerGemini: etat.gemini,
  MESSAGE_QUOTA_GEMINI: "Quota atteint.",
}));

import { suggererCollection } from "./collection-rangement";

const RECETTES = "11111111-1111-4111-8111-111111111111";
const DECO = "22222222-2222-4222-8222-222222222222";
const STOCKAGE = "https://projet.supabase.co/storage/v1/object/public/collection-images/a.jpg";

const COLLECTIONS = [
  { id: RECETTES, nom: "Recettes", collection_items: [{ titre: "Gratin", description: "Une recette" }] },
  { id: DECO, nom: "Déco", collection_items: [] },
];

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

const lireCollections =
  (lignes: unknown = COLLECTIONS): Repondre =>
  (a) =>
    a.table === "collections" && a.action === "select" ? { data: lignes } : undefined;

function reponseImage() {
  return new Response(new Uint8Array(4), { status: 200, headers: { "content-type": "image/jpeg" } });
}

/** `fetch` simulé qui renvoie une nouvelle réponse à chaque appel (un corps ne se lit qu'une fois). */
function fetchImage() {
  return vi.fn().mockImplementation(() => Promise.resolve(reponseImage()));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
  // Les durées écrites par le module d'analyse dans le journal ne sont pas le sujet des tests.
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("suggererCollection", () => {
  it("refuse une entrée vide", async () => {
    brancher(lireCollections());
    expect(await suggererCollection({ photoUrl: null, video: null })).toMatchObject({ statut: "echec" });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("renvoie la collection choisie par Gemini (numéro → identifiant)", async () => {
    brancher(lireCollections());
    vi.stubGlobal("fetch", fetchImage());
    etat.gemini.mockResolvedValue({ ok: true, brut: { numero: 2 } });

    const r = await suggererCollection({ photoUrl: STOCKAGE, video: null });

    expect(r).toEqual({ statut: "ok", collectionId: DECO });
    const appel = etat.gemini.mock.calls[0][0];
    expect(appel.images).toHaveLength(1);
    expect(appel.prompt).toContain("1. Recettes");
    expect(appel.etiquette).toBe("rangement-collection");
  });

  it("renvoie null quand Gemini répond 0 ou hors liste", async () => {
    brancher(lireCollections());
    vi.stubGlobal("fetch", fetchImage());
    etat.gemini.mockResolvedValue({ ok: true, brut: { numero: 0 } });
    expect(await suggererCollection({ photoUrl: STOCKAGE, video: null })).toEqual({ statut: "ok", collectionId: null });

    etat.gemini.mockResolvedValue({ ok: true, brut: { numero: 9 } });
    expect(await suggererCollection({ photoUrl: STOCKAGE, video: null })).toEqual({ statut: "ok", collectionId: null });
  });

  it("n'appelle pas Gemini quand il n'y a aucune collection", async () => {
    brancher(lireCollections([]));
    expect(await suggererCollection({ photoUrl: STOCKAGE, video: null })).toEqual({ statut: "ok", collectionId: null });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("ne télécharge jamais une adresse hors liste (SSRF) et se rabat sur le texte", async () => {
    brancher(lireCollections());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    etat.gemini.mockResolvedValue({ ok: true, brut: { numero: 1 } });

    const r = await suggererCollection({
      photoUrl: null,
      video: { type: "tiktok", thumbnailUrl: "http://169.254.169.254/latest/meta-data", titre: "Gratin #recette" },
    });

    expect(r).toEqual({ statut: "ok", collectionId: RECETTES });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(etat.gemini.mock.calls[0][0].images).toBeUndefined();
  });

  it("envoie la miniature d'une vidéo hébergée sur un CDN connu", async () => {
    brancher(lireCollections());
    const fetchMock = fetchImage();
    vi.stubGlobal("fetch", fetchMock);
    etat.gemini.mockResolvedValue({ ok: true, brut: { numero: 1 } });

    await suggererCollection({
      photoUrl: null,
      video: { type: "youtube", thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg", titre: "Tuto" },
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://i.ytimg.com/vi/x/hqdefault.jpg");
  });

  it("n'appelle pas Gemini sans image exploitable ni texte", async () => {
    brancher(lireCollections());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    const r = await suggererCollection({ photoUrl: STOCKAGE, video: null });

    expect(r).toMatchObject({ statut: "echec", quota: false });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("se rabat sur les titres seuls quand la colonne description n'existe pas encore", async () => {
    // Première lecture en erreur (colonne absente), seconde réussie.
    let lectures = 0;
    brancher((a) => {
      if (a.table !== "collections") return undefined;
      lectures += 1;
      return lectures === 1 ? { error: { message: "column description does not exist", code: "42703" } } : { data: COLLECTIONS };
    });
    vi.stubGlobal("fetch", fetchImage());
    etat.gemini.mockResolvedValue({ ok: true, brut: { numero: 1 } });

    expect(await suggererCollection({ photoUrl: STOCKAGE, video: null })).toEqual({ statut: "ok", collectionId: RECETTES });
    expect(lectures).toBe(2);
  });
});
