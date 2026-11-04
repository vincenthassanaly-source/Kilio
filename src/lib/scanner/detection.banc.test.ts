// Banc d'essai de la détection : chaque scène difficile doit retrouver ses
// coins avec une erreur maximale (en % de la diagonale de l'image).
import { afterAll, describe, expect, it } from "vitest";
import { detecterQuadrilatere, reduirePourDetection } from "./detection";
import { mettreAEchelle } from "./geometrie";
import { erreurCoins, sceneLimite, scenesDeReference } from "./scenes";

const SEUIL_ERREUR = 0.03;
const scenes = scenesDeReference();
const rapport: string[] = [];

describe("banc de détection des bords", () => {
  afterAll(() => {
    console.log("\n=== Banc de détection ===\n" + rapport.join("\n"));
  });

  for (const scene of scenes) {
    it(`${scene.nom} : coins à moins de ${SEUIL_ERREUR * 100} % de la diagonale`, () => {
      const debut = performance.now();
      const { image, facteur } = reduirePourDetection(scene.image);
      const brut = detecterQuadrilatere(image);
      const duree = performance.now() - debut;
      if (!brut) rapport.push(`${scene.nom.padEnd(44)} NON DÉTECTÉE`);
      expect(brut, "aucun document détecté").not.toBeNull();
      const quad = mettreAEchelle(brut!, facteur);
      const erreur = erreurCoins(quad, scene.verite, scene.image.width, scene.image.height);
      rapport.push(`${scene.nom.padEnd(44)} erreur ${(erreur * 100).toFixed(2)} %  (${duree.toFixed(0)} ms)`);
      expect(erreur).toBeLessThan(SEUIL_ERREUR);
    });
  }

  it("cas limite (contraste très faible) : pas de faux cadre", () => {
    // Pas de garantie de détection ici, mais si un cadre est proposé il doit être juste.
    const scene = sceneLimite();
    const { image, facteur } = reduirePourDetection(scene.image);
    const brut = detecterQuadrilatere(image);
    if (!brut) {
      rapport.push(`${scene.nom.padEnd(44)} non détectée (accepté : cadre par défaut)`);
      return;
    }
    const erreur = erreurCoins(mettreAEchelle(brut, facteur), scene.verite, scene.image.width, scene.image.height);
    rapport.push(`${scene.nom.padEnd(44)} erreur ${(erreur * 100).toFixed(2)} %`);
    expect(erreur).toBeLessThan(0.06);
  });
});
