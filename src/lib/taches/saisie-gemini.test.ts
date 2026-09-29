import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_REPONSE, appelerGeminiSaisie } from "./saisie-gemini";

function reponseJson(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });
}

function candidat(texte: string, extra: Record<string, unknown> = {}) {
  return { candidates: [{ content: { parts: [{ text: texte }] }, ...extra }] };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "cle-de-test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("appelerGeminiSaisie", () => {
  it("renvoie le JSON de Gemini et n'expose jamais la clé dans l'URL", async () => {
    fetchMock.mockResolvedValue(reponseJson(candidat('{"question":{"texte":"","choix":[]},"taches":[]}')));

    const r = await appelerGeminiSaisie("prompt");

    expect(r).toEqual({ ok: true, brut: { question: { texte: "", choix: [] }, taches: [] } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("cle-de-test");
    expect(url).not.toContain("key=");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("cle-de-test");
  });

  it("envoie un schéma sans `nullable` (chaînes vides à la place)", async () => {
    fetchMock.mockResolvedValue(reponseJson(candidat("{}")));
    await appelerGeminiSaisie("prompt");

    const corps = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(JSON.stringify(corps.generationConfig.responseSchema)).not.toContain("nullable");
  });

  it("rend toutes les propriétés obligatoires", () => {
    const tache = SCHEMA_REPONSE.properties.taches.items;
    expect([...tache.required].sort()).toEqual(Object.keys(tache.properties).sort());
    expect([...SCHEMA_REPONSE.properties.question.required].sort()).toEqual(
      Object.keys(SCHEMA_REPONSE.properties.question.properties).sort()
    );
  });

  it("signale une clé absente sans appeler Google", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const r = await appelerGeminiSaisie("prompt");

    expect(r).toMatchObject({ ok: false, code: "echec" });
    expect(!r.ok && r.detail).toMatch(/GEMINI_API_KEY absente/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("distingue le quota (429)", async () => {
    fetchMock.mockResolvedValue(reponseJson({ error: { message: "Resource exhausted" } }, 429));
    const r = await appelerGeminiSaisie("prompt");

    expect(r).toEqual({ ok: false, code: "quota", detail: "Gemini a répondu 429." });
  });

  it("reprend le message de Google pour un refus 400 (schéma rejeté, par exemple)", async () => {
    fetchMock.mockResolvedValue(
      reponseJson({ error: { message: 'Invalid JSON payload received.\n  Unknown name "nullable" at schema' } }, 400)
    );
    const r = await appelerGeminiSaisie("prompt");

    expect(r).toMatchObject({ ok: false, code: "echec" });
    expect(!r.ok && r.detail).toBe('Gemini a répondu 400 : Invalid JSON payload received. Unknown name "nullable" at schema');
  });

  it("tient sans message quand la réponse d'erreur n'est pas du JSON", async () => {
    fetchMock.mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    const r = await appelerGeminiSaisie("prompt");

    expect(!r.ok && r.detail).toBe("Gemini a répondu 502.");
  });

  it("borne la longueur du détail", async () => {
    fetchMock.mockResolvedValue(reponseJson({ error: { message: "x".repeat(2000) } }, 400));
    const r = await appelerGeminiSaisie("prompt");

    expect(!r.ok && r.detail.length).toBeLessThanOrEqual(200);
  });

  it("nomme le délai dépassé", async () => {
    const erreur = new Error("The operation was aborted due to timeout");
    erreur.name = "TimeoutError";
    fetchMock.mockRejectedValue(erreur);
    const r = await appelerGeminiSaisie("prompt");

    expect(!r.ok && r.detail).toMatch(/Délai dépassé \(10 s\)/);
  });

  it("rapporte une erreur réseau avec son message", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const r = await appelerGeminiSaisie("prompt");

    expect(!r.ok && r.detail).toBe("Appel à Gemini impossible : fetch failed.");
  });

  it("explique une réponse sans texte (contenu bloqué)", async () => {
    fetchMock.mockResolvedValue(reponseJson({ candidates: [{ finishReason: "SAFETY" }] }));
    const r = await appelerGeminiSaisie("prompt");

    expect(!r.ok && r.detail).toBe("Réponse Gemini sans texte (SAFETY).");
  });

  it("explique une réponse tronquée (JSON illisible)", async () => {
    fetchMock.mockResolvedValue(reponseJson(candidat('{"taches":[{"titre":"Den', { finishReason: "MAX_TOKENS" })));
    const r = await appelerGeminiSaisie("prompt");

    expect(!r.ok && r.detail).toBe("Réponse Gemini illisible (MAX_TOKENS).");
  });
});
