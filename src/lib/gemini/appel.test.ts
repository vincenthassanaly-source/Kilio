// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appelerGemini } from "./appel";

const reponseTexte = (texte: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texte }] }, finishReason: "STOP" }] }), { status: 200 });

const appelDeBase = { prompt: "Lis ceci", schema: {}, timeoutMs: 5000, etiquette: "test" };

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "cle-de-test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function corpsEnvoye(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as { contents: Array<{ parts: Array<Record<string, unknown>> }> };
}

describe("appelerGemini", () => {
  it("envoie le texte seul quand il n'y a pas d'image (comportement historique)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponseTexte('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const r = await appelerGemini(appelDeBase);
    expect(r).toEqual({ ok: true, brut: { ok: true } });
    expect(corpsEnvoye(fetchMock).contents[0].parts).toEqual([{ text: "Lis ceci" }]);
  });

  it("joint les images en base64 AVANT le texte, dans l'ordre", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponseTexte('{"texte":"bonjour"}'));
    vi.stubGlobal("fetch", fetchMock);
    await appelerGemini({
      ...appelDeBase,
      images: [
        { mimeType: "image/png", data: "AAAA" },
        { mimeType: "image/png", data: "BBBB" },
      ],
    });
    expect(corpsEnvoye(fetchMock).contents[0].parts).toEqual([
      { inlineData: { mimeType: "image/png", data: "AAAA" } },
      { inlineData: { mimeType: "image/png", data: "BBBB" } },
      { text: "Lis ceci" },
    ]);
  });

  it("envoie la clé en en-tête, jamais dans l'URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponseTexte("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await appelerGemini(appelDeBase);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("cle-de-test");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("cle-de-test");
  });

  it("signale l'absence de clé sans appeler le réseau", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await appelerGemini(appelDeBase);
    expect(r).toMatchObject({ ok: false, code: "echec" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("distingue le quota atteint (429) des autres échecs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    expect(await appelerGemini(appelDeBase)).toMatchObject({ ok: false, code: "quota" });
  });
});
