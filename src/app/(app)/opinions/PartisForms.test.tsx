import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PartiFormModal, ProgrammeFormModal } from "./PartisForms";

vi.mock("@/app/actions/opinions-partis", () => ({
  creerParti: vi.fn(),
  modifierParti: vi.fn(),
  creerProgramme: vi.fn(),
  modifierProgramme: vi.fn(),
  creerProposition: vi.fn(),
  modifierProposition: vi.fn(),
}));

afterEach(cleanup);

const handlers = { onClose: vi.fn(), onSaved: vi.fn() };

// Charte du GLOSSARY : « Nouveau X » pour le titre d'un formulaire de création,
// « Ajouter » pour le valider ; « Modifier X » et « Enregistrer » en modification.
describe("formulaires de partis : charte des libellés", () => {
  it("création d'un parti : titre « Nouveau parti » et bouton « Ajouter »", () => {
    render(<PartiFormModal {...handlers} />);
    expect(screen.getByRole("dialog", { name: "Nouveau parti" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  });

  it("modification d'un parti : titre « Modifier le parti » et bouton « Enregistrer »", () => {
    render(<PartiFormModal {...handlers} parti={{ id: "p1", nom: "Parti test", sigle: "PT", couleur: "bleu" } as never} />);
    expect(screen.getByRole("dialog", { name: "Modifier le parti" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ajouter" })).toBeNull();
  });

  it("création d'un programme : titre « Nouveau programme » et bouton « Ajouter »", () => {
    render(<ProgrammeFormModal {...handlers} partiId="p1" />);
    expect(screen.getByRole("dialog", { name: "Nouveau programme" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeTruthy();
  });
});
