import { describe, expect, it } from "vitest";
import { detecterFormat } from "./detecterFormat";

const octets = (...valeurs: number[]) => Buffer.from(valeurs);

describe("detecterFormat", () => {
  it("reconnaît un PDF sans type MIME ni extension d'après sa signature", () => {
    const fichier = new File(["x"], "Swiss_Life_Insurance_Document", { type: "" });
    expect(detecterFormat(fichier, Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
  });

  it("reconnaît une image sans type MIME (JPEG, PNG, WebP)", () => {
    const sansType = new File(["x"], "photo", { type: "" });
    expect(detecterFormat(sansType, octets(0xff, 0xd8, 0xff, 0xe0))).toBe("image");
    expect(detecterFormat(sansType, octets(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe("image");
    expect(detecterFormat(sansType, Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image");
  });

  it("se fie au type MIME quand il est fourni", () => {
    expect(detecterFormat(new File(["x"], "a", { type: "application/pdf" }), octets(0))).toBe("pdf");
    expect(detecterFormat(new File(["x"], "a", { type: "image/heic" }), octets(0))).toBe("image");
  });

  it("refuse tout le reste", () => {
    expect(detecterFormat(new File(["x"], "a.zip", { type: "" }), Buffer.from("PK\x03\x04"))).toBeNull();
  });
});
