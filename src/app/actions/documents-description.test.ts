// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signatureFichiers } from "@/lib/documents/recherche";
import { fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  gemini: vi.fn(),
  telecharger: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({
  appelerGemini: etat.gemini,
  MESSAGE_QUOTA_GEMINI: "Quota atteint.",
}));
vi.mock("@/lib/documents/indexation", () => ({ telechargerPourGemini: etat.telecharger }));

import { obtenirDescriptionDocument } from "./documents-description";

const ID = "11111111-1111-4111-8111-111111111111";
const URL_A = "https://stockage.test/documents-fichiers/a.pdf";
const DESCRIPTION = { resume: "Facture d'électricité.", points: ["Montant : 84,20 €"] };

function fichiers(n = 1) {
  return Array.from({ length: n }, (_, i) => ({
    url: i === 0 ? URL_A : `https://stockage.test/documents-fichiers/${i}.jpg`,
    fichier_type: i === 0 ? "pdf" : "image",
    ordre: i,
  }));
}

function brancher(options: { document?: unknown; existante?: unknown; ecriture?: { message: string } } = {}) {
  const repondre: Repondre = (a) => {
    if (a.table === "documents") {
      return {
        data:
          "document" in options
            ? options.document
            : { nom: "Facture EDF", categorie: null, document_fichiers: fichiers() },
      };
    }
    if (a.table === "documents_descriptions") {
      if (a.action === "upsert") return options.ecriture ? { error: options.ecriture } : {};
      return { data: options.existante ?? null };
    }
    return undefined;
  };
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  etat.gemini.mockReset();
  etat.telecharger.mockReset();
  etat.telecharger.mockResolvedValue({ ok: true, images: [{ mimeType: "application/pdf", data: "AAA" }] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("obtenirDescriptionDocument", () => {
  it("refuse un identifiant invalide sans rien lire", async () => {
    const fake = brancher();
    const r = await obtenirDescriptionDocument("pas-un-uuid");
    expect(r.ok).toBe(false);
    expect(fake.appels).toHaveLength(0);
  });

  it("écrit puis enregistre la description quand aucune n'existe", async () => {
    const fake = brancher();
    etat.gemini.mockResolvedValue({ ok: true, brut: DESCRIPTION });

    const r = await obtenirDescriptionDocument(ID);

    expect(r).toEqual({ ok: true, data: { ...DESCRIPTION, partiel: false } });
    expect(etat.gemini).toHaveBeenCalledTimes(1);
    expect(fake.appels).toContainEqual(
      expect.objectContaining({
        table: "documents_descriptions",
        action: "upsert",
        payload: expect.objectContaining({ document_id: ID, contenu: DESCRIPTION, signature: signatureFichiers([URL_A]) }),
      })
    );
  });

  it("relit la description enregistrée sans appeler Gemini quand les fichiers n'ont pas changé", async () => {
    brancher({ existante: { contenu: DESCRIPTION, signature: signatureFichiers([URL_A]) } });

    const r = await obtenirDescriptionDocument(ID);

    expect(r).toEqual({ ok: true, data: { ...DESCRIPTION, partiel: false } });
    expect(etat.gemini).not.toHaveBeenCalled();
    expect(etat.telecharger).not.toHaveBeenCalled();
  });

  it("refait la description quand les fichiers ont changé", async () => {
    brancher({ existante: { contenu: DESCRIPTION, signature: "ancienne" } });
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "Nouvelle.", points: [] } });

    const r = await obtenirDescriptionDocument(ID);

    expect(r).toEqual({ ok: true, data: { resume: "Nouvelle.", points: [], partiel: false } });
    expect(etat.gemini).toHaveBeenCalledTimes(1);
  });

  it("régénère quand on le demande, même si la description est à jour", async () => {
    brancher({ existante: { contenu: DESCRIPTION, signature: signatureFichiers([URL_A]) } });
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "Autre version.", points: ["Point"] } });

    const r = await obtenirDescriptionDocument(ID, true);

    expect(r).toEqual({ ok: true, data: { resume: "Autre version.", points: ["Point"], partiel: false } });
    expect(etat.gemini).toHaveBeenCalledTimes(1);
  });

  it("signale une lecture partielle quand le document a plus de 3 fichiers", async () => {
    brancher({ document: { nom: "Dossier", categorie: null, document_fichiers: fichiers(5) } });
    etat.gemini.mockResolvedValue({ ok: true, brut: DESCRIPTION });

    const r = await obtenirDescriptionDocument(ID);

    expect(r).toEqual({ ok: true, data: { ...DESCRIPTION, partiel: true } });
  });

  it("refuse un document sans fichier", async () => {
    brancher({ document: { nom: "Vide", categorie: null, document_fichiers: [] } });

    const r = await obtenirDescriptionDocument(ID);

    expect(r.ok).toBe(false);
    expect(r.error).toContain("aucun fichier");
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("signale un document disparu", async () => {
    brancher({ document: null });
    const r = await obtenirDescriptionDocument(ID);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("n'existe plus");
  });

  it("renvoie le message de quota quand Gemini répond 429", async () => {
    brancher();
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });
    expect(await obtenirDescriptionDocument(ID)).toEqual({ ok: false, error: "Quota atteint." });
  });

  it("explique l'échec de Gemini", async () => {
    brancher();
    etat.gemini.mockResolvedValue({ ok: false, code: "echec", detail: "Délai dépassé." });
    const r = await obtenirDescriptionDocument(ID);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Délai dépassé.");
  });

  it("refuse une réponse de Gemini inutilisable", async () => {
    brancher();
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "", points: [] } });
    const r = await obtenirDescriptionDocument(ID);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("inutilisable");
  });

  it("échoue proprement si un fichier ne se télécharge pas", async () => {
    brancher();
    etat.telecharger.mockResolvedValue({ ok: false, detail: "Un fichier n'a pas pu être téléchargé." });
    const r = await obtenirDescriptionDocument(ID);
    expect(r.ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("affiche quand même la description si son enregistrement échoue", async () => {
    brancher({ ecriture: { message: "relation absente" } });
    etat.gemini.mockResolvedValue({ ok: true, brut: DESCRIPTION });
    expect(await obtenirDescriptionDocument(ID)).toEqual({ ok: true, data: { ...DESCRIPTION, partiel: false } });
  });
});
