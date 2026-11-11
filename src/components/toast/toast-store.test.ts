import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dismissInfoToasts,
  dismissToast,
  getToasts,
  showActionToast,
  showErrorToast,
  showToast,
  subscribeToasts,
} from "./toast-store";

afterEach(() => {
  for (const t of [...getToasts()]) dismissToast(t.id);
  vi.useRealTimers();
});

describe("dismissInfoToasts", () => {
  it("retire un toast informatif mais garde un toast à action et une erreur", () => {
    showToast("Événement modifié");
    showErrorToast("Échec");
    showActionToast("« RDV » supprimé", { onAction: () => {} });

    dismissInfoToasts();

    const textes = getToasts().map((t) => t.text);
    expect(textes).not.toContain("Événement modifié");
    expect(textes).toContain("Échec");
    expect(textes).toContain("« RDV » supprimé");
  });

  it("ne notifie pas les abonnés quand il n'y a rien à retirer", () => {
    showActionToast("Supprimé", { onAction: () => {} });
    const ecoute = vi.fn();
    const arreter = subscribeToasts(ecoute);
    dismissInfoToasts();
    arreter();
    expect(ecoute).not.toHaveBeenCalled();
  });

  it("le timer d'un toast déjà retiré reste inoffensif", () => {
    vi.useFakeTimers();
    showToast("Événement modifié");
    dismissInfoToasts();
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
    expect(getToasts()).toHaveLength(0);
  });
});
