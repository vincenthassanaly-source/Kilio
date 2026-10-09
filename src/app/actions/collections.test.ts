// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre, type RepondreStockage } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  metadonnees: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: etat.redirect }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/collection/video", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/collection/video")>()),
  recupererMetadonneesVideo: etat.metadonnees,
}));

import {
  ajouterLienVideo,
  createCollection,
  deleteCollection,
  deleteCollectionItem,
  getCollectionAvecPhotos,
  getCollections,
  getCollectionsAvecApercu,
  rattacherPhotoACollection,
  recupererLienVideoPartage,
  renameCollection,
  televerserPhotosPartagees,
  uploadCollectionPhotos,
  uploaderPhotosPartagees,
} from "./collections";

const ID = "11111111-1111-4111-8111-111111111111";
const BUCKET = "collection-images";
const URL_PUBLIQUE = `https://stockage.test/storage/v1/object/public/${BUCKET}`;

function brancher(repondre?: Repondre, stockage?: RepondreStockage) {
  const fake = fauxSupabase(repondre, stockage);
  etat.client = fake.client;
  return fake;
}

async function photo(nom = "p.png") {
  const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  return new File([new Uint8Array(buffer)], nom, { type: "image/png" });
}

function form(champs: Record<string, string | File | (string | File)[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("lectures", () => {
  it("getCollectionsAvecApercu limite la mosaïque à 4 vignettes et compte toutes les photos", async () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      url: `https://x/${i}.jpg`,
      thumbnail_url: i === 0 ? "https://x/miniature.jpg" : null,
      type: i === 1 ? "tiktok" : "photo",
      ordre: i,
    }));
    brancher(() => ({ data: [{ id: ID, nom: "Voyage", collection_items: items }] }));

    const [col] = await getCollectionsAvecApercu();

    expect(col.nb_photos).toBe(6);
    expect(col.photos_apercu).toEqual([
      { url: "https://x/miniature.jpg", type: "photo" },
      { url: "https://x/1.jpg", type: "tiktok" },
      { url: "https://x/2.jpg", type: "photo" },
      { url: "https://x/3.jpg", type: "photo" },
    ]);
    expect(col).not.toHaveProperty("collection_items");
  });

  it("getCollectionsAvecApercu, getCollections renvoient [] sans données et lèvent sur erreur", async () => {
    brancher();
    expect(await getCollectionsAvecApercu()).toEqual([]);
    expect(await getCollections()).toEqual([]);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getCollectionsAvecApercu()).rejects.toThrow("ko");
    await expect(getCollections()).rejects.toThrow("ko");
  });

  it("getCollectionAvecPhotos renomme les items en photos, null si absente", async () => {
    brancher(() => ({ data: { id: ID, nom: "Voyage", collection_items: [{ id: "i1" }] } }));
    expect(await getCollectionAvecPhotos(ID)).toEqual({ id: ID, nom: "Voyage", photos: [{ id: "i1" }] });
    brancher();
    expect(await getCollectionAvecPhotos(ID)).toBeNull();
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getCollectionAvecPhotos(ID)).rejects.toThrow("ko");
  });
});

describe("createCollection et renameCollection", () => {
  it("createCollection refuse un nom vide", async () => {
    const fake = brancher();
    expect(await createCollection({ error: null }, form({ nom: " " }))).toEqual({ error: "Le nom est requis." });
    expect(fake.appels).toHaveLength(0);
  });

  it("createCollection insère à la suite et revalide", async () => {
    const fake = brancher((a) => {
      if (a.action === "select") return { data: { ordre: 4 } };
      if (a.action === "insert") return { data: { id: ID } };
      return undefined;
    });
    expect(await createCollection({ error: null }, form({ nom: " Voyage " }))).toEqual({ error: null });
    expect(ecritures(fake.appels, "collections", "insert")[0].payload).toEqual({ nom: "Voyage", ordre: 5 });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/collection");
  });

  it("createCollection renvoie l'erreur Supabase", async () => {
    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await createCollection({ error: null }, form({ nom: "x" }))).toEqual({ error: "ko" });
  });

  it("renameCollection nettoie, refuse le vide et revalide le détail", async () => {
    const fake = brancher();
    await expect(renameCollection(ID, "  ")).rejects.toThrow("Le nom est requis.");
    await renameCollection(ID, " Été ");
    expect(ecritures(fake.appels, "collections", "update")[0].payload).toEqual({ nom: "Été" });
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/collection/${ID}`);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(renameCollection(ID, "x")).rejects.toThrow("ko");
  });
});

describe("deleteCollection", () => {
  it("supprime les images du stockage (hors liens vidéo externes) puis la collection", async () => {
    const fake = brancher((a) =>
      a.table === "collection_items"
        ? { data: [{ url: `${URL_PUBLIQUE}/a.jpg` }, { url: "https://www.tiktok.com/@x/video/1" }, { url: `${URL_PUBLIQUE}/b.jpg` }] }
        : undefined
    );
    await deleteCollection(ID);
    expect(fake.stockage).toEqual([{ bucket: BUCKET, action: "remove", chemins: ["a.jpg", "b.jpg"] }]);
    expect(ecritures(fake.appels, "collections", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
  });

  it("ne touche pas au stockage quand il n'y a que des liens externes", async () => {
    const fake = brancher((a) => (a.table === "collection_items" ? { data: [{ url: "https://youtu.be/x" }] } : undefined));
    await deleteCollection(ID);
    expect(fake.stockage).toHaveLength(0);
  });

  it("garde la collection si le nettoyage du stockage échoue, et lève les autres erreurs", async () => {
    const fake = brancher(
      (a) => (a.table === "collection_items" ? { data: [{ url: `${URL_PUBLIQUE}/a.jpg` }] } : undefined),
      () => ({ error: { message: "stockage ko" } })
    );
    await expect(deleteCollection(ID)).rejects.toThrow("stockage ko");
    expect(ecritures(fake.appels, "collections")).toHaveLength(0);

    brancher((a) => (a.table === "collection_items" ? { error: { message: "lecture ko" } } : undefined));
    await expect(deleteCollection(ID)).rejects.toThrow("lecture ko");
    brancher((a) => (a.table === "collections" ? { error: { message: "suppression ko" } } : undefined));
    await expect(deleteCollection(ID)).rejects.toThrow("suppression ko");
  });
});

describe("uploadCollectionPhotos", () => {
  it("ne fait rien sans photo", async () => {
    const fake = brancher();
    await uploadCollectionPhotos(ID, form({}));
    await uploadCollectionPhotos(ID, form({ photos: new File([], "vide.png") }));
    expect(fake.appels).toHaveLength(0);
  });

  it("compresse en JPEG, envoie et numérote à la suite de l'existant", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 9 } } : undefined));
    await uploadCollectionPhotos(ID, form({ photos: [await photo("a.png"), await photo("b.png")] }));

    expect(fake.stockage.map((s) => s.contentType)).toEqual(["image/jpeg", "image/jpeg"]);
    const lignes = ecritures(fake.appels, "collection_items", "insert")[0].payload as Record<string, unknown>[];
    expect(lignes.map((l) => [l.collection_id, l.ordre])).toEqual([[ID, 10], [ID, 11]]);
    expect(String(lignes[0].url)).toMatch(new RegExp(`^${URL_PUBLIQUE}/[0-9a-f-]{36}\\.jpg$`));
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/collection/${ID}`);
  });

  it("lève l'erreur d'envoi (sans insérer) ou d'insertion", async () => {
    const fake = brancher(undefined, () => ({ error: { message: "envoi ko" } }));
    await expect(uploadCollectionPhotos(ID, form({ photos: await photo() }))).rejects.toThrow("envoi ko");
    expect(ecritures(fake.appels, "collection_items")).toHaveLength(0);

    brancher((a) => (a.action === "insert" ? { error: { message: "insert ko" } } : undefined));
    await expect(uploadCollectionPhotos(ID, form({ photos: await photo() }))).rejects.toThrow("insert ko");
  });
});

describe("ajouterLienVideo", () => {
  const meta = { type: "youtube", url: "https://youtu.be/abc", thumbnailUrl: "https://i/a.jpg", titre: "Titre" };

  it("refuse un lien vide ou introuvable", async () => {
    const fake = brancher();
    await expect(ajouterLienVideo(ID, "  ")).rejects.toThrow("Le lien est requis.");
    etat.metadonnees.mockResolvedValue(null);
    await expect(ajouterLienVideo(ID, "https://exemple.fr")).rejects.toThrow("Lien TikTok ou YouTube invalide ou introuvable.");
    expect(fake.appels).toHaveLength(0);
  });

  it("insère le lien avec ses métadonnées à la suite de l'existant", async () => {
    etat.metadonnees.mockResolvedValue(meta);
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 1 } } : undefined));
    await ajouterLienVideo(ID, " https://youtu.be/abc ");
    expect(etat.metadonnees).toHaveBeenCalledWith("https://youtu.be/abc");
    expect(ecritures(fake.appels, "collection_items", "insert")[0].payload).toEqual({
      collection_id: ID,
      type: "youtube",
      url: "https://youtu.be/abc",
      thumbnail_url: "https://i/a.jpg",
      titre: "Titre",
      ordre: 2,
    });
  });

  it("met un titre vide à null et lève l'erreur d'insertion", async () => {
    etat.metadonnees.mockResolvedValue({ ...meta, titre: "" });
    const fake = brancher();
    await ajouterLienVideo(ID, "https://youtu.be/abc");
    expect(ecritures(fake.appels, "collection_items", "insert")[0].payload).toMatchObject({ titre: null, ordre: 0 });

    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    await expect(ajouterLienVideo(ID, "https://youtu.be/abc")).rejects.toThrow("ko");
  });
});

describe("deleteCollectionItem", () => {
  it("supprime l'image du stockage puis la ligne", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { url: `${URL_PUBLIQUE}/a.jpg`, collection_id: "C1" } } : undefined));
    await deleteCollectionItem(ID);
    expect(fake.stockage).toEqual([{ bucket: BUCKET, action: "remove", chemins: ["a.jpg"] }]);
    expect(ecritures(fake.appels, "collection_items", "delete")).toHaveLength(1);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/collection/C1");
  });

  it("ne touche pas au stockage pour un lien externe", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { url: "https://youtu.be/x", collection_id: "C1" } } : undefined));
    await deleteCollectionItem(ID);
    expect(fake.stockage).toHaveLength(0);
  });

  it("lève les erreurs de lecture, de stockage et de suppression", async () => {
    brancher((a) => (a.action === "select" ? { error: { message: "lecture ko" } } : undefined));
    await expect(deleteCollectionItem(ID)).rejects.toThrow("lecture ko");

    const fake = brancher((a) => (a.action === "select" ? { data: { url: `${URL_PUBLIQUE}/a.jpg`, collection_id: "C1" } } : undefined), () => ({
      error: { message: "stockage ko" },
    }));
    await expect(deleteCollectionItem(ID)).rejects.toThrow("stockage ko");
    expect(ecritures(fake.appels, "collection_items")).toHaveLength(0);

    brancher((a) => (a.action === "select" ? { data: { url: "https://youtu.be/x", collection_id: "C1" } } : { error: { message: "ligne ko" } }));
    await expect(deleteCollectionItem(ID)).rejects.toThrow("ligne ko");
  });
});

describe("partage natif", () => {
  it("uploaderPhotosPartagees renvoie les URL publiques", async () => {
    brancher();
    const urls = await uploaderPhotosPartagees([await photo(), await photo()]);
    expect(urls).toHaveLength(2);
    urls.forEach((u) => expect(u).toMatch(new RegExp(`^${URL_PUBLIQUE}/`)));
  });

  it("televerserPhotosPartagees renvoie [] sans photo, les URL sinon, et un message en cas d'échec", async () => {
    brancher();
    expect(await televerserPhotosPartagees(form({}))).toEqual({ ok: true, data: [] });
    const res = await televerserPhotosPartagees(form({ photos: await photo() }));
    expect(res.ok && res.data).toHaveLength(1);

    brancher(undefined, () => ({ error: { message: "ko" } }));
    expect(await televerserPhotosPartagees(form({ photos: await photo() }))).toEqual({
      ok: false,
      error: "Les photos partagées n'ont pas pu être envoyées. Réessaie.",
    });
  });

  it("recupererLienVideoPartage délègue au dispatcher vidéo", async () => {
    etat.metadonnees.mockResolvedValue({ type: "tiktok" });
    expect(await recupererLienVideoPartage("https://vm.tiktok.com/x")).toEqual({ type: "tiktok" });
  });
});

describe("rattacherPhotoACollection", () => {
  const etatInitial = { error: null };

  it.each([
    ["rien à rattacher", { collection_id: ID }, "Rien à rattacher."],
    ["type de vidéo inconnu", { collection_id: ID, video_url: "https://x", video_type: "vimeo" }, "Type de vidéo inconnu."],
    ["aucune collection", { url: "https://x/a.jpg" }, "Choisis une collection ou crée-en une nouvelle."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await rattacherPhotoACollection(etatInitial, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });

  it("rattache photos et vidéo à une collection existante dans l'ordre, puis redirige", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 3 } } : undefined));

    await expect(
      rattacherPhotoACollection(
        etatInitial,
        form({
          collection_id: ID,
          url: ["https://x/a.jpg", "https://x/b.jpg"],
          video_url: "https://youtu.be/abc",
          video_type: "youtube",
          video_thumbnail: "https://i/a.jpg",
          video_titre: "Titre",
        })
      )
    ).rejects.toThrow(`REDIRECT:/collection/${ID}`);

    expect(ecritures(fake.appels, "collection_items", "insert")[0].payload).toEqual([
      { collection_id: ID, url: "https://x/a.jpg", ordre: 4 },
      { collection_id: ID, url: "https://x/b.jpg", ordre: 5 },
      { collection_id: ID, type: "youtube", url: "https://youtu.be/abc", thumbnail_url: "https://i/a.jpg", titre: "Titre", ordre: 6 },
    ]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/collection");
  });

  it("crée la collection à la volée quand aucun id n'est choisi", async () => {
    const fake = brancher((a) => (a.table === "collections" && a.action === "insert" ? { data: { id: "NEUVE" } } : undefined));

    await expect(
      rattacherPhotoACollection(etatInitial, form({ nouvelle_collection: " Italie ", url: "https://x/a.jpg" }))
    ).rejects.toThrow("REDIRECT:/collection/NEUVE");

    expect(ecritures(fake.appels, "collections", "insert")[0].payload).toMatchObject({ nom: "Italie" });
    expect(ecritures(fake.appels, "collection_items", "insert")[0].payload).toEqual([
      { collection_id: "NEUVE", url: "https://x/a.jpg", ordre: 0 },
    ]);
  });

  it("met miniature et titre vides à null pour une vidéo", async () => {
    const fake = brancher();
    await expect(
      rattacherPhotoACollection(etatInitial, form({ collection_id: ID, video_url: "https://youtu.be/abc", video_type: "youtube" }))
    ).rejects.toThrow("REDIRECT");
    expect(ecritures(fake.appels, "collection_items", "insert")[0].payload).toEqual([
      expect.objectContaining({ thumbnail_url: null, titre: null }),
    ]);
  });

  it("renvoie l'erreur d'insertion sans rediriger", async () => {
    brancher((a) => (a.action === "insert" ? { error: { message: "insert ko" } } : undefined));
    expect(await rattacherPhotoACollection(etatInitial, form({ collection_id: ID, url: "https://x/a.jpg" }))).toEqual({
      error: "insert ko",
    });
    expect(etat.redirect).not.toHaveBeenCalled();
  });

  it("renvoie l'erreur de création de la collection sans rien rattacher", async () => {
    const fake = brancher((a) => (a.table === "collections" && a.action === "insert" ? { error: { message: "création ko" } } : undefined));
    expect(await rattacherPhotoACollection(etatInitial, form({ nouvelle_collection: "X", url: "https://x/a.jpg" }))).toEqual({
      error: "création ko",
    });
    expect(ecritures(fake.appels, "collection_items")).toHaveLength(0);
  });
});
