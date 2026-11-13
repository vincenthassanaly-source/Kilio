import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnregistrerDansDocuments } from "./EnregistrerDansDocuments";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const preparerUploadsVrac = vi.fn();
const enregistrerDocumentsVrac = vi.fn();
vi.mock("@/app/actions/documents-vrac", () => ({
  preparerUploadsVrac: (...args: unknown[]) => preparerUploadsVrac(...args),
  enregistrerDocumentsVrac: (...args: unknown[]) => enregistrerDocumentsVrac(...args),
}));

const televerserVersUrlSignee = vi.fn();
vi.mock("@/lib/documents/televersement", () => ({
  televerserVersUrlSignee: (...args: unknown[]) => televerserVersUrlSignee(...args),
}));

const showActionToast = vi.fn();
vi.mock("@/components/toast/toast-store", () => ({
  showActionToast: (...args: unknown[]) => showActionToast(...args),
  showErrorToast: vi.fn(),
}));

const PATH = "11111111-1111-4111-8111-111111111111.pdf";
const NOM = "Scan du 13 novembre 2026.pdf";

function pdf() {
  return new File([new Uint8Array([37, 80, 68, 70])], NOM, { type: "application/pdf" });
}

function definirConnexion(enLigne: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(enLigne);
}

beforeEach(() => {
  definirConnexion(true);
  preparerUploadsVrac.mockResolvedValue({ ok: true, data: [{ path: PATH, signedUrl: "https://stockage.test/signe", publicUrl: "https://stockage.test/p" }] });
  televerserVersUrlSignee.mockResolvedValue(undefined);
  enregistrerDocumentsVrac.mockResolvedValue({ ok: true, data: { crees: 1 } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("EnregistrerDansDocuments", () => {
  it("prépare, téléverse puis enregistre avec les bons arguments, et propose « Voir dans Documents »", async () => {
    const fichier = pdf();
    render(<EnregistrerDansDocuments fichier={fichier} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer dans Documents" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Enregistré dans Documents" })).toBeTruthy());
    expect(preparerUploadsVrac).toHaveBeenCalledWith(["pdf"]);
    expect(televerserVersUrlSignee).toHaveBeenCalledWith("https://stockage.test/signe", fichier, "application/pdf");
    expect(enregistrerDocumentsVrac).toHaveBeenCalledWith([{ path: PATH, nomOriginal: NOM }]);

    expect(showActionToast).toHaveBeenCalledTimes(1);
    const [texte, options] = showActionToast.mock.calls[0];
    expect(texte).toBe("Scan enregistré dans Documents");
    expect(options.label).toBe("Voir dans Documents");
    options.onAction();
    expect(push).toHaveBeenCalledWith("/documents?vrac=1");

    fireEvent.click(screen.getByRole("button", { name: "Voir dans Documents" }));
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("désactive le bouton pendant l'envoi", async () => {
    let terminer: (v: unknown) => void = () => {};
    preparerUploadsVrac.mockReturnValue(new Promise((resolve) => (terminer = resolve)));
    render(<EnregistrerDansDocuments fichier={pdf()} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer dans Documents" }));

    const bouton = await screen.findByRole("button", { name: "Envoi vers Documents…" });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      terminer({ ok: false, error: "Fin." });
    });
  });

  it("affiche l'erreur de préparation sans téléverser", async () => {
    preparerUploadsVrac.mockResolvedValue({ ok: false, error: "L'envoi n'a pas pu être préparé. Réessaie." });
    render(<EnregistrerDansDocuments fichier={pdf()} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer dans Documents" }));

    expect((await screen.findByRole("alert")).textContent).toContain("préparé");
    expect(televerserVersUrlSignee).not.toHaveBeenCalled();
    expect(enregistrerDocumentsVrac).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Réessayer l'envoi vers Documents" })).toBeTruthy();
  });

  it("affiche l'erreur du téléversement sans enregistrer, et permet de réessayer", async () => {
    televerserVersUrlSignee.mockRejectedValueOnce(new Error("Pas de connexion : le fichier n'a pas pu être envoyé."));
    render(<EnregistrerDansDocuments fichier={pdf()} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer dans Documents" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Pas de connexion");
    expect(enregistrerDocumentsVrac).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer l'envoi vers Documents" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enregistré dans Documents" })).toBeTruthy());
    expect(enregistrerDocumentsVrac).toHaveBeenCalledTimes(1);
  });

  it("affiche l'erreur de l'enregistrement", async () => {
    enregistrerDocumentsVrac.mockResolvedValue({ ok: false, error: "Les documents n'ont pas pu être enregistrés. Réessaie." });
    render(<EnregistrerDansDocuments fichier={pdf()} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer dans Documents" }));

    expect((await screen.findByRole("alert")).textContent).toContain("enregistrés");
    expect(showActionToast).not.toHaveBeenCalled();
  });

  it("grise le bouton hors connexion et explique pourquoi", () => {
    definirConnexion(false);
    render(<EnregistrerDansDocuments fichier={pdf()} />);

    const bouton = screen.getByRole("button", { name: "Enregistrer dans Documents" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    expect(screen.getByText(/Hors connexion : Partager et Télécharger restent disponibles/)).toBeTruthy();
    fireEvent.click(bouton);
    expect(preparerUploadsVrac).not.toHaveBeenCalled();
  });

  it("repart de zéro quand un nouveau PDF est généré", async () => {
    const { rerender } = render(<EnregistrerDansDocuments fichier={pdf()} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer dans Documents" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enregistré dans Documents" })).toBeTruthy());

    rerender(<EnregistrerDansDocuments fichier={pdf()} />);
    expect(screen.getByRole("button", { name: "Enregistrer dans Documents" })).toBeTruthy();
  });
});
