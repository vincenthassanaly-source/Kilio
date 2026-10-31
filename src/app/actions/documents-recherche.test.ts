// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signatureFichiers } from "@/lib/documents/recherche";
import { fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  gemini: vi.fn(),
  indexer: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({
  appelerGemini: etat.gemini,
  MESSAGE_QUOTA_GEMINI: "Quota atteint.",
}));
vi.mock("@/lib/documents/indexation", () => ({ indexerDocument: etat.indexer }));

import { rechercherDocuments } from "./documents-recherche";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const URL_A = "https://stockage.test/documents-fichiers/a.pdf";
const URL_B = "https://stockage.test/documents-fichiers/b.jpg";

function documents() {
  return [
    { id: A, nom: "Passeport", categorie: "Identité", notes: null, document_fichiers: [{ url: URL_A, ordre: 0 }] },
    { id: B, nom: "Facture EDF", categorie: null, notes: "mars", document_fichiers: [{ url: URL_B, ordre: 0 }] },
  ];
}

function brancher(fiches: unknown[] | { erreur: string } = [], lignes: unknown[] = documents()) {
  const repondre: Repondre = (a) => {
    if (a.table === "documents") return { data: lignes };
    if (a.table === "documents_fiches") {
      return Array.isArray(fiches) ? { data: fiches } : { error: { message: fiches.erreur } };
    }
    return undefined;
  };
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function ficheA() {
  return { document_id: A, contenu: "Type : passeport", signature: signatureFichiers([URL_A]) };
}

function ficheB() {
  return { document_id: B, contenu: "Type : facture", signature: signatureFichiers([URL_B]) };
}

beforeEach(() => {
  etat.gemini.mockReset();
  etat.indexer.mockReset();
});

describe("rechercherDocuments", () => {
  it("refuse une question vide sans rien appeler", async () => {
    brancher();
    expect(await rechercherDocuments("   ")).toEqual({ ok: false, error: "Écris ce que tu cherches." });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("renvoie les documents choisis par Gemini, sans relire ceux dont la fiche est à jour", async () => {
    brancher([ficheA(), ficheB()]);
    etat.gemini.mockResolvedValue({ ok: true, brut: { ids: [B] } });

    const resultat = await rechercherDocuments("ma facture d'électricité");

    expect(resultat).toEqual({ ok: true, data: { ids: [B], nonLus: 0 } });
    expect(etat.indexer).not.toHaveBeenCalled();
    expect(etat.gemini.mock.calls[0][0].prompt).toContain("ma facture d'électricité");
  });

  it("renvoie une liste vide quand rien ne correspond", async () => {
    brancher([ficheA(), ficheB()]);
    etat.gemini.mockResolvedValue({ ok: true, brut: { ids: [] } });
    expect(await rechercherDocuments("permis bateau")).toEqual({ ok: true, data: { ids: [], nonLus: 0 } });
  });

  it("écarte les identifiants inventés par Gemini", async () => {
    brancher([ficheA(), ficheB()]);
    etat.gemini.mockResolvedValue({ ok: true, brut: { ids: ["inventé", A] } });
    expect(await rechercherDocuments("passeport")).toEqual({ ok: true, data: { ids: [A], nonLus: 0 } });
  });

  it("lit d'abord les documents sans fiche (rattrapage) et utilise leur fiche pour chercher", async () => {
    brancher([ficheA()]);
    etat.indexer.mockResolvedValue({ statut: "ok", contenu: "Type : facture EDF" });
    etat.gemini.mockResolvedValue({ ok: true, brut: { ids: [B] } });

    const resultat = await rechercherDocuments("edf");

    expect(etat.indexer).toHaveBeenCalledTimes(1);
    expect(etat.indexer.mock.calls[0][1]).toBe(B);
    expect(etat.gemini.mock.calls[0][0].prompt).toContain("Type : facture EDF");
    expect(resultat).toEqual({ ok: true, data: { ids: [B], nonLus: 0 } });
  });

  it("cherche quand même par nom et notes si la lecture échoue, et le signale", async () => {
    brancher([ficheA()]);
    etat.indexer.mockResolvedValue({ statut: "echec", quota: false, detail: "illisible" });
    etat.gemini.mockResolvedValue({ ok: true, brut: { ids: [B] } });

    expect(await rechercherDocuments("edf")).toEqual({ ok: true, data: { ids: [B], nonLus: 1 } });
  });

  it("n'appelle pas Gemini quand il n'y a aucun document classé", async () => {
    brancher([], []);
    expect(await rechercherDocuments("passeport")).toEqual({ ok: true, data: { ids: [], nonLus: 0 } });
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("relaie le message de quota de Gemini", async () => {
    brancher([ficheA(), ficheB()]);
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });
    expect(await rechercherDocuments("passeport")).toEqual({ ok: false, error: "Quota atteint." });
  });

  it("explique l'échec de Gemini sans exposer de fiche", async () => {
    brancher([ficheA(), ficheB()]);
    etat.gemini.mockResolvedValue({ ok: false, code: "echec", detail: "Délai dépassé" });
    const resultat = await rechercherDocuments("passeport");
    expect(resultat.ok).toBe(false);
    expect(resultat.error).toContain("Délai dépassé");
    expect(resultat.error).not.toContain("Type :");
  });

  it("échoue proprement si la table des fiches est absente (migration non appliquée)", async () => {
    brancher({ erreur: 'relation "documents_fiches" does not exist' });
    expect(await rechercherDocuments("passeport")).toEqual({
      ok: false,
      error: "La recherche par IA n'est pas disponible pour le moment.",
    });
    expect(etat.gemini).not.toHaveBeenCalled();
  });
});
