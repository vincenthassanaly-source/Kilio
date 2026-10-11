import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANIMATIONS, cleAnimationOuNull, urlPoster, urlVideo } from "./animations";

describe("animations", () => {
  it("ne reconnaît que les clés connues", () => {
    expect(cleAnimationOuNull("developpe-couche")).toBe("developpe-couche");
    expect(cleAnimationOuNull("../../etc/passwd")).toBeNull();
    expect(cleAnimationOuNull(null)).toBeNull();
    expect(cleAnimationOuNull(undefined)).toBeNull();
  });

  it("construit les URLs", () => {
    expect(urlVideo("elevation-laterale")).toBe("/animations/musculation/elevation-laterale.webm");
    expect(urlPoster("elevation-laterale")).toBe("/animations/musculation/elevation-laterale.webp");
  });

  it("a ses fichiers dans public/", () => {
    for (const cle of ANIMATIONS) {
      for (const url of [urlVideo(cle), urlPoster(cle)]) {
        expect(() => readFileSync(path.join(process.cwd(), "public", url))).not.toThrow();
      }
    }
  });

  it("garde la même liste que le service worker", () => {
    const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    const bloc = /const ANIMATIONS = \[([^\]]*)\]/.exec(sw)?.[1] ?? "";
    const cles = [...bloc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(cles).toEqual([...ANIMATIONS]);
  });
});
