import { afterEach, describe, expect, it, vi } from "vitest";
import { recupererMetadonneesVideoOuLien } from "./video";

afterEach(() => vi.unstubAllGlobals());

describe("recupererMetadonneesVideoOuLien", () => {
  it("garde le lien TikTok sans miniature quand le réseau échoue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")));
    expect(await recupererMetadonneesVideoOuLien("https://vm.tiktok.com/ZMabc/")).toEqual({
      type: "tiktok",
      url: "https://vm.tiktok.com/ZMabc/",
      thumbnailUrl: "",
      titre: "",
    });
  });

  it("enregistre l'URL complète du lien court quand elle se résout", async () => {
    const complete = "https://www.tiktok.com/@a/video/123";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (u: string) => {
        if (u.includes("oembed")) throw new Error("bloqué");
        return { url: complete };
      })
    );
    expect(await recupererMetadonneesVideoOuLien("https://vm.tiktok.com/ZMabc/")).toMatchObject({ url: complete });
  });

  it("renvoie null pour une plateforme inconnue", async () => {
    expect(await recupererMetadonneesVideoOuLien("https://exemple.com/v/1")).toBeNull();
  });
});
