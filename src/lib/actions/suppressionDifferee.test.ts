import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { useMasques } from "./elementsMasques";
import { supprimerAvecAnnulation } from "./suppressionDifferee";

function toutFermer() {
  for (const t of [...getToasts()]) dismissToast(t.id);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  toutFermer();
  vi.useRealTimers();
});

function lancer(extra: Partial<Parameters<typeof supprimerAvecAnnulation>[0]> = {}) {
  const masquer = vi.fn();
  const restaurer = vi.fn();
  const supprimer = vi.fn().mockResolvedValue({ ok: true, data: undefined });
  supprimerAvecAnnulation({
    texte: "« X » supprimé",
    ariaLabel: "Annuler la suppression de « X »",
    masquer,
    restaurer,
    supprimer,
    erreur: "Impossible de supprimer « X ». Réessaie.",
    ...extra,
  });
  return { masquer, restaurer, supprimer };
}

describe("supprimerAvecAnnulation", () => {
  it("masque tout de suite, sans appel serveur, et propose « Annuler »", () => {
    const { masquer, supprimer } = lancer();
    expect(masquer).toHaveBeenCalledTimes(1);
    expect(supprimer).not.toHaveBeenCalled();
    const toast = getToasts().find((t) => t.action);
    expect(toast?.text).toBe("« X » supprimé");
    expect(toast?.action?.label).toBe("Annuler");
  });

  it("n'appelle le serveur qu'après le délai de 6 s", async () => {
    const { supprimer } = lancer();
    await vi.advanceTimersByTimeAsync(5900);
    expect(supprimer).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(supprimer).toHaveBeenCalledTimes(1);
  });

  it("« Annuler » restaure sans aucun appel serveur, même après le délai", async () => {
    const { restaurer, supprimer } = lancer();
    getToasts().find((t) => t.action)?.action?.onAction();
    expect(restaurer).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(supprimer).not.toHaveBeenCalled();
  });

  it("restaure si le serveur échoue", async () => {
    const { restaurer } = lancer({ supprimer: vi.fn().mockRejectedValue(new Error("ko")) });
    await vi.advanceTimersByTimeAsync(6100);
    expect(restaurer).toHaveBeenCalledTimes(1);
  });

  it("l'appel part même si le composant est démonté (navigation dans l'app)", async () => {
    // Le minuteur est au niveau du module : aucun composant n'est nécessaire.
    const { supprimer } = lancer();
    await vi.advanceTimersByTimeAsync(6100);
    expect(supprimer).toHaveBeenCalledTimes(1);
  });

  it("avec `masque`, l'élément est caché dans le store partagé, puis réaffiché par « Annuler »", () => {
    const { result } = renderHook(() => useMasques("test-type"));
    expect(result.current.has("id-1")).toBe(false);

    act(() => {
      lancer({ masque: { type: "test-type", id: "id-1" }, masquer: undefined, restaurer: undefined });
    });
    expect(result.current.has("id-1")).toBe(true);

    act(() => {
      getToasts().find((t) => t.action)?.action?.onAction();
    });
    expect(result.current.has("id-1")).toBe(false);
  });

  it("avec `masque`, l'élément reste caché après une suppression réussie, et revient si elle échoue", async () => {
    const { result } = renderHook(() => useMasques("test-type"));
    act(() => {
      lancer({ masque: { type: "test-type", id: "id-2" } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(result.current.has("id-2")).toBe(true);

    act(() => {
      lancer({
        masque: { type: "test-type", id: "id-3" },
        supprimer: vi.fn().mockResolvedValue({ ok: false, error: "ko" }),
      });
    });
    expect(result.current.has("id-3")).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(result.current.has("id-3")).toBe(false);
  });

  it("`annuler()` (par code) restaure, ferme le toast et empêche l'appel serveur ; sans effet une fois l'appel parti", async () => {
    const restaurer = vi.fn();
    const supprimer = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const poignee = supprimerAvecAnnulation({
      texte: "« X » supprimé",
      ariaLabel: "Annuler",
      restaurer,
      supprimer,
      erreur: "ko",
    });
    poignee.annuler();
    expect(restaurer).toHaveBeenCalledTimes(1);
    expect(getToasts().find((t) => t.action)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(supprimer).not.toHaveBeenCalled();

    const restaurerTard = vi.fn();
    const tardive = supprimerAvecAnnulation({
      texte: "« Y » supprimé",
      ariaLabel: "Annuler",
      restaurer: restaurerTard,
      supprimer,
      erreur: "ko",
    });
    await vi.advanceTimersByTimeAsync(6100);
    tardive.annuler();
    expect(restaurerTard).not.toHaveBeenCalled();
    expect(supprimer).toHaveBeenCalledTimes(1);
  });
});
