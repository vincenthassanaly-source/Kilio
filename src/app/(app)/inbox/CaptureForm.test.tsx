import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CaptureForm } from "./CaptureForm";

vi.mock("@/app/actions/inbox", () => ({ addInboxItem: vi.fn() }));
import { addInboxItem } from "@/app/actions/inbox";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function monter(onCaptured = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CaptureForm onCaptured={onCaptured} />
    </QueryClientProvider>
  );
  return { onCaptured };
}

describe("CaptureForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse une capture vide sans appeler le serveur", async () => {
    monter();
    await userEvent.click(screen.getByRole("button", { name: "Capturer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Écris quelque chose à capturer.");
    expect(addInboxItem).not.toHaveBeenCalled();
  });

  it("enregistre, vide le champ et reste ouvert pour enchaîner", async () => {
    vi.mocked(addInboxItem).mockResolvedValue({ ok: true, data: { id: "i1" } });
    const { onCaptured } = monter();
    const champ = screen.getByLabelText(/Idée, tâche/) as HTMLTextAreaElement;
    await userEvent.type(champ, "Réserver le dentiste");
    await userEvent.click(screen.getByRole("button", { name: "Capturer" }));
    await waitFor(() => expect(addInboxItem).toHaveBeenCalledWith("Réserver le dentiste"));
    await waitFor(() => expect(champ.value).toBe(""));
    expect(onCaptured).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("Réserver le dentiste");
  });

  it("Entrée envoie, Maj+Entrée ajoute une ligne", async () => {
    vi.mocked(addInboxItem).mockResolvedValue({ ok: true, data: { id: "i1" } });
    monter();
    const champ = screen.getByLabelText(/Idée, tâche/) as HTMLTextAreaElement;
    await userEvent.type(champ, "Ligne 1{Shift>}{Enter}{/Shift}Ligne 2{Enter}");
    await waitFor(() => expect(addInboxItem).toHaveBeenCalledWith("Ligne 1\nLigne 2"));
  });

  it("garde la saisie et affiche l'erreur du serveur", async () => {
    vi.mocked(addInboxItem).mockResolvedValue({ ok: false, error: "Capture trop longue." });
    monter();
    const champ = screen.getByLabelText(/Idée, tâche/) as HTMLTextAreaElement;
    await userEvent.type(champ, "Texte");
    await userEvent.click(screen.getByRole("button", { name: "Capturer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Capture trop longue.");
    expect(champ.value).toBe("Texte");
  });

  it("écran tactile : Entrée ajoute une ligne au lieu d'envoyer", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)", media: query }));
    monter();
    const champ = screen.getByLabelText(/Idée, tâche/) as HTMLTextAreaElement;
    await userEvent.type(champ, "Titre{Enter}Détail");
    expect(addInboxItem).not.toHaveBeenCalled();
    expect(champ.value).toBe("Titre\nDétail");
  });
});
