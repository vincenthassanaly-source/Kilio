import { afterEach, describe, expect, it, vi } from "vitest";
import { estHoteYoutube, extraireIdVideoYoutube, recupererMetadonneesYoutube } from "./youtube";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("estHoteYoutube", () => {
  it("accepte les hôtes YouTube connus et refuse les autres", () => {
    expect(estHoteYoutube("youtube.com")).toBe(true);
    expect(estHoteYoutube("m.youtube.com")).toBe(true);
    expect(estHoteYoutube("youtu.be")).toBe(true);
    expect(estHoteYoutube("evil-youtube.com")).toBe(false);
    expect(estHoteYoutube("youtube.com.evil.io")).toBe(false);
  });
});

describe("extraireIdVideoYoutube", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/abc_DEF-123", "abc_DEF-123"],
    ["https://m.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extrait l'id de %s", (url, id) => {
    expect(extraireIdVideoYoutube(url)).toBe(id);
  });

  it.each([
    ["pas une url"],
    ["ftp://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://example.com/watch?v=dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch"],
    ["https://www.youtube.com/watch?v=abc"],
    ["https://www.youtube.com/channel/UC12345678"],
  ])("refuse %s", (url) => {
    expect(extraireIdVideoYoutube(url)).toBeNull();
  });
});

describe("recupererMetadonneesYoutube", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";

  it("renvoie null sans appel réseau pour un lien invalide", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await recupererMetadonneesYoutube("https://example.com/x")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renvoie miniature et titre depuis oEmbed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ thumbnail_url: "https://i.ytimg.com/a.jpg", title: "Titre" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await recupererMetadonneesYoutube(url)).toEqual({
      url,
      thumbnailUrl: "https://i.ytimg.com/a.jpg",
      titre: "Titre",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("youtube.com/oembed?url=");
  });

  it("met un titre vide quand oEmbed n'en fournit pas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ thumbnail_url: "https://x/a.jpg" }) }));
    expect((await recupererMetadonneesYoutube(url))?.titre).toBe("");
  });

  it("renvoie null si la réponse n'est pas ok, sans miniature, ou si fetch échoue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await recupererMetadonneesYoutube(url)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ title: "x" }) }));
    expect(await recupererMetadonneesYoutube(url)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await recupererMetadonneesYoutube(url)).toBeNull();
  });
});
