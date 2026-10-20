import { describe, expect, it } from "vitest";
import { lisserVitesse, pasInertie } from "./inertie";

describe("lisserVitesse", () => {
  it("prend la vitesse instantanée au premier mouvement", () => {
    expect(lisserVitesse(null, 10, 20)).toBeCloseTo(0.5);
  });

  it("mélange l'ancienne vitesse et la nouvelle pour lisser les à-coups", () => {
    const v = lisserVitesse(1, 0, 16);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it("ignore un intervalle nul sans produire d'infini", () => {
    expect(lisserVitesse(0.4, 5, 0)).toBe(0.4);
  });
});

describe("pasInertie", () => {
  it("avance dans le sens de la vitesse et ralentit", () => {
    const a = pasInertie(1, 16);
    expect(a.delta).toBeGreaterThan(0);
    expect(a.vitesse).toBeLessThan(1);
    expect(a.vitesse).toBeGreaterThan(0);
    expect(a.fini).toBe(false);
  });

  it("garde le signe pour un défilement vers le haut", () => {
    const a = pasInertie(-1, 16);
    expect(a.delta).toBeLessThan(0);
    expect(a.vitesse).toBeLessThan(0);
  });

  it("s'arrête quand la vitesse devient négligeable", () => {
    let vitesse = 1.5;
    let pas = 0;
    for (; pas < 2000; pas++) {
      const r = pasInertie(vitesse, 16);
      vitesse = r.vitesse;
      if (r.fini) break;
    }
    expect(pas).toBeLessThan(2000);
    expect(Math.abs(vitesse)).toBeLessThan(0.05);
  });

  it("donne la même distance totale quel que soit le découpage du temps", () => {
    const total = (dt: number) => {
      let v = 1;
      let d = 0;
      for (let t = 0; t < 1000; t += dt) {
        const r = pasInertie(v, dt);
        d += r.delta;
        v = r.vitesse;
      }
      return d;
    };
    expect(total(8)).toBeCloseTo(total(32), 0);
  });
});
