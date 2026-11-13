import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HabitudeForm } from "./HabitudeForm";

afterEach(cleanup);

vi.mock("@/app/actions/habitudes", () => ({
  creerHabitude: vi.fn(),
  modifierHabitude: vi.fn(),
}));

import { creerHabitude } from "@/app/actions/habitudes";

// Audit planification : après une erreur serveur, React 19 remettait les champs
// non contrôlés à zéro et la personne perdait ce qu'elle venait de saisir.
describe("HabitudeForm : saisie conservée après une erreur serveur", () => {
  it("garde le nom, l'unité et l'objectif quand le serveur refuse", async () => {
    const user = userEvent.setup();
    vi.mocked(creerHabitude).mockResolvedValue({ error: "L'objectif doit être un nombre positif." });

    render(<HabitudeForm />);

    await user.type(screen.getByLabelText("Nom"), "Boire de l'eau");
    await user.click(screen.getByRole("button", { name: "Quantifiée" }));
    await user.type(screen.getByLabelText("Unité"), "verres");
    await user.type(screen.getByLabelText("Objectif (optionnel)"), "0");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("L'objectif doit être un nombre positif.");
    await waitFor(() => expect(screen.getByLabelText("Nom")).toHaveValue("Boire de l'eau"));
    expect(screen.getByLabelText("Unité")).toHaveValue("verres");
    expect(screen.getByLabelText("Objectif (optionnel)")).toHaveValue(0);
  });
});
