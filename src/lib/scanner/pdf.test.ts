// @vitest-environment node
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { A4_PORTRAIT, genererPdf, placerSurA4 } from "./pdf";

async function jpeg(largeur: number, hauteur: number): Promise<Uint8Array> {
  const tampon = await sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .jpeg()
    .toBuffer();
  return new Uint8Array(tampon);
}

describe("placerSurA4", () => {
  it("garde une page portrait pour une image plus haute que large", () => {
    const p = placerSurA4(1000, 1414);
    expect(p.page).toEqual(A4_PORTRAIT);
    expect(p.largeur).toBeLessThanOrEqual(A4_PORTRAIT.largeur + 0.01);
    expect(p.hauteur).toBeLessThanOrEqual(A4_PORTRAIT.hauteur + 0.01);
  });

  it("passe en paysage pour une image plus large que haute", () => {
    const p = placerSurA4(1600, 900);
    expect(p.page.largeur).toBeCloseTo(A4_PORTRAIT.hauteur);
    expect(p.page.hauteur).toBeCloseTo(A4_PORTRAIT.largeur);
  });

  it("conserve les proportions et centre l'image", () => {
    const p = placerSurA4(1000, 500);
    expect(p.largeur / p.hauteur).toBeCloseTo(2);
    expect(p.x).toBeCloseTo((p.page.largeur - p.largeur) / 2);
    expect(p.y).toBeCloseTo((p.page.hauteur - p.hauteur) / 2);
  });
});

describe("genererPdf", () => {
  it("produit un PDF avec une page par image, dans l'ordre", async () => {
    const octets = await genererPdf([await jpeg(300, 400), await jpeg(500, 300), await jpeg(200, 200)], "Test");
    const pdf = await PDFDocument.load(octets);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getTitle()).toBe("Test");
    const [p1, p2] = [pdf.getPage(0).getSize(), pdf.getPage(1).getSize()];
    expect(p1.height).toBeGreaterThan(p1.width);
    expect(p2.width).toBeGreaterThan(p2.height);
  });

  it("refuse une liste vide", async () => {
    await expect(genererPdf([])).rejects.toThrow();
  });
});
