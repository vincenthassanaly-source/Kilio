import { describe, expect, it } from "vitest";
import { estMiniatureStockee, estUrlMiniatureTiktokCopiable } from "./miniature";

describe("estMiniatureStockee", () => {
  it("reconnaît une URL du bucket collection-images", () => {
    expect(estMiniatureStockee("https://x.supabase.co/storage/v1/object/public/collection-images/a.jpg")).toBe(true);
    expect(estMiniatureStockee("https://p16.tiktokcdn.com/a.jpg")).toBe(false);
    expect(estMiniatureStockee(null)).toBe(false);
    expect(estMiniatureStockee("")).toBe(false);
  });
});

describe("estUrlMiniatureTiktokCopiable", () => {
  it.each([
    "https://p16-sign-va.tiktokcdn.com/obj/a.jpeg?x-expires=1",
    "https://p19-pu-sign-useast8.tiktokcdn-us.com/a.jpeg",
    "https://p16-sign.tiktokcdn-eu.com/a.jpeg",
    "https://tiktokcdn.com/a.jpeg",
  ])("accepte %s", (url) => {
    expect(estUrlMiniatureTiktokCopiable(url)).toBe(true);
  });

  it.each([
    "http://p16.tiktokcdn.com/a.jpeg",
    "https://evil-tiktokcdn.com/a.jpeg",
    "https://tiktokcdn.com.evil.io/a.jpeg",
    "https://169.254.169.254/latest/meta-data",
    "https://i.ytimg.com/vi/x/hq.jpg",
    "pas une url",
  ])("refuse %s", (url) => {
    expect(estUrlMiniatureTiktokCopiable(url)).toBe(false);
  });
});
