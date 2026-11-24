import { describe, expect, it } from "vitest";
import type { Quad } from "./geometrie";
import { ETAT_SUIVI_INITIAL, messageViseur, suivreCadre } from "./suivi";

const L = 640, H = 480;
const cadre = (dx = 0, dy = 0): Quad => [
  { x: 100 + dx, y: 80 + dy },
  { x: 500 + dx, y: 90 + dy },
  { x: 490 + dx, y: 400 + dy },
  { x: 110 + dx, y: 390 + dy },
];

describe("suivreCadre", () => {
  it("affiche tout de suite le premier cadre détecté", () => {
    const etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H);
    expect(etat.quad).toEqual(cadre());
  });

  it("lisse un petit déplacement (le cadre se rapproche sans sauter)", () => {
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H);
    etat = suivreCadre(etat, cadre(20, 0), L, H);
    expect(etat.quad![0].x).toBeGreaterThan(100);
    expect(etat.quad![0].x).toBeLessThan(120);
  });

  it("garde le dernier cadre quelques images sans détection, puis l'efface", () => {
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H);
    for (let i = 0; i < 3; i++) {
      etat = suivreCadre(etat, null, L, H);
      expect(etat.quad, `image ${i + 1} sans détection`).not.toBeNull();
    }
    etat = suivreCadre(etat, null, L, H);
    expect(etat.quad).toBeNull();
  });

  it("une détection retrouvée remet le compteur d'échecs à zéro", () => {
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H);
    etat = suivreCadre(etat, null, L, H);
    etat = suivreCadre(etat, cadre(), L, H);
    expect(etat.manques).toBe(0);
  });

  it("ignore un cadre isolé très différent (faux positif) mais adopte un cadre confirmé deux fois", () => {
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H);
    const ailleurs = cadre(-80, 60);
    etat = suivreCadre(etat, ailleurs, L, H);
    expect(etat.quad![0].x).toBeCloseTo(100); // pas encore adopté
    etat = suivreCadre(etat, ailleurs, L, H);
    expect(etat.quad![0].x).toBeCloseTo(20); // confirmé : adopté tel quel
  });

  it("une détection normale entre deux faux positifs ne confirme pas le cadre lointain", () => {
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H);
    etat = suivreCadre(etat, cadre(-80, 60), L, H);
    etat = suivreCadre(etat, cadre(), L, H); // retour au cadre habituel
    etat = suivreCadre(etat, cadre(-80, 60), L, H); // nouveau saut : pas deux fois de suite
    expect(etat.quad![0].x).toBeGreaterThan(90);
  });

  it("détection maison : le premier cadre n'est montré qu'après deux détections concordantes", () => {
    const maison = { confirmerPremier: true };
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H, maison);
    expect(etat.quad).toBeNull();
    etat = suivreCadre(etat, cadre(3, 2), L, H, maison);
    expect(etat.quad).toEqual(cadre(3, 2));
  });

  it("détection maison : deux cadres qui ne concordent pas ne s'affichent pas", () => {
    const maison = { confirmerPremier: true };
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H, maison);
    etat = suivreCadre(etat, cadre(-80, 60), L, H, maison);
    expect(etat.quad).toBeNull();
  });
});

describe("suivreCadre : lissage adaptatif", () => {
  // Bruit pseudo-aléatoire reproductible.
  const bruit = (() => {
    let a = 7;
    return () => {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      return a / 0x7fffffff - 0.5;
    };
  })();
  const bruite = (q: Quad, amplitude: number): Quad => q.map((p) => ({ x: p.x + bruit() * amplitude, y: p.y + bruit() * amplitude })) as Quad;
  const ecart = (a: Quad, b: Quad) => a.reduce((s, p, i) => s + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / 4;

  it("document immobile : le cadre affiché tremble bien moins que la détection brute", () => {
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H, { instant: 0 });
    let precedent = etat.quad!;
    let tremblement = 0;
    for (let i = 1; i <= 40; i++) {
      etat = suivreCadre(etat, bruite(cadre(), 4), L, H, { instant: i * 150, zoneMorte: 640 / 360 });
      tremblement += ecart(etat.quad!, precedent);
      precedent = etat.quad!;
    }
    // Brut : ±2 px par coordonnée, soit ≈ 1,5 px d'écart moyen d'une image à l'autre.
    expect(tremblement / 40).toBeLessThan(0.4);
  });

  it("zone morte : un écart de moins d'un pixel d'analyse ne fait pas bouger le cadre", () => {
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H, { instant: 0 });
    etat = suivreCadre(etat, cadre(1, 0), L, H, { instant: 150, zoneMorte: 2 });
    expect(etat.quad).toEqual(cadre());
  });

  it("dérive lente : le cadre suit le document sans traîner (retard < 1 % de la diagonale)", () => {
    // 73 px/s sur une image de 640×480, une détection toutes les 150 ms.
    let etat = suivreCadre(ETAT_SUIVI_INITIAL, cadre(), L, H, { instant: 0 });
    let retard = 0;
    for (let i = 1; i <= 20; i++) {
      const vrai = cadre(73 * 0.15 * i, 0);
      etat = suivreCadre(etat, vrai, L, H, { instant: i * 150, zoneMorte: 640 / 360 });
      if (i > 5) retard = Math.max(retard, ecart(etat.quad!, vrai) / Math.hypot(L, H));
    }
    expect(retard).toBeLessThan(0.01);
  });
});

describe("messageViseur", () => {
  it("ne dit « Feuille repérée » que lorsqu'un cadre est affiché", () => {
    expect(messageViseur(cadre(), "opencv")).toBe("Feuille repérée");
    expect(messageViseur(cadre(), "maison")).toBe("Feuille repérée");
  });

  it("dit qu'il se prépare tant qu'OpenCV n'est pas prêt et qu'aucun cadre n'est confirmé", () => {
    expect(messageViseur(null, "maison")).toBe("Préparation de la détection…");
    expect(messageViseur(null, null)).toBe("Préparation de la détection…");
    expect(messageViseur(null, "opencv")).toBe("Cherche la feuille…");
  });
});
