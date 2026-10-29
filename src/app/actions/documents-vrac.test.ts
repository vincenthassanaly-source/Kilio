// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAction } from "@/lib/actions/runAction";
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

import {
  analyserDocumentVrac,
  appliquerTriVrac,
  enregistrerDocumentsVrac,
  preparerUploadsVrac,
} from "./documents-vrac";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "33333333-3333-4333-8333-333333333333";
const CHEMIN = "22222222-2222-4222-8222-222222222222.pdf";
const CATEGORIES = [{ nom: "Identité" }, { nom: "Santé" }, { nom: "Autre" }];

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function documentEnVrac(extra: Record<string, unknown> = {}) {
  return {
    nom: "scan0042",
    en_vrac: true,
    document_fichiers: [{ url: "https://stockage.test/documents-fichiers/a.pdf", fichier_type: "pdf", ordre: 0 }],
    ...extra,
  };
}

type Extras = {
  /** Documents classés (comparaison des titres). */
  classes?: { id: string; nom: string }[];
  /** Fichiers des autres documents (comparaison des empreintes) ; `erreur` simule la colonne absente. */
  fichiers?: unknown[] | { erreur: string };
};

function reponseLecture(document: unknown, extras: Extras = {}): Repondre {
  return (a) => {
    // Le document analysé se lit avec `.maybeSingle()` ; la liste des documents classés, sans.
    if (a.table === "documents" && a.action === "select") {
      return a.terminal === "maybeSingle" ? { data: document } : { data: extras.classes ?? [] };
    }
    if (a.table === "documents_categories") return { data: CATEGORIES };
    if (a.table === "document_fichiers" && a.action === "select") {
      const fichiers = extras.fichiers;
      if (fichiers && !Array.isArray(fichiers)) return { error: { message: fichiers.erreur } };
      return { data: fichiers ?? [] };
    }
    return undefined;
  };
}

function fichierTelecharge(octets: string, entetes: Record<string, string> = { "content-type": "application/pdf" }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(octets, { headers: entetes })));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("analyserDocumentVrac", () => {
  it("refuse un identifiant invalide sans toucher à la base", async () => {
    const fake = brancher();
    expect(await analyserDocumentVrac("pas-un-uuid")).toEqual({ statut: "echec", erreur: "Document introuvable.", quota: false });
    expect(fake.appels).toHaveLength(0);
  });

  it("refuse un document qui n'est plus en vrac", async () => {
    brancher(reponseLecture(documentEnVrac({ en_vrac: false })));
    expect(await analyserDocumentVrac(ID)).toMatchObject({ statut: "echec", erreur: "Ce document n'est plus en vrac." });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("envoie le fichier à Gemini avec les catégories et lit la proposition", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4 contenu");
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "Facture EDF - mars 2026", categorie: "Logement" } });

    const resultat = await analyserDocumentVrac(ID, ["Logement", "identite"]);

    expect(resultat).toEqual({
      statut: "ok",
      proposition: { nom: "Facture EDF - mars 2026", categorie: "Logement", nouvelleCategorie: false },
      doublon: null,
    });
    const appel = etat.gemini.mock.calls[0][0];
    expect(appel.images).toEqual([
      { mimeType: "application/pdf", data: Buffer.from("%PDF-1.4 contenu").toString("base64") },
    ]);
    // Catégories de la base + supplémentaires, sans doublon de casse/accents.
    expect(appel.prompt).toContain("« Santé »");
    expect(appel.prompt).toContain("« Logement »");
    expect(appel.prompt.match(/« Identité »/g)).toHaveLength(1);
    expect(appel.prompt).toContain("scan0042");
  });

  it("signale comme nouvelle une catégorie absente de la base et des suggestions", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4");
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "Relevé", categorie: "Banque" } });

    expect(await analyserDocumentVrac(ID)).toMatchObject({
      statut: "ok",
      proposition: { categorie: "Banque", nouvelleCategorie: true },
    });
  });

  it("reconnaît une catégorie existante malgré la casse", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4");
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "Carte vitale", categorie: "santé" } });

    expect(await analyserDocumentVrac(ID)).toMatchObject({
      statut: "ok",
      proposition: { categorie: "Santé", nouvelleCategorie: false },
    });
  });

  it("signale le quota Gemini", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4");
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });

    expect(await analyserDocumentVrac(ID)).toEqual({ statut: "echec", erreur: "Quota atteint.", quota: true });
  });

  it("rapporte un échec Gemini sans le faire passer pour un quota", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4");
    etat.gemini.mockResolvedValue({ ok: false, code: "echec", detail: "Délai dépassé" });

    const resultat = await analyserDocumentVrac(ID);
    expect(resultat).toMatchObject({ statut: "echec", quota: false });
    expect(resultat.statut === "echec" && resultat.erreur).toContain("Délai dépassé");
  });

  it("laisse en vrac un fichier trop volumineux, sans appeler Gemini", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4", { "content-type": "application/pdf", "content-length": String(30 * 1024 * 1024) });

    expect(await analyserDocumentVrac(ID)).toMatchObject({
      statut: "echec",
      erreur: "Trop volumineux pour l'analyse : classe-le à la main.",
    });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("échoue proprement quand le fichier est inaccessible", async () => {
    brancher(reponseLecture(documentEnVrac()));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    expect(await analyserDocumentVrac(ID)).toMatchObject({ statut: "echec" });
    expect(etat.gemini).not.toHaveBeenCalled();
  });
});

describe("analyserDocumentVrac : doublons", () => {
  const OCTETS = "%PDF-1.4 contenu identique";
  const EMPREINTE = createHash("sha256").update(OCTETS).digest("hex");
  const ORIGINAL = { nom: "Facture EDF - mars 2026", categorie: "Logement", en_vrac: false };
  const fichierExistant = (extra: Record<string, unknown> = {}) => ({
    id: "F9",
    url: "https://stockage.test/documents-fichiers/original.pdf",
    empreinte: EMPREINTE,
    document_id: ID2,
    documents: ORIGINAL,
    ...extra,
  });

  it("mémorise l'empreinte SHA-256 du fichier analysé", async () => {
    const fake = brancher(reponseLecture(documentEnVrac({ document_fichiers: [{ id: "F1", url: "https://stockage.test/a.pdf", fichier_type: "pdf", ordre: 0 }] })));
    fichierTelecharge(OCTETS);
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "Contrat", categorie: "Autre" } });

    await analyserDocumentVrac(ID);

    const ecriture = ecritures(fake.appels, "document_fichiers", "update")[0];
    expect(ecriture.payload).toEqual({ empreinte: EMPREINTE });
    expect(ecriture.filtres).toContainEqual(["eq", "id", "F1"]);
  });

  it("signale le même fichier qu'un document existant, sans appeler Gemini", async () => {
    brancher(reponseLecture(documentEnVrac(), { fichiers: [fichierExistant()] }));
    fichierTelecharge(OCTETS);

    const resultat = await analyserDocumentVrac(ID);

    expect(resultat).toEqual({
      statut: "ok",
      proposition: { nom: "Facture EDF - mars 2026", categorie: "Logement", nouvelleCategorie: false },
      doublon: { type: "fichier", documentId: ID2, nom: "Facture EDF - mars 2026" },
    });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("complète l'empreinte d'un document classé qui n'en a pas, puis compare", async () => {
    const fake = brancher(reponseLecture(documentEnVrac(), { fichiers: [fichierExistant({ empreinte: null })] }));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(OCTETS, { headers: { "content-type": "application/pdf" } }))));

    const resultat = await analyserDocumentVrac(ID);

    expect(resultat).toMatchObject({ statut: "ok", doublon: { type: "fichier", documentId: ID2 } });
    const ecritureExistant = ecritures(fake.appels, "document_fichiers", "update").find((a) =>
      a.filtres.some((f) => f[0] === "eq" && f[2] === "F9")
    );
    expect(ecritureExistant?.payload).toEqual({ empreinte: EMPREINTE });
  });

  it("ne complète pas le fichier d'un document du vrac pas encore analysé", async () => {
    // Sinon deux copies arrivées ensemble se désigneraient l'une l'autre comme originale.
    brancher(
      reponseLecture(documentEnVrac(), {
        fichiers: [fichierExistant({ empreinte: null, documents: { nom: "scan0043", categorie: null, en_vrac: true } })],
      })
    );
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(OCTETS, { headers: { "content-type": "application/pdf" } })));
    vi.stubGlobal("fetch", fetchMock);
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "Contrat", categorie: "Autre" } });

    const resultat = await analyserDocumentVrac(ID);

    expect(fetchMock).toHaveBeenCalledTimes(1); // seulement son propre fichier
    expect(resultat).toMatchObject({ statut: "ok", doublon: null });
  });

  it("repère une copie arrivée plus tôt dans le vrac (empreinte déjà mémorisée)", async () => {
    brancher(
      reponseLecture(documentEnVrac(), {
        fichiers: [fichierExistant({ documents: { nom: "scan0043", categorie: null, en_vrac: true } })],
      })
    );
    fichierTelecharge(OCTETS);

    expect(await analyserDocumentVrac(ID)).toMatchObject({
      statut: "ok",
      doublon: { type: "fichier", documentId: ID2, nom: "scan0043" },
    });
  });

  it("signale un titre identique à celui d'un document classé", async () => {
    brancher(reponseLecture(documentEnVrac(), { classes: [{ id: ID2, nom: "Facture EDF – mars 2026" }] }));
    fichierTelecharge(OCTETS);
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "facture edf mars 2026", categorie: "Logement" } });

    const resultat = await analyserDocumentVrac(ID);

    expect(resultat).toMatchObject({
      statut: "ok",
      doublon: { type: "titre", documentId: ID2, nom: "Facture EDF – mars 2026" },
    });
    expect(etat.gemini).toHaveBeenCalledTimes(1);
  });

  it("garde une détection par titre seul quand la colonne d'empreinte n'existe pas encore", async () => {
    brancher(
      reponseLecture(documentEnVrac(), {
        fichiers: { erreur: 'column "empreinte" does not exist' },
        classes: [{ id: ID2, nom: "Contrat" }],
      })
    );
    fichierTelecharge(OCTETS);
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "Contrat", categorie: "Autre" } });

    expect(await analyserDocumentVrac(ID)).toMatchObject({
      statut: "ok",
      doublon: { type: "titre", documentId: ID2 },
    });
  });
});

// Régression « tri bloqué à 0 / 1 » : l'action est appelée par le navigateur
// à travers runAction, qui reconnaît `{ ok: true, data }` comme son propre
// contrat. Une réponse `{ ok: true, proposition }` passait sans `data` et
// faisait planter le modal. On teste donc le passage par runAction, pas
// seulement l'action seule.
describe("analyserDocumentVrac à travers runAction (contrat avec le navigateur)", () => {
  it("livre la proposition dans `data`, lisible par le modal", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4");
    etat.gemini.mockResolvedValue({ ok: true, brut: { nom: "Fiche de paie - mars 2026", categorie: "Autre" } });

    const resultat = await runAction(() => analyserDocumentVrac(ID), { silencieux: true });

    expect(resultat.ok).toBe(true);
    expect(resultat.data).toEqual({
      statut: "ok",
      proposition: { nom: "Fiche de paie - mars 2026", categorie: "Autre", nouvelleCategorie: false },
      doublon: null,
    });
  });

  it("livre un échec d'analyse dans `data`, avec son message et le drapeau quota", async () => {
    brancher(reponseLecture(documentEnVrac()));
    fichierTelecharge("%PDF-1.4");
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });

    const resultat = await runAction(() => analyserDocumentVrac(ID), { silencieux: true });

    expect(resultat.ok).toBe(true);
    expect(resultat.data).toEqual({ statut: "echec", erreur: "Quota atteint.", quota: true });
  });
});

describe("appliquerTriVrac", () => {
  it("crée une seule fois les catégories nouvelles puis sort les documents du vrac", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories" && a.action === "select") return { data: CATEGORIES };
      if (a.table === "documents" && a.action === "update") return { data: [{ id: "x" }] };
      return undefined;
    });

    const resultat = await appliquerTriVrac([
      { id: ID, nom: " Relevé  bancaire ", categorie: "Banque" },
      { id: ID2, nom: "Avis", categorie: "banque" },
    ]);

    expect(resultat).toEqual({ ok: true, data: { appliques: 2, echecs: 0 } });
    expect(ecritures(fake.appels, "documents_categories", "insert")[0].payload).toEqual([{ nom: "Banque" }]);
    const misesAJour = ecritures(fake.appels, "documents", "update");
    expect(misesAJour[0].payload).toEqual({ nom: "Relevé bancaire", categorie: "Banque", en_vrac: false });
    // « banque » (autre casse) rejoint la catégorie créée au lieu d'en créer une seconde.
    expect(misesAJour[1].payload).toEqual({ nom: "Avis", categorie: "Banque", en_vrac: false });
    // Seulement les documents encore en vrac.
    expect(misesAJour[0].filtres).toContainEqual(["eq", "en_vrac", true]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/documents");
  });

  it("ne crée aucune catégorie quand elles existent déjà", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories") return { data: CATEGORIES };
      if (a.table === "documents" && a.action === "update") return { data: [{ id: "x" }] };
      return undefined;
    });

    await appliquerTriVrac([{ id: ID, nom: "Carte vitale", categorie: "SANTE" }]);

    expect(ecritures(fake.appels, "documents_categories")).toHaveLength(0);
    expect(ecritures(fake.appels, "documents", "update")[0].payload).toMatchObject({ categorie: "Santé" });
  });

  it("accepte l'absence de catégorie", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories") return { data: CATEGORIES };
      if (a.table === "documents" && a.action === "update") return { data: [{ id: "x" }] };
      return undefined;
    });

    await appliquerTriVrac([{ id: ID, nom: "Sans classe", categorie: null }]);

    expect(ecritures(fake.appels, "documents", "update")[0].payload).toMatchObject({ categorie: null, en_vrac: false });
  });

  it("compte comme échec un document déjà sorti du vrac", async () => {
    brancher((a) => {
      if (a.table === "documents_categories") return { data: CATEGORIES };
      if (a.table === "documents" && a.action === "update") return { data: [] };
      return undefined;
    });

    expect(await appliquerTriVrac([{ id: ID, nom: "Déjà trié", categorie: "Santé" }])).toEqual({
      ok: true,
      data: { appliques: 0, echecs: 1 },
    });
  });

  it("refuse un nom vide, un identifiant invalide ou une liste vide sans rien écrire", async () => {
    const fake = brancher();
    expect(await appliquerTriVrac([])).toMatchObject({ ok: false });
    expect(await appliquerTriVrac([{ id: ID, nom: "   ", categorie: null }])).toMatchObject({ ok: false });
    expect(await appliquerTriVrac([{ id: "x", nom: "Nom", categorie: null }])).toMatchObject({ ok: false });
    expect(fake.appels).toHaveLength(0);
  });

  it("n'écrit aucun document quand les catégories nouvelles ne peuvent pas être créées", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories" && a.action === "select") return { data: CATEGORIES };
      if (a.table === "documents_categories" && a.action === "insert") return { error: { message: "boom" } };
      return undefined;
    });

    expect(await appliquerTriVrac([{ id: ID, nom: "Relevé", categorie: "Banque" }])).toMatchObject({ ok: false });
    expect(ecritures(fake.appels, "documents")).toHaveLength(0);
  });
});

describe("preparerUploadsVrac", () => {
  it("renvoie un chemin, une URL signée et l'URL publique par fichier", async () => {
    brancher();

    const resultat = await preparerUploadsVrac(["pdf", "image"]);

    expect(resultat.ok).toBe(true);
    const [pdf, image] = resultat.data!;
    expect(pdf.path).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(image.path).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(pdf.signedUrl).toContain(`/object/upload/sign/documents-fichiers/${pdf.path}`);
    expect(pdf.publicUrl).toBe(`https://stockage.test/storage/v1/object/public/documents-fichiers/${pdf.path}`);
  });

  it("refuse une liste vide, trop longue ou un format inconnu", async () => {
    brancher();
    expect(await preparerUploadsVrac([])).toMatchObject({ ok: false });
    expect(await preparerUploadsVrac(Array(21).fill("pdf"))).toMatchObject({ ok: false });
    expect(await preparerUploadsVrac(["exe" as never])).toMatchObject({ ok: false });
  });
});

describe("enregistrerDocumentsVrac", () => {
  it("crée un document en vrac par fichier, nommé d'après le fichier", async () => {
    const fake = brancher((a) =>
      a.table === "documents" && a.action === "insert" ? { data: [{ id: ID }] } : undefined
    );

    const resultat = await enregistrerDocumentsVrac([{ path: CHEMIN, nomOriginal: "Facture_EDF-mars.pdf" }]);

    expect(resultat).toEqual({ ok: true, data: { crees: 1 } });
    expect(ecritures(fake.appels, "documents", "insert")[0].payload).toEqual([
      { nom: "Facture EDF mars", en_vrac: true },
    ]);
    expect(ecritures(fake.appels, "document_fichiers", "insert")[0].payload).toEqual([
      {
        document_id: ID,
        url: `https://stockage.test/storage/v1/object/public/documents-fichiers/${CHEMIN}`,
        fichier_type: "pdf",
        ordre: 0,
      },
    ]);
  });

  it("refuse un chemin qui n'est pas un fichier envoyé par l'app", async () => {
    const fake = brancher();
    expect(await enregistrerDocumentsVrac([{ path: "../secret.pdf", nomOriginal: "x.pdf" }])).toMatchObject({ ok: false });
    expect(await enregistrerDocumentsVrac([])).toMatchObject({ ok: false });
    expect(fake.appels).toHaveLength(0);
  });

  it("supprime les documents créés quand l'enregistrement des fichiers échoue", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents" && a.action === "insert") return { data: [{ id: ID }] };
      if (a.table === "document_fichiers" && a.action === "insert") return { error: { message: "boom" } };
      return undefined;
    });

    expect(await enregistrerDocumentsVrac([{ path: CHEMIN, nomOriginal: "x.pdf" }])).toMatchObject({ ok: false });
    const suppression = ecritures(fake.appels, "documents", "delete")[0];
    expect(suppression.filtres).toContainEqual(["in", "id", [ID]]);
  });
});
