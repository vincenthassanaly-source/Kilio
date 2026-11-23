import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));
vi.mock("@/components/BackLink", () => ({ BackLink: () => null }));
vi.mock("@/app/actions/verrou", () => ({
  etatVerrou: vi.fn(),
  optionsConnexion: vi.fn(),
  optionsInscription: vi.fn(),
  prolongerSession: vi.fn(),
  verifierConnexion: vi.fn(),
  verifierInscription: vi.fn(),
}));

import { startAuthentication } from "@simplewebauthn/browser";
import { etatVerrou, optionsConnexion, verifierConnexion } from "@/app/actions/verrou";
import { VerrouGate } from "./VerrouGate";

const ferme = { ok: true, data: { ouvert: false, configure: true, inscrit: true, inscriptionOuverte: false } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(etatVerrou).mockResolvedValue(ferme as never);
  vi.mocked(optionsConnexion).mockResolvedValue({ ok: true, data: {} } as never);
});
afterEach(cleanup);

describe("VerrouGate", () => {
  it("lance la lecture biométrique dès l'ouverture et ouvre le Journal", async () => {
    vi.mocked(startAuthentication).mockResolvedValue({} as never);
    vi.mocked(verifierConnexion).mockResolvedValue({ ok: true, data: undefined } as never);
    render(<VerrouGate>contenu du journal</VerrouGate>);
    expect(await screen.findByText("contenu du journal")).toBeInTheDocument();
    expect(startAuthentication).toHaveBeenCalledTimes(1);
  });

  it("garde le bouton en repli, sans message d'échec, si la lecture automatique est refusée", async () => {
    const refus = Object.assign(new Error("geste requis"), { name: "NotAllowedError" });
    vi.mocked(startAuthentication).mockRejectedValue(refus);
    render(<VerrouGate>contenu du journal</VerrouGate>);
    const bouton = await screen.findByRole("button", { name: "Déverrouiller" });
    await waitFor(() => expect(bouton).toBeEnabled());
    expect(startAuthentication).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toBe("");
  });
});
