import { afterEach, describe, expect, it, vi } from "vitest";
import { estHoteTiktok, extraireIdVideoTiktok, recupererMetadonneesTiktok } from "./tiktok";

afterEach(() => {
  vi.unstubAllGlobals();
});

const canonique = "https://www.tiktok.com/@compte/video/7234567890123456789";

describe("estHoteTiktok", () => {
  it("accepte tiktok.com et ses sous-domaines uniquement", () => {
    expect(estHoteTiktok("tiktok.com")).toBe(true);
    expect(estHoteTiktok("vm.tiktok.com")).toBe(true);
    expect(estHoteTiktok("nottiktok.com")).toBe(false);
    expect(estHoteTiktok("tiktok.com.evil.io")).toBe(false);
  });
});

describe("extraireIdVideoTiktok", () => {
  it("lit l'id directement dans une URL canonique, sans réseau", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await extraireIdVideoTiktok(canonique)).toBe("7234567890123456789");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("suit la redirection d'un lien court", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ url: canonique });
    vi.stubGlobal("fetch", fetchMock);
    expect(await extraireIdVideoTiktok("https://vm.tiktok.com/ZMabc/")).toBe("7234567890123456789");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "HEAD", redirect: "follow" });
  });

  it("refuse une redirection qui sort de TikTok ou sans id vidéo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ url: "https://evil.example/video/123" }));
    expect(await extraireIdVideoTiktok("https://vm.tiktok.com/ZMabc/")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ url: "https://www.tiktok.com/@compte" }));
    expect(await extraireIdVideoTiktok("https://vm.tiktok.com/ZMabc/")).toBeNull();
  });

  it("renvoie null pour un lien invalide, un autre hôte ou un échec réseau", async () => {
    expect(await extraireIdVideoTiktok("pas une url")).toBeNull();
    expect(await extraireIdVideoTiktok("https://example.com/video/1")).toBeNull();
    expect(await extraireIdVideoTiktok("ftp://www.tiktok.com/@a/video/1")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await extraireIdVideoTiktok("https://vm.tiktok.com/ZMabc/")).toBeNull();
  });
});

describe("recupererMetadonneesTiktok", () => {
  it("renvoie miniature, titre et URL canonique", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ thumbnail_url: "https://p16.tiktokcdn.com/a.jpg", title: "Ma vidéo" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await recupererMetadonneesTiktok(canonique)).toEqual({
      url: canonique,
      thumbnailUrl: "https://p16.tiktokcdn.com/a.jpg",
      titre: "Ma vidéo",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("tiktok.com/oembed?url=");
  });

  it("renvoie null si le lien est invalide, la réponse ko, sans miniature ou si fetch échoue", async () => {
    expect(await recupererMetadonneesTiktok("https://example.com/x")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await recupererMetadonneesTiktok(canonique)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ title: "x" }) }));
    expect(await recupererMetadonneesTiktok(canonique)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await recupererMetadonneesTiktok(canonique)).toBeNull();
  });

  it("met un titre vide quand oEmbed n'en fournit pas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ thumbnail_url: "https://x/a.jpg" }) }));
    expect((await recupererMetadonneesTiktok(canonique))?.titre).toBe("");
  });
});
