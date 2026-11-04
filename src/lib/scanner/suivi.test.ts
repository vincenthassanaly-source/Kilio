import { describe, expect, it } from "vitest";
import type { Quad } from "./geometrie";
import { ETAT_SUIVI_INITIAL, suivreCadre } from "./suivi";

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
});
