import { beforeEach, describe, expect, it, vi } from "vitest";

const sharpMock = vi.hoisted(() => {
  const chaine = {
    rotate: vi.fn(),
    resize: vi.fn(),
    jpeg: vi.fn(),
    toBuffer: vi.fn(),
  };
  chaine.rotate.mockReturnValue(chaine);
  chaine.resize.mockReturnValue(chaine);
  chaine.jpeg.mockReturnValue(chaine);
  chaine.toBuffer.mockResolvedValue(Buffer.from("jpeg-compresse"));
  return { chaine, sharp: vi.fn(() => chaine) };
});

vi.mock("sharp", () => ({ default: sharpMock.sharp }));

import {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_DIMENSION,
  compresserEtUploaderImage,
  extraireCheminStorage,
  retirerObjetsStorage,
} from "./objets";

const BASE = "https://x.supabase.co/storage/v1/object/public";

describe("extraireCheminStorage", () => {
  it("extrait le chemin d'objet d'une URL publique du bon bucket", () => {
    expect(extraireCheminStorage(`${BASE}/documents-fichiers/abc.jpg`, "documents-fichiers")).toBe("abc.jpg");
  });

  it("conserve les sous-dossiers", () => {
    expect(extraireCheminStorage(`${BASE}/collection-images/miniatures/abc.jpg`, "collection-images")).toBe(
      "miniatures/abc.jpg"
    );
  });

  it("renvoie null pour l'URL d'un autre bucket", () => {
    expect(extraireCheminStorage(`${BASE}/collection-images/abc.jpg`, "documents-fichiers")).toBeNull();
  });

  it("renvoie null pour une URL invalide ou vide", () => {
    expect(extraireCheminStorage("pas une url", "documents-fichiers")).toBeNull();
    expect(extraireCheminStorage("", "documents-fichiers")).toBeNull();
  });

  it("ne décode pas les caractères encodés (chemin renvoyé tel que stocké)", () => {
    expect(extraireCheminStorage(`${BASE}/documents-fichiers/a%20b%C3%A9.pdf`, "documents-fichiers")).toBe(
      "a%20b%C3%A9.pdf"
    );
  });
});

function faireClientStorage(opts: { uploadError?: string; removeError?: string } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: opts.uploadError ? { message: opts.uploadError } : null });
  const getPublicUrl = vi.fn((chemin: string) => ({ data: { publicUrl: `${BASE}/bucket-test/${chemin}` } }));
  const remove = vi.fn().mockResolvedValue({ error: opts.removeError ? { message: opts.removeError } : null });
  const from = vi.fn(() => ({ upload, getPublicUrl, remove }));
  // Client minimal : seul `storage.from` est utilisé par le module.
  return { client: { storage: { from } } as never, from, upload, getPublicUrl, remove };
}

describe("compresserEtUploaderImage", () => {
  beforeEach(() => {
    sharpMock.sharp.mockClear();
    sharpMock.chaine.rotate.mockClear();
    sharpMock.chaine.resize.mockClear();
    sharpMock.chaine.jpeg.mockClear();
  });

  it("compresse avec sharp en 1600 px / qualité 75 puis envoie dans le bucket demandé", async () => {
    const entree = Buffer.from("source");
    const { client, from, upload } = faireClientStorage();

    const url = await compresserEtUploaderImage(client, "collection-images", entree);

    expect(IMAGE_MAX_DIMENSION).toBe(1600);
    expect(IMAGE_JPEG_QUALITY).toBe(75);
    expect(sharpMock.sharp).toHaveBeenCalledWith(entree);
    expect(sharpMock.chaine.rotate).toHaveBeenCalledWith();
    expect(sharpMock.chaine.resize).toHaveBeenCalledWith(1600, 1600, { fit: "inside", withoutEnlargement: true });
    expect(sharpMock.chaine.jpeg).toHaveBeenCalledWith({ quality: 75 });
    expect(from).toHaveBeenCalledWith("collection-images");
    const [chemin, contenu, options] = upload.mock.calls[0];
    expect(chemin).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(contenu).toEqual(Buffer.from("jpeg-compresse"));
    expect(options).toEqual({ contentType: "image/jpeg" });
    expect(url).toBe(`${BASE}/bucket-test/${chemin}`);
  });

  it("passe le bucket en paramètre (documents-fichiers)", async () => {
    const { client, from } = faireClientStorage();
    await compresserEtUploaderImage(client, "documents-fichiers", Buffer.from("x"));
    expect(from).toHaveBeenCalledWith("documents-fichiers");
  });

  it("remonte l'erreur de stockage avec son message, sans demander d'URL", async () => {
    const { client, getPublicUrl } = faireClientStorage({ uploadError: "quota dépassé" });
    await expect(compresserEtUploaderImage(client, "documents-fichiers", Buffer.from("x"))).rejects.toThrow(
      "quota dépassé"
    );
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
});

describe("retirerObjetsStorage", () => {
  it("retire le lot d'objets du bucket demandé en un seul appel", async () => {
    const { client, from, remove } = faireClientStorage();
    const erreur = await retirerObjetsStorage(client, "documents-fichiers", ["a.jpg", "b.pdf"]);
    expect(erreur).toBeNull();
    expect(from).toHaveBeenCalledWith("documents-fichiers");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(["a.jpg", "b.pdf"]);
  });

  it("ne touche pas au stockage si la liste est vide", async () => {
    const { client, from } = faireClientStorage();
    expect(await retirerObjetsStorage(client, "documents-fichiers", [])).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("renvoie l'erreur de stockage pour que l'appelant la lève ou la journalise", async () => {
    const { client } = faireClientStorage({ removeError: "objet verrouillé" });
    const erreur = await retirerObjetsStorage(client, "collection-images", ["a.jpg"]);
    expect(erreur).toEqual({ message: "objet verrouillé" });
  });
});
