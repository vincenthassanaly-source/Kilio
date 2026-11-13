import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";

vi.mock("@/app/actions/taches", () => ({ deleteListe: vi.fn(), reordonnerListes: vi.fn(), deleteTag: vi.fn() }));
vi.mock("./AddListeForm", () => ({ AddListeForm: () => <p>Formulaire</p> }));
vi.mock("./AddTagForm", () => ({ AddTagForm: () => <p>Formulaire</p> }));

import { deleteListe, deleteTag } from "@/app/actions/taches";
import { ListesManager } from "./ListesManager";
import { TagsManager } from "./TagsManager";

const LISTES = [
  { id: "l1", nom: "Général", couleur: null },
  { id: "l2", nom: "Maison", couleur: null },
] as never;
const COMPTES = { l1: { total: 1, faites: 0 }, l2: { total: 3, faites: 1 } };
const TAGS = [{ id: "t1", nom: "urgent", couleur: null }] as never;

function monter(ui: React.ReactElement) {
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("liste-taches", "l2");
  reafficherElement("tag", "t1");
  vi.clearAllMocks();
});

function supprimerListeMaison() {
  vi.mocked(deleteListe).mockResolvedValue({ error: null });
  monter(<ListesManager listes={LISTES} comptes={COMPTES} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[1]);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer la liste" }));
}

describe("ListesManager : suppression avec annulation différée", () => {
  it("retire la liste tout de suite, sans confirmation ni appel serveur, et annonce les tâches emportées", () => {
    supprimerListeMaison();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Maison")).not.toBeInTheDocument();
    expect(deleteListe).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Liste « Maison » supprimée avec ses 3 tâches");
  });

  it("« Annuler » ramène la liste sans appel serveur", async () => {
    supprimerListeMaison();
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByText("Maison")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(deleteListe).not.toHaveBeenCalled();
  });

  it("supprime la liste après le délai, avec le total de tâches vu par la personne", async () => {
    supprimerListeMaison();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(deleteListe).toHaveBeenCalledWith("l2", true, 3);
  });

  it("si le contenu a changé entre-temps, rien n'est supprimé : la liste revient avec un message", async () => {
    vi.mocked(deleteListe).mockResolvedValue({ error: null, confirmation: { total: 4, faites: 1 } });
    monter(<ListesManager listes={LISTES} comptes={COMPTES} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la liste" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(screen.getByText("Maison")).toBeInTheDocument();
    expect(getToasts().some((t) => t.tone === "error" && /rien n'a été supprimé/.test(t.text))).toBe(true);
  });
});

describe("TagsManager : suppression avec annulation différée", () => {
  function supprimerTag() {
    vi.mocked(deleteTag).mockResolvedValue(undefined);
    monter(<TagsManager tags={TAGS} />);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
  }

  it("retire le tag tout de suite, sans confirmation ni appel serveur", () => {
    supprimerTag();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("#urgent")).not.toBeInTheDocument();
    expect(deleteTag).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Tag « #urgent » supprimé");
  });

  it("« Annuler » ramène le tag sans appel serveur", async () => {
    supprimerTag();
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByText("#urgent")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(deleteTag).not.toHaveBeenCalled();
  });

  it("supprime le tag après le délai", async () => {
    supprimerTag();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(deleteTag).toHaveBeenCalledWith("t1");
  });
});
