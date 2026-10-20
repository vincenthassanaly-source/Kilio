import { describe, expect, it } from "vitest";
import { ajouter, annuler, gommer, historiqueVide, peutAnnuler, peutRetablir, retablir } from "./historique";
import type { Trait } from "./traits";

const t = (n: number): Trait => ({ e: 1, p: [n, n, 50, n + 1, n + 1, 50] });

describe("historique", () => {
  it("ajoute un trait et permet de l'annuler puis de le rétablir", () => {
    let h = ajouter(historiqueVide(), t(1));
    expect(h.traits).toEqual([t(1)]);
    h = annuler(h);
    expect(h.traits).toEqual([]);
    expect(peutRetablir(h)).toBe(true);
    h = retablir(h);
    expect(h.traits).toEqual([t(1)]);
  });

  it("vide la pile de rétablissement quand on écrit après une annulation", () => {
    let h = ajouter(ajouter(historiqueVide(), t(1)), t(2));
    h = annuler(h);
    h = ajouter(h, t(3));
    expect(peutRetablir(h)).toBe(false);
    expect(h.traits).toEqual([t(1), t(3)]);
  });

  it("gomme plusieurs traits d'un coup et les remet à leur place à l'annulation", () => {
    let h = [t(1), t(2), t(3), t(4)].reduce(ajouter, historiqueVide());
    h = gommer(h, [3, 1]);
    expect(h.traits).toEqual([t(1), t(3)]);
    h = annuler(h);
    expect(h.traits).toEqual([t(1), t(2), t(3), t(4)]);
    h = retablir(h);
    expect(h.traits).toEqual([t(1), t(3)]);
  });

  it("ignore une gomme qui ne touche rien", () => {
    const h = ajouter(historiqueVide(), t(1));
    expect(gommer(h, [])).toBe(h);
  });

  it("ne fait rien à annuler/rétablir sur un historique vide", () => {
    const h = historiqueVide();
    expect(peutAnnuler(h)).toBe(false);
    expect(annuler(h)).toBe(h);
    expect(retablir(h)).toBe(h);
  });

  it("repart des traits déjà enregistrés sans pouvoir les annuler", () => {
    const h = historiqueVide([t(1), t(2)]);
    expect(h.traits).toHaveLength(2);
    expect(peutAnnuler(h)).toBe(false);
  });
});
