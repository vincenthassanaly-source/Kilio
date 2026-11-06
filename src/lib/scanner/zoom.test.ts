import { describe, expect, it } from "vitest";
import {
  VUE_INITIALE,
  ZOOM_MAX,
  bornerVue,
  pincer,
  relatifAuCentre,
  tailleAffichee,
  zoomerAutour,
} from "./zoom";

const conteneur = { largeur: 400, hauteur: 400 };
const carre = { largeur: 1000, hauteur: 1000 };
const portrait = { largeur: 100, hauteur: 200 };

describe("zoom de l'aperçu", () => {
  it("ajuste l'image au conteneur sans la déformer", () => {
    expect(tailleAffichee(portrait, conteneur)).toEqual({ largeur: 200, hauteur: 400 });
    expect(tailleAffichee(carre, { largeur: 400, hauteur: 800 })).toEqual({ largeur: 400, hauteur: 400 });
  });

  it("garde l'image centrée à l'échelle 1, quel que soit le déplacement demandé", () => {
    const vue = bornerVue({ echelle: 1, x: 80, y: -60 }, carre, conteneur);
    expect(vue).toEqual({ echelle: 1, x: 0, y: 0 });
  });

  it("ne laisse jamais de vide d'un côté d'une image zoomée", () => {
    // Carré 400×400 zoomé ×2 : 800 px pour un conteneur de 400, donc ±200 de marge.
    const vue = bornerVue({ echelle: 2, x: 999, y: -999 }, carre, conteneur);
    expect(vue).toEqual({ echelle: 2, x: 200, y: -200 });
  });

  it("garde centré l'axe sur lequel l'image tient encore (portrait zoomé ×1,5)", () => {
    // Largeur affichée 200 × 1,5 = 300 < 400 : pas de déplacement horizontal possible.
    const vue = bornerVue({ echelle: 1.5, x: 120, y: 50 }, portrait, conteneur);
    expect(vue.x).toBe(0);
    expect(vue.y).toBe(50); // hauteur 400 × 1,5 = 600 : ±100 de marge
  });

  it("borne l'échelle entre 1 et le zoom maximal", () => {
    expect(bornerVue({ echelle: 0.2, x: 0, y: 0 }, carre, conteneur).echelle).toBe(1);
    expect(bornerVue({ echelle: 99, x: 0, y: 0 }, carre, conteneur).echelle).toBe(ZOOM_MAX);
  });

  it("garde sous le doigt le même point de l'image en zoomant", () => {
    const point = { x: 100, y: 50 };
    const vue = zoomerAutour(VUE_INITIALE, 2, point, carre, conteneur);
    // Point d'image sous le doigt avant : p = point. Après : écran = t + échelle × p doit rester = point.
    expect(vue.x + vue.echelle * point.x).toBeCloseTo(point.x, 5);
    expect(vue.y + vue.echelle * point.y).toBeCloseTo(point.y, 5);
  });

  it("ne dézoome pas en dessous de la page entière", () => {
    const vue = zoomerAutour({ echelle: 2, x: 50, y: 50 }, 0.1, { x: 0, y: 0 }, carre, conteneur);
    expect(vue).toEqual({ echelle: 1, x: 0, y: 0 });
  });

  it("zoome en écartant deux doigts, de l'échelle du rapport des distances", () => {
    const vue = pincer(VUE_INITIALE, { x: 0, y: 0 }, 100, { x: 0, y: 0 }, 250, carre, conteneur);
    expect(vue.echelle).toBeCloseTo(2.5, 5);
  });

  it("déplace l'image quand les deux doigts glissent ensemble (échelle > 1)", () => {
    const vue0 = { echelle: 2, x: 0, y: 0 };
    const vue = pincer(vue0, { x: 0, y: 0 }, 100, { x: 30, y: -20 }, 100, carre, conteneur);
    expect(vue.echelle).toBe(2);
    expect(vue.x).toBeCloseTo(30, 5);
    expect(vue.y).toBeCloseTo(-20, 5);
  });

  it("ignore un pincement dont la distance de départ est nulle", () => {
    const vue = pincer(VUE_INITIALE, { x: 0, y: 0 }, 0, { x: 5, y: 5 }, 80, carre, conteneur);
    expect(vue).toEqual(VUE_INITIALE);
  });

  it("exprime un point de l'écran relativement au centre du conteneur", () => {
    const zone = { left: 10, top: 100, width: 400, height: 600 };
    expect(relatifAuCentre({ x: 210, y: 400 }, zone)).toEqual({ x: 0, y: 0 });
    expect(relatifAuCentre({ x: 10, y: 100 }, zone)).toEqual({ x: -200, y: -300 });
  });
});
