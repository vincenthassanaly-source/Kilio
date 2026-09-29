import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementACreer } from "@/lib/saisie-ia/types";

vi.mock("@/app/actions/journal", () => ({ addJournalEntry: vi.fn(), getCatalogueJournal: vi.fn() }));
import { addJournalEntry } from "@/app/actions/journal";
import { moduleRepas } from "./saisie-module";
import type { RepasACreer } from "./saisie-naturelle";

const ajouter = vi.mocked(addJournalEntry);
const repas = (surcharge: Partial<RepasACreer> = {}) =>
  ({
    type: "repas",
    donnees: {
      cible: { type: "aliment", id: "a-oeuf" },
      quantite: 120,
      moment: "petit_dej",
      date: "2026-10-01",
      ...surcharge,
    },
  }) as ElementACreer;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("moduleRepas.creer", () => {
  it("passe par addJournalEntry avec la quantité déjà convertie", async () => {
    ajouter.mockResolvedValue({ error: null, ok: true });

    expect(await moduleRepas.creer([repas()])).toEqual([{ ok: true }]);

    const formData = ajouter.mock.calls[0][1];
    expect(formData.get("type")).toBe("aliment");
    expect(formData.get("aliment_id")).toBe("a-oeuf");
    expect(formData.get("recette_id")).toBeNull();
    expect(formData.get("quantite")).toBe("120");
    expect(formData.get("saisie_mode")).toBe("grammes");
    expect(formData.get("moment")).toBe("petit_dej");
    expect(formData.get("date")).toBe("2026-10-01");
  });

  it("envoie une recette par son identifiant", async () => {
    ajouter.mockResolvedValue({ error: null, ok: true });
    await moduleRepas.creer([repas({ cible: { type: "recette", id: "r1" }, quantite: 1.5 })]);
    const formData = ajouter.mock.calls[0][1];
    expect(formData.get("recette_id")).toBe("r1");
    expect(formData.get("aliment_id")).toBeNull();
  });

  it("refuse sans appeler la base un repas sans aliment ou sans quantité", async () => {
    const issues = await moduleRepas.creer([repas({ cible: null }), repas({ quantite: null })]);

    expect(ajouter).not.toHaveBeenCalled();
    expect(issues).toEqual([
      { ok: false, message: "Aliment ou quantité à préciser : utilise « Modifier »." },
      { ok: false, message: "Aliment ou quantité à préciser : utilise « Modifier »." },
    ]);
  });

  it("rend l'erreur d'addJournalEntry pour le repas concerné sans arrêter les suivants", async () => {
    ajouter.mockResolvedValueOnce({ error: "Moment du repas invalide." }).mockResolvedValueOnce({ error: null, ok: true });
    expect(await moduleRepas.creer([repas({ moment: "brunch" as never }), repas()])).toEqual([
      { ok: false, message: "Moment du repas invalide." },
      { ok: true },
    ]);
  });

  it("attrape une exception inattendue", async () => {
    ajouter.mockRejectedValue(new Error("boom"));
    expect(await moduleRepas.creer([repas()])).toEqual([{ ok: false, message: "Le repas n'a pas pu être ajouté. Réessaie." }]);
  });
});
