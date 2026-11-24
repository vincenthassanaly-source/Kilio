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
});
