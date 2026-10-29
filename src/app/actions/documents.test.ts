// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre, type RepondreStockage } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), redirect: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: etat.redirect }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  createDocument,
  deleteDocument,
  deleteDocumentFichier,
  enregistrerApercuPdf,
  getDocument,
  getDocuments,
  updateDocument,
} from "./documents";

const ID = "11111111-1111-4111-8111-111111111111";
const FICHIER = "22222222-2222-4222-8222-222222222222";
const BUCKET = "documents-fichiers";
const URL_PUBLIQUE = `https://stockage.test/storage/v1/object/public/${BUCKET}`;

function brancher(repondre?: Repondre, stockage?: RepondreStockage) {
  const fake = fauxSupabase(repondre, stockage);
  etat.client = fake.client;
  return fake;
}

async function png() {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: "#ffffff" } }).png().toBuffer();
}

async function fichierImage(nom = "photo.png") {
  return new File([new Uint8Array(await png())], nom, { type: "image/png" });
}

function fichierPdf(nom = "doc.pdf") {
  return new File([new TextEncoder().encode("%PDF-1.4 contenu")], nom, { type: "application/pdf" });
}

function form(champs: Record<string, string | File | (string | File)[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

const reponseCreation: Repondre = (a) =>
  a.table === "documents" && a.action === "insert"
    ? { data: { id: ID } }
    : // « Assurance » existe dans documents_categories ; « Loisir » (test de validation) non.
      a.table === "documents_categories" && a.filtres.some((f) => f[0] === "eq" && f[2] === "Assurance")
      ? { data: { id: "C1" } }
      : undefined;

beforeEach(() => {
  vi.clearAllMocks();
  etat.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("createDocument : validation", () => {
  it("refuse un nom vide, une catégorie inconnue ou l'absence de fichier", async () => {
    const fake = brancher();
    expect(await createDocument({ error: null }, form({ nom: " " }))).toEqual({ error: "Le nom est requis." });
    expect(await createDocument({ error: null }, form({ nom: "CNI", categorie: "Loisir" }))).toEqual({
      error: "Catégorie invalide.",
    });
    expect(await createDocument({ error: null }, form({ nom: "CNI" }))).toEqual({
      error: "Au moins un fichier (photo ou PDF) est requis.",
    });
    // Seule la vérification de la catégorie interroge la base : rien n'est écrit.
    expect(ecritures(fake.appels, "documents")).toHaveLength(0);
    expect(fake.appels.filter((a) => a.table !== "documents_categories")).toHaveLength(0);
  });

  it("ignore un fichier vide", async () => {
    const fake = brancher();
    const vide = new File([], "vide.pdf", { type: "application/pdf" });
    expect(await createDocument({ error: null }, form({ nom: "CNI", fichiers: vide }))).toEqual({
      error: "Au moins un fichier (photo ou PDF) est requis.",
    });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("createDocument : migration des catégories pas encore appliquée", () => {
  it("accepte une catégorie d'origine quand la table documents_categories est absente", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories") return { error: { message: 'relation "documents_categories" does not exist' } };
      return reponseCreation(a);
    });

    const res = await createDocument({ error: null }, form({ nom: "Contrat", categorie: "Assurance", fichiers: fichierPdf() }));

    expect(res).toEqual({ error: null });
    expect(ecritures(fake.appels, "documents", "insert")[0].payload).toMatchObject({ categorie: "Assurance" });
  });

  it("refuse toujours une catégorie inconnue quand la table est absente", async () => {
    brancher((a) =>
      a.table === "documents_categories" ? { error: { message: "relation does not exist" } } : reponseCreation(a)
    );

    expect(await createDocument({ error: null }, form({ nom: "CNI", categorie: "Loisir", fichiers: fichierPdf() }))).toEqual({
      error: "Catégorie invalide.",
    });
  });
});

describe("createDocument", () => {
  it("enregistre le document normalisé puis ses fichiers PDF", async () => {
    const fake = brancher(reponseCreation);

    const res = await createDocument(
      { error: null },
      form({
        nom: " Assurance auto ",
        categorie: "Assurance",
        notes: "  contrat n°12  ",
        fichiers: [fichierPdf()],
      })
    );

    expect(res).toEqual({ error: null });
    expect(ecritures(fake.appels, "documents", "insert")[0].payload).toEqual({
      nom: "Assurance auto",
      categorie: "Assurance",
      notes: "contrat n°12",
    });
    expect(fake.stockage).toHaveLength(1);
    expect(fake.stockage[0]).toMatchObject({ bucket: BUCKET, action: "upload", contentType: "application/pdf" });
    expect(fake.stockage[0].chemin).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    const [ligne] = ecritures(fake.appels, "document_fichiers", "insert")[0].payload as Record<string, unknown>[];
    expect(ligne).toMatchObject({ document_id: ID, fichier_type: "pdf", apercu_url: null, ordre: 0 });
    expect(ligne.url).toBe(`${URL_PUBLIQUE}/${fake.stockage[0].chemin}`);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/documents");
  });

  it("met les champs facultatifs à null", async () => {
    const fake = brancher(reponseCreation);
    await createDocument({ error: null }, form({ nom: "CNI", fichiers: fichierPdf() }));
    expect(ecritures(fake.appels, "documents", "insert")[0].payload).toEqual({
      nom: "CNI",
      categorie: null,
      notes: null,
    });
  });

  it("compresse les images en JPEG avant l'envoi", async () => {
    const fake = brancher(reponseCreation);
    await createDocument({ error: null }, form({ nom: "Photo", fichiers: await fichierImage() }));
    expect(fake.stockage[0]).toMatchObject({ contentType: "image/jpeg" });
    expect(fake.stockage[0].chemin).toMatch(/\.jpg$/);
    const [ligne] = ecritures(fake.appels, "document_fichiers", "insert")[0].payload as Record<string, unknown>[];
    expect(ligne).toMatchObject({ fichier_type: "image", apercu_url: null });
  });

  it("reconnaît un PDF sans type MIME d'après sa signature", async () => {
    const fake = brancher(reponseCreation);
    const sansType = new File([new TextEncoder().encode("%PDF-1.7 ...")], "Swiss_Life_Document", { type: "" });
    await createDocument({ error: null }, form({ nom: "Assurance", fichiers: sansType }));
    expect(fake.stockage[0]).toMatchObject({ contentType: "application/pdf" });
  });

  it("refuse un format non supporté et signale l'erreur", async () => {
    const fake = brancher(reponseCreation);
    const texte = new File([new TextEncoder().encode("bonjour")], "note.txt", { type: "text/plain" });
    expect(await createDocument({ error: null }, form({ nom: "Texte", fichiers: texte }))).toEqual({
      error: "Format de fichier non supporté (image ou PDF uniquement).",
    });
    // Le document créé juste avant est retiré : pas de document sans fichier.
    expect(ecritures(fake.appels, "documents", "delete")).toHaveLength(1);
  });

  it("joint l'aperçu d'un PDF quand il est fourni", async () => {
    const fake = brancher(reponseCreation);
    await createDocument(
      { error: null },
      form({ nom: "Contrat", fichiers: fichierPdf(), "apercu:fichiers:0": await fichierImage("apercu.png") })
    );

    expect(fake.stockage.map((s) => s.contentType)).toEqual(["application/pdf", "image/jpeg"]);
    const [ligne] = ecritures(fake.appels, "document_fichiers", "insert")[0].payload as Record<string, unknown>[];
    expect(ligne.apercu_url).toBe(`${URL_PUBLIQUE}/${fake.stockage[1].chemin}`);
  });

  it("garde le PDF même si l'envoi de l'aperçu échoue", async () => {
    const fake = brancher(reponseCreation, (op) =>
      op.contentType === "image/jpeg" ? { error: { message: "quota" } } : undefined
    );
    const res = await createDocument(
      { error: null },
      form({ nom: "Contrat", fichiers: fichierPdf(), "apercu:fichiers:0": await fichierImage("apercu.png") })
    );
    expect(res).toEqual({ error: null });
    const [ligne] = ecritures(fake.appels, "document_fichiers", "insert")[0].payload as Record<string, unknown>[];
    expect(ligne.apercu_url).toBeNull();
  });

  it("ignore un aperçu illisible", async () => {
    const fake = brancher(reponseCreation);
    const corrompu = new File([new Uint8Array([1, 2, 3])], "apercu.png", { type: "image/png" });
    await createDocument({ error: null }, form({ nom: "Contrat", fichiers: fichierPdf(), "apercu:fichiers:0": corrompu }));
    const [ligne] = ecritures(fake.appels, "document_fichiers", "insert")[0].payload as Record<string, unknown>[];
    expect(ligne.apercu_url).toBeNull();
  });

  it("place recto et verso d'abord avec leur rôle, puis les autres fichiers, à la suite de l'existant", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents" && a.action === "insert") return { data: { id: ID } };
      if (a.table === "document_fichiers" && a.action === "select") return { data: { ordre: 2 } };
      return undefined;
    });

    await createDocument(
      { error: null },
      form({ nom: "CNI", fichier_recto: fichierPdf("r.pdf"), fichier_verso: fichierPdf("v.pdf"), fichiers: fichierPdf("x.pdf") })
    );

    const insertions = ecritures(fake.appels, "document_fichiers", "insert").map((i) => i.payload as Record<string, unknown>[]);
    expect(insertions[0].map((l) => [l.role, l.ordre])).toEqual([["recto", 3], ["verso", 4]]);
    expect(insertions[1].map((l) => [l.role, l.ordre])).toEqual([[undefined, 5]]);
  });

  it("accepte un verso seul comme unique fichier", async () => {
    const fake = brancher(reponseCreation);
    expect(await createDocument({ error: null }, form({ nom: "CNI", fichier_verso: fichierPdf() }))).toEqual({ error: null });
    const [ligne] = ecritures(fake.appels, "document_fichiers", "insert")[0].payload as Record<string, unknown>[];
    expect(ligne).toMatchObject({ role: "verso", ordre: 0 });
  });

  it("renvoie l'erreur d'insertion du document, d'envoi et d'enregistrement des fichiers", async () => {
    brancher((a) => (a.table === "documents" ? { error: { message: "doc ko" } } : undefined));
    expect(await createDocument({ error: null }, form({ nom: "x", fichiers: fichierPdf() }))).toEqual({ error: "doc ko" });

    brancher(reponseCreation, () => ({ error: { message: "envoi ko" } }));
    expect(await createDocument({ error: null }, form({ nom: "x", fichiers: fichierPdf() }))).toEqual({ error: "envoi ko" });

    brancher((a) =>
      a.table === "documents" ? { data: { id: ID } } : a.table === "document_fichiers" && a.action === "insert" ? { error: { message: "lignes ko" } } : undefined
    );
    expect(await createDocument({ error: null }, form({ nom: "x", fichiers: fichierPdf() }))).toEqual({ error: "lignes ko" });
  });
});

describe("updateDocument", () => {
  const base = { id: ID, nom: "CNI" };
  // La mise à jour renvoie la ligne modifiée (`.select("id")`) : vide = document introuvable.
  const trouve: Repondre = (a) => (a.table === "documents" && a.action === "update" ? { data: [{ id: ID }] } : undefined);

  it("refuse sans id ou avec un nom vide", async () => {
    brancher();
    expect(await updateDocument({ error: null }, form({ nom: "x" }))).toEqual({ error: "Document introuvable." });
    expect(await updateDocument({ error: null }, form({ id: ID, nom: "" }))).toEqual({ error: "Le nom est requis." });
  });

  it("met à jour le nom, la catégorie et les notes, et revalide la page du document", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories") return { data: { id: "C1" } };
      return trouve(a);
    });
    const res = await updateDocument(
      { error: null },
      form({ ...base, nom: " Carte d'identité ", categorie: "Identité", notes: " recto-verso " })
    );
    expect(res).toEqual({ error: null });
    expect(ecritures(fake.appels, "documents", "update")[0].payload).toEqual({
      nom: "Carte d'identité",
      categorie: "Identité",
      notes: "recto-verso",
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/documents/${ID}`);
  });

  it("ne touche plus à l'étiquette, à l'échéance ni au mois concerné", async () => {
    const fake = brancher(trouve);
    await updateDocument(
      { error: null },
      form({ ...base, etiquette_id: "E1", date_echeance: "2027-01-01", periode_mois: "2026-09" })
    );
    const payload = ecritures(fake.appels, "documents", "update")[0].payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["categorie", "nom", "notes"]);
  });

  it("signale un document introuvable", async () => {
    brancher((a) => (a.table === "documents" && a.action === "update" ? { data: [] } : undefined));
    expect(await updateDocument({ error: null }, form(base))).toEqual({ error: "Document introuvable." });
  });

  it("ajoute de nouveaux fichiers sans en exiger en édition", async () => {
    const fake = brancher(trouve);
    await updateDocument({ error: null }, form(base));
    expect(fake.stockage).toHaveLength(0);

    await updateDocument({ error: null }, form({ ...base, fichiers: fichierPdf() }));
    expect(fake.stockage).toHaveLength(1);
  });

  it("renvoie l'erreur de mise à jour et d'envoi", async () => {
    brancher((a) => (a.action === "update" ? { error: { message: "maj ko" } } : undefined));
    expect(await updateDocument({ error: null }, form(base))).toEqual({ error: "maj ko" });

    brancher(trouve, () => ({ error: { message: "envoi ko" } }));
    expect(await updateDocument({ error: null }, form({ ...base, fichiers: fichierPdf() }))).toEqual({ error: "envoi ko" });
  });
});

describe("deleteDocumentFichier", () => {
  const fichier = {
    url: `${URL_PUBLIQUE}/aaa.pdf`,
    apercu_url: `${URL_PUBLIQUE}/bbb.jpg`,
    document_id: ID,
  };

  it("supprime le fichier et son aperçu du stockage, puis la ligne", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: fichier } : undefined));
    await deleteDocumentFichier(FICHIER);
    expect(fake.stockage).toEqual([{ bucket: BUCKET, action: "remove", chemins: ["aaa.pdf", "bbb.jpg"] }]);
    expect(ecritures(fake.appels, "document_fichiers", "delete")[0].filtres).toContainEqual(["eq", "id", FICHIER]);
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/documents/${ID}`);
  });

  it("n'appelle pas le stockage quand l'URL n'appartient pas au bucket", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { url: "https://ailleurs.test/x.pdf", apercu_url: null, document_id: ID } } : undefined));
    await deleteDocumentFichier(FICHIER);
    expect(fake.stockage).toHaveLength(0);
    expect(ecritures(fake.appels, "document_fichiers", "delete")).toHaveLength(1);
  });

  it("lève les erreurs et ne supprime pas la ligne si le stockage échoue", async () => {
    brancher((a) => (a.action === "select" ? { error: { message: "lecture ko" } } : undefined));
    await expect(deleteDocumentFichier(FICHIER)).rejects.toThrow("lecture ko");

    const fake = brancher((a) => (a.action === "select" ? { data: fichier } : undefined), () => ({ error: { message: "stockage ko" } }));
    await expect(deleteDocumentFichier(FICHIER)).rejects.toThrow("stockage ko");
    expect(ecritures(fake.appels, "document_fichiers", "delete")).toHaveLength(0);

    brancher((a) => (a.action === "select" ? { data: fichier } : { error: { message: "ligne ko" } }));
    await expect(deleteDocumentFichier(FICHIER)).rejects.toThrow("ligne ko");
  });
});

describe("deleteDocument", () => {
  it("nettoie le stockage, supprime le document puis redirige", async () => {
    const fake = brancher((a) =>
      a.table === "document_fichiers"
        ? { data: [{ url: `${URL_PUBLIQUE}/a.jpg`, apercu_url: null }, { url: `${URL_PUBLIQUE}/b.pdf`, apercu_url: `${URL_PUBLIQUE}/c.jpg` }] }
        : undefined
    );
    await expect(deleteDocument(ID)).rejects.toThrow("REDIRECT:/documents");
    expect(fake.stockage[0].chemins).toEqual(["a.jpg", "b.pdf", "c.jpg"]);
    expect(ecritures(fake.appels, "documents", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
  });

  it("supprime un document sans fichier sans toucher au stockage", async () => {
    const fake = brancher();
    await expect(deleteDocument(ID)).rejects.toThrow("REDIRECT:/documents");
    expect(fake.stockage).toHaveLength(0);
  });

  it("ne supprime pas le document si le nettoyage du stockage échoue", async () => {
    const fake = brancher(
      (a) => (a.table === "document_fichiers" ? { data: [{ url: `${URL_PUBLIQUE}/a.jpg`, apercu_url: null }] } : undefined),
      () => ({ error: { message: "stockage ko" } })
    );
    await expect(deleteDocument(ID)).rejects.toThrow("stockage ko");
    expect(ecritures(fake.appels, "documents")).toHaveLength(0);
    expect(etat.redirect).not.toHaveBeenCalled();
  });

  it("lève l'erreur de lecture ou de suppression", async () => {
    brancher((a) => (a.table === "document_fichiers" ? { error: { message: "lecture ko" } } : undefined));
    await expect(deleteDocument(ID)).rejects.toThrow("lecture ko");
    brancher((a) => (a.table === "documents" ? { error: { message: "suppression ko" } } : undefined));
    await expect(deleteDocument(ID)).rejects.toThrow("suppression ko");
  });
});

describe("enregistrerApercuPdf", () => {
  const pdfSansApercu = { fichier_type: "pdf", apercu_url: null, document_id: ID };

  it("refuse sans aperçu", async () => {
    const fake = brancher();
    expect(await enregistrerApercuPdf(FICHIER, form({}))).toEqual({ ok: false, error: "Aperçu manquant." });
    expect(fake.appels).toHaveLength(0);
  });

  it("enregistre l'aperçu d'un PDF qui n'en a pas, sans écraser un aperçu concurrent", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: pdfSansApercu } : undefined));
    expect(await enregistrerApercuPdf(FICHIER, form({ apercu: await fichierImage() }))).toMatchObject({ ok: true });
    const [maj] = ecritures(fake.appels, "document_fichiers", "update");
    expect(maj.payload).toEqual({ apercu_url: expect.stringContaining(`${URL_PUBLIQUE}/`) });
    expect(maj.filtres).toContainEqual(["is", "apercu_url", null]);
  });

  it.each([
    ["une image", { fichier_type: "image", apercu_url: null, document_id: ID }],
    ["un PDF qui a déjà un aperçu", { fichier_type: "pdf", apercu_url: "https://x/a.jpg", document_id: ID }],
    ["un fichier introuvable", null],
  ])("ne fait rien pour %s", async (_nom, ligne) => {
    const fake = brancher((a) => (a.action === "select" ? { data: ligne } : undefined));
    expect(await enregistrerApercuPdf(FICHIER, form({ apercu: await fichierImage() }))).toMatchObject({ ok: true });
    expect(fake.stockage).toHaveLength(0);
    expect(ecritures(fake.appels, "document_fichiers")).toHaveLength(0);
  });

  it("renvoie les erreurs de lecture, d'envoi et d'écriture", async () => {
    brancher((a) => (a.action === "select" ? { error: { message: "lecture ko" } } : undefined));
    expect(await enregistrerApercuPdf(FICHIER, form({ apercu: await fichierImage() }))).toEqual({ ok: false, error: "lecture ko" });

    brancher((a) => (a.action === "select" ? { data: pdfSansApercu } : undefined), () => ({ error: { message: "x" } }));
    expect(await enregistrerApercuPdf(FICHIER, form({ apercu: await fichierImage() }))).toEqual({
      ok: false,
      error: "Impossible d'enregistrer l'aperçu.",
    });

    brancher((a) => (a.action === "select" ? { data: pdfSansApercu } : { error: { message: "maj ko" } }));
    expect(await enregistrerApercuPdf(FICHIER, form({ apercu: await fichierImage() }))).toEqual({ ok: false, error: "maj ko" });
  });
});

describe("getDocuments et getDocument", () => {
  const ligne = {
    id: ID,
    nom: "CNI",
    document_fichiers: [{ id: "f1" }],
  };

  it("renomme les fichiers", async () => {
    brancher(() => ({ data: [ligne] }));
    const [doc] = await getDocuments();
    expect(doc).toMatchObject({ id: ID, fichiers: [{ id: "f1" }] });
    expect(doc).not.toHaveProperty("document_fichiers");
  });

  it("ne lit plus les étiquettes", async () => {
    const fake = brancher();
    await getDocuments();
    expect(JSON.stringify(fake.appels[0])).not.toContain("etiquette");
  });

  it("trie les plus récents d'abord", async () => {
    const fake = brancher();
    await getDocuments();
    expect(fake.appels[0].modificateurs).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(fake.appels[0].modificateurs).not.toContainEqual(expect.arrayContaining(["date_echeance"]));
  });

  it("getDocument renvoie null si absent, le document sinon, et lève sur erreur", async () => {
    brancher();
    expect(await getDocument(ID)).toBeNull();
    brancher(() => ({ data: ligne }));
    expect(await getDocument(ID)).toMatchObject({ id: ID, fichiers: [{ id: "f1" }] });
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getDocument(ID)).rejects.toThrow("ko");
    await expect(getDocuments()).rejects.toThrow("ko");
  });
});
