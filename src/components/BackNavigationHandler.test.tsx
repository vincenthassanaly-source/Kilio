import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackNavigationHandler } from "./BackNavigationHandler";

const push = vi.fn();
const replace = vi.fn();
let pathnameMock = "/";
const showToast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathnameMock,
}));
vi.mock("@/lib/navigation/NavigationEditContext", () => ({
  useNavigationEdit: () => ({ modulesBarreBasse: ["/", "/nutrition", "/taches", "/habitudes"] }),
}));
vi.mock("@/components/toast/toast-store", () => ({ showToast: (...a: unknown[]) => showToast(...a) }));

// Simule l'arrivée du navigateur sur une entrée (URL + state), puis émet popstate.
function retourVers(url: string, state: unknown) {
  window.history.replaceState(state, "", url);
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

describe("BackNavigationHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    replace.mockClear();
    showToast.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("sur l'accueil, le retour vers la garde affiche le toast « Appuie encore pour quitter »", () => {
    pathnameMock = "/";
    render(<BackNavigationHandler />);
    retourVers("/", { kilioGarde: true });
    expect(showToast).toHaveBeenCalledWith("Appuie encore pour quitter", 2000);
    expect(push).not.toHaveBeenCalled();
  });

  it("sur l'accueil, restaure l'entrée au-dessus de la garde après le délai", () => {
    pathnameMock = "/";
    render(<BackNavigationHandler />);
    retourVers("/", { kilioGarde: true });
    const longueur = window.history.length;
    vi.advanceTimersByTime(2000);
    expect(window.history.length).toBe(longueur + 1);
    expect((window.history.state as { kilioGarde?: boolean } | null)?.kilioGarde).toBeFalsy();
  });

  it("ne bloque pas la fermeture d'une couche pendant l'attente du second retour", () => {
    pathnameMock = "/";
    render(<BackNavigationHandler />);
    retourVers("/", { kilioGarde: true });
    showToast.mockClear();
    const evenement = new PopStateEvent("popstate", { state: { kilioGarde: true }, cancelable: true });
    const autre = vi.fn();
    window.addEventListener("popstate", autre);
    window.dispatchEvent(evenement);
    window.removeEventListener("popstate", autre);
    expect(autre).toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("sur la garde depuis un module non épinglé, mène à la grille Plus", () => {
    pathnameMock = "/budget";
    render(<BackNavigationHandler />);
    retourVers("/budget", { kilioGarde: true });
    expect(push).toHaveBeenCalledWith("/plus");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("remplace une entrée précédente qui n'est pas le parent logique", () => {
    pathnameMock = "/nutrition/recettes/abc";
    render(<BackNavigationHandler />);
    retourVers("/", {});
    expect(replace).toHaveBeenCalledWith("/nutrition/recettes");
  });

  it("laisse Next gérer un retour vers le parent logique", () => {
    pathnameMock = "/nutrition/recettes/abc";
    render(<BackNavigationHandler />);
    retourVers("/nutrition/recettes", {});
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("ne touche pas aux couches sur la même URL (modale, mode édition)", () => {
    pathnameMock = "/budget/comptes";
    render(<BackNavigationHandler />);
    retourVers("/budget/comptes", { backCloseToken: "x" });
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
