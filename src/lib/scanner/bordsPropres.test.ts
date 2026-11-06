import { describe, expect, it } from "vitest";
import { nettoyerLesBords } from "./bordsPropres";
import type { ImageDataLike } from "./geometrie";

const W = 400, H = 500;

function page(couleurPapier: number, dessiner: (x: number, y: number) => number | null): ImageDataLike {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = dessiner(x, y) ?? couleurPapier;
      const i = (y * W + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

const lum = (img: ImageDataLike, x: number, y: number) => img.data[(y * img.width + x) * 4];
/** Lignes de texte au milieu de la page. */
const texte = (x: number, y: number) => (x > 80 && x < 320 && y > 120 && y < 400 && y % 24 < 9 ? 40 : null);

describe("nettoyage des bords d'une page redressée", () => {
  it("repeint de la couleur du papier un triangle de fond noir resté dans un coin", () => {
    // Régression : la page est coupée par le bord de la photo, un triangle noir restait dans le coin.
    const img = page(238, (x, y) => (x + y < 90 ? 10 : texte(x, y)));
    const net = nettoyerLesBords(img);
    expect(net).not.toBe(img);
    expect(lum(net, 5, 5), "le coin doit devenir du papier").toBeGreaterThan(225);
    expect(lum(net, 40, 40), "le centre du triangle aussi").toBeGreaterThan(225);
  });

  it("repeint aussi un triangle noir qui ne touche que le bord gauche", () => {
    // Cas réel : le coin haut gauche d'une page coupée par la photo, la pointe du triangle ne touche pas le haut.
    const img = page(238, (x, y) => (y > 20 && y < 260 && x < 55 * (1 - (y - 20) / 240) ? 10 : texte(x, y)));
    const net = nettoyerLesBords(img);
    expect(net).not.toBe(img);
    expect(lum(net, 4, 40), "la base du triangle doit devenir du papier").toBeGreaterThan(225);
  });

  it("garde le texte intact", () => {
    const img = page(238, (x, y) => (x + y < 90 ? 10 : texte(x, y)));
    const net = nettoyerLesBords(img);
    expect(lum(net, 150, 128)).toBeLessThan(60); // une ligne de texte (y % 24 = 8)
  });

  it("ne touche pas une lettre ou un trait collé au bord (trop petit)", () => {
    const img = page(238, (x, y) => (x < 10 && y > 200 && y < 215 ? 20 : texte(x, y)));
    expect(nettoyerLesBords(img)).toBe(img);
  });

  it("ne touche pas une page sombre (carte, photo)", () => {
    const img = page(90, (x, y) => (x + y < 90 ? 10 : null));
    expect(nettoyerLesBords(img)).toBe(img);
  });

  it("ne touche pas une page sans fond au bord", () => {
    const img = page(238, texte);
    expect(nettoyerLesBords(img)).toBe(img);
  });

  it("ne repeint pas une ombre qui contient du texte ou une signature (coin bas gauche dans l'ombre)", () => {
    // Régression : une première version prenait toute zone sombre reliée au bord pour du fond et a
    // effacé la signature et le bas d'une ordonnance photographiée dans l'ombre.
    const ombre = (x: number, y: number) => {
      if (x < 220 && y > 300) return (x * 3 + y * 5) % 11 < 4 ? 40 : 108; // encre dans une zone d'ombre
      return texte(x, y);
    };
    const img = page(238, ombre);
    expect(nettoyerLesBords(img)).toBe(img);
  });

  it("ne repeint pas un bandeau noir sur toute la largeur du haut de la page", () => {
    const img = page(238, (x, y) => (y < 40 ? 12 : texte(x, y)));
    expect(nettoyerLesBords(img)).toBe(img);
  });

  it("ne repeint pas une zone sombre énorme (plus d'un tiers de la page)", () => {
    const img = page(238, (x) => (x < 220 ? 12 : null));
    expect(nettoyerLesBords(img)).toBe(img);
  });
});
