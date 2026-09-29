import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

vi.mock("./queue", () => ({
  EVENEMENT_FILE_AJOUT: "kilio:offline-enqueued",
  flushQueue: vi.fn(),
  preloadOfflineDb: vi.fn().mockResolvedValue({}),
}));

import { flushQueue } from "./queue";
import { DELAIS_REJEU_MS, useOnlineSync } from "./useOnlineSync";

const flush = vi.mocked(flushQueue);
const resultat = (restantes: number, synced = 0) => ({ synced, abandoned: 0, restantes });

function definirEnLigne(valeur: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: valeur });
}

function definirVisibilite(valeur: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: valeur });
}

// Laisse passer le démarrage différé (requestIdleCallback absent de jsdom :
// repli à 200 ms) puis les promesses en attente.
async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useOnlineSync : rejeu de la file hors ligne (CLICK-PATH T02)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    definirEnLigne(true);
    definirVisibilite("visible");
    flush.mockResolvedValue(resultat(0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("rejoue la file au démarrage quand l'app est en ligne", async () => {
    renderHook(() => useOnlineSync());
    await avancer(300);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("retente à intervalles croissants après une mise en file tant qu'il reste des actions, puis s'arrête", async () => {
    renderHook(() => useOnlineSync());
    await avancer(300);
    flush.mockClear();
    flush.mockResolvedValue(resultat(1)); // le serveur reste injoignable

    act(() => {
      window.dispatchEvent(new Event("kilio:offline-enqueued"));
    });

    await avancer(DELAIS_REJEU_MS[0]);
    expect(flush).toHaveBeenCalledTimes(1);
    await avancer(DELAIS_REJEU_MS[1]);
    expect(flush).toHaveBeenCalledTimes(2);
    await avancer(DELAIS_REJEU_MS[2]);
    expect(flush).toHaveBeenCalledTimes(3);

    // Plus de rejeu automatique au-delà des délais prévus.
    await avancer(5 * 60_000);
    expect(flush).toHaveBeenCalledTimes(3);
  });

  it("cesse de retenter dès que la file est vide et prévient l'appelant du rejeu réussi", async () => {
    const onSynced = vi.fn();
    renderHook(() => useOnlineSync(onSynced));
    await avancer(300);
    flush.mockClear();
    flush.mockResolvedValue(resultat(0, 1));

    act(() => {
      window.dispatchEvent(new Event("kilio:offline-enqueued"));
    });
    await avancer(DELAIS_REJEU_MS[0]);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(onSynced).toHaveBeenCalledTimes(1);
    await avancer(5 * 60_000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("ne retente pas hors ligne : l'évènement `online` prend le relais", async () => {
    renderHook(() => useOnlineSync());
    await avancer(300);
    flush.mockClear();
    flush.mockResolvedValue(resultat(1));
    definirEnLigne(false);

    act(() => {
      window.dispatchEvent(new Event("kilio:offline-enqueued"));
    });
    await avancer(DELAIS_REJEU_MS[0]);
    expect(flush).not.toHaveBeenCalled();

    definirEnLigne(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await avancer(0);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("rejoue au retour au premier plan", async () => {
    renderHook(() => useOnlineSync());
    await avancer(300);
    flush.mockClear();

    definirVisibilite("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await avancer(0);
    expect(flush).not.toHaveBeenCalled();

    definirVisibilite("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await avancer(0);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("nettoie ses écouteurs et minuteurs au démontage", async () => {
    const { unmount } = renderHook(() => useOnlineSync());
    await avancer(300);
    flush.mockClear();
    flush.mockResolvedValue(resultat(1));
    act(() => {
      window.dispatchEvent(new Event("kilio:offline-enqueued"));
    });

    unmount();
    await avancer(5 * 60_000);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await avancer(0);
    expect(flush).not.toHaveBeenCalled();
  });
});
