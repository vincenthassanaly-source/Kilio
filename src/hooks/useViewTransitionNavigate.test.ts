import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useViewTransitionNavigate } from "./useViewTransitionNavigate";

// Rapport utilisateur : « de temps en temps, lorsque je clique sur les
// onglets du bas... il arrive qu'il y ait un chargement. À la fin du
// chargement je n'ai toujours pas changé d'onglet ». Deux sessions
// précédentes (reports/2026-09-11 et 2026-09-12) ont tracé le mécanisme
// jusqu'au garde-fou TIMEOUT_ABANDON_MS sans trouver de bug JS dans le
// déclenchement de la navigation lui-même — la cause probable est une
// latence/panne d'infra hors de portée du code. Ce que le code peut
// corriger : le silence total à l'abandon, qui laisse l'utilisateur sans
// aucun indice que ça a échoué plutôt que d'avoir juste pris du temps.

let currentPathname = "/";
const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => currentPathname,
}));

vi.mock("@/lib/navigation/registry", () => ({
  isModuleRootPath: () => false,
}));

const { showErrorToast } = vi.hoisted(() => ({ showErrorToast: vi.fn() }));
vi.mock("@/components/toast/toast-store", () => ({ showErrorToast }));

function installStartViewTransitionFactice() {
  (document as unknown as { startViewTransition: (cb: () => void | Promise<void>) => { finished: Promise<void> } }).startViewTransition = (
    cb: () => void | Promise<void>
  ) => {
    cb();
    return { finished: Promise.resolve() };
  };
}

// CLICK-PATH-606 : quand le pathname réel n'atteint jamais la cible
// (navigation qui échoue silencieusement), l'utilisateur doit être informé
// plutôt que de voir le chargement s'arrêter sans rien lui dire.
describe("useViewTransitionNavigate — abandon après TIMEOUT_ABANDON_MS (CLICK-PATH-606)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentPathname = "/";
    push.mockClear();
    replace.mockClear();
    showErrorToast.mockClear();
    installStartViewTransitionFactice();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });

  it("affiche un toast d'échec quand le pathname n'atteint jamais la cible", async () => {
    const { result } = renderHook(() => useViewTransitionNavigate());

    act(() => {
      result.current("/agenda");
    });

    expect(push).toHaveBeenCalledWith("/agenda");
    // Le pathname (mock) ne change jamais : la navigation reste bloquée,
    // comme dans le scénario rapporté.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(showErrorToast.mock.calls[0][0]).toMatch(/réessaie/i);
  });

  it("n'affiche pas de toast quand le pathname atteint la cible avant l'abandon", async () => {
    const { result, rerender } = renderHook(() => useViewTransitionNavigate());

    act(() => {
      result.current("/agenda");
    });

    currentPathname = "/agenda";
    rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
