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

  it("renvoie null pour une plateforme inconnue", async () => {
    expect(await recupererMetadonneesVideoOuLien("https://exemple.com/v/1")).toBeNull();
  });
});
