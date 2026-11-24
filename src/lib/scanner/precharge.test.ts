import { afterEach, describe, expect, it, vi } from "vitest";

const chargerOpenCv = vi.fn(() => Promise.resolve({ cv: {} }));
vi.mock("./opencv", () => ({ chargerOpenCv, openCvSiPret: () => null }));

const { prechargerOpenCvSiPossible } = await import("./traitement");

function connexion(valeur: { saveData?: boolean } | undefined) {
  Object.defineProperty(navigator, "connection", { value: valeur, configurable: true });
}

afterEach(() => {
  chargerOpenCv.mockClear();
  connexion(undefined);
  vi.useRealTimers();
});

describe("préchargement d'OpenCV à l'ouverture de /scanner", () => {
  it("charge OpenCV pendant un temps libre", async () => {
    vi.useFakeTimers();
    prechargerOpenCvSiPossible();
    await vi.runAllTimersAsync();
    expect(chargerOpenCv).toHaveBeenCalledTimes(1);
  });

  it("ne télécharge rien si le navigateur demande d'économiser les données", async () => {
    vi.useFakeTimers();
    connexion({ saveData: true });
    prechargerOpenCvSiPossible();
    await vi.runAllTimersAsync();
    expect(chargerOpenCv).not.toHaveBeenCalled();
  });

  it("marche sans navigator.connection ni requestIdleCallback (Safari)", async () => {
    vi.useFakeTimers();
    const ric = (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    try {
      prechargerOpenCvSiPossible();
      await vi.runAllTimersAsync();
      expect(chargerOpenCv).toHaveBeenCalledTimes(1);
    } finally {
      if (ric) (window as { requestIdleCallback?: unknown }).requestIdleCallback = ric;
    }
  });

  it("annule le préchargement si la page est quittée avant le temps libre", async () => {
    vi.useFakeTimers();
    const annuler = prechargerOpenCvSiPossible();
    annuler();
    await vi.runAllTimersAsync();
    expect(chargerOpenCv).not.toHaveBeenCalled();
  });

  describe("avec requestIdleCallback (Chrome, Firefox)", () => {
    type Fenetre = { requestIdleCallback?: unknown; cancelIdleCallback?: unknown };
    let rappels: Map<number, () => void>;
    let options: { timeout: number } | undefined;

    function installer() {
      rappels = new Map();
      let suivant = 1;
      (window as Fenetre).requestIdleCallback = (cb: () => void, o?: { timeout: number }) => {
        options = o;
        rappels.set(suivant, cb);
        return suivant++;
      };
      (window as Fenetre).cancelIdleCallback = (id: number) => rappels.delete(id);
    }

    afterEach(() => {
      delete (window as Fenetre).requestIdleCallback;
      delete (window as Fenetre).cancelIdleCallback;
    });

    it("attend le temps libre (au plus 1,5 s) puis charge OpenCV, sans passer par setTimeout", () => {
      installer();
      const minuterie = vi.spyOn(window, "setTimeout");
      prechargerOpenCvSiPossible();
      expect(chargerOpenCv).not.toHaveBeenCalled();
      expect(options).toEqual({ timeout: 1500 });
      expect(minuterie).not.toHaveBeenCalled();
      rappels.forEach((cb) => cb());
      expect(chargerOpenCv).toHaveBeenCalledTimes(1);
      minuterie.mockRestore();
    });

    it("annule le rappel de temps libre si la page est quittée avant", () => {
      installer();
      const annuler = prechargerOpenCvSiPossible();
      expect(rappels.size).toBe(1);
      annuler();
      expect(rappels.size).toBe(0);
      expect(chargerOpenCv).not.toHaveBeenCalled();
    });
  });
});
