import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Régression : le moteur OpenCV (Emscripten) est « thenable » et se rend lui-même à tout `then`.
// Une promesse résolue avec lui tourne en boucle infinie de micro-tâches et fige la page entière.
function moduleThenable() {
  const moteur: { Mat: unknown; then: (cb: (m: unknown) => void) => void } = {
    Mat: class {},
    then(cb) {
      cb(moteur);
    },
  };
  return moteur;
}

describe("chargerOpenCv", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    delete (window as unknown as { cv?: unknown }).cv;
  });

  it("se résout (sans boucler) quand `cv` est une promesse qui rend un moteur thenable", async () => {
    const moteur = moduleThenable();
    // Comme dans le navigateur : au départ `cv` n'a pas encore `Mat`, seulement `then`.
    (window as unknown as { cv: unknown }).cv = { then: (cb: (m: unknown) => void) => cb(moteur) };
    const { chargerOpenCv, openCvSiPret } = await import("./opencv");
    const gagnant = await Promise.race([
      chargerOpenCv().then((r) => (r.cv === (moteur as never) ? "ok" : "autre")),
      new Promise<string>((res) => setTimeout(() => res("BLOQUE"), 2000)),
    ]);
    expect(gagnant).toBe("ok");
    expect(openCvSiPret()).toBe(moteur);
  });

  it("répond aussi quand OpenCV est déjà chargé (deuxième appel)", async () => {
    const moteur = moduleThenable();
    (window as unknown as { cv: unknown }).cv = { then: (cb: (m: unknown) => void) => cb(moteur) };
    const { chargerOpenCv } = await import("./opencv");
    await chargerOpenCv();
    const gagnant = await Promise.race([
      chargerOpenCv().then(() => "ok"),
      new Promise<string>((res) => setTimeout(() => res("BLOQUE"), 2000)),
    ]);
    expect(gagnant).toBe("ok");
  });
});
