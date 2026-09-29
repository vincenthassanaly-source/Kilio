import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementACreer } from "@/lib/saisie-ia/types";

vi.mock("@/app/actions/courses", () => ({ ajouterArticlesCourses: vi.fn(), getCoursesItems: vi.fn() }));
import { ajouterArticlesCourses } from "@/app/actions/courses";
import { moduleCourses } from "./saisie-module";

const ajouter = vi.mocked(ajouterArticlesCourses);
const course = (libelle: string) => ({ type: "course", donnees: { libelle, avertissements: [] } }) as ElementACreer;

beforeEach(() => vi.clearAllMocks());

describe("moduleCourses.creer", () => {
  it("envoie tous les libellés en un seul appel et signale les articles déjà présents", async () => {
    ajouter.mockResolvedValue({ crees: 1, reactives: 0, dejaPresents: ["lait"] });

    const issues = await moduleCourses.creer([course("Lait"), course("Œufs")]);

    expect(ajouter).toHaveBeenCalledTimes(1);
    expect(ajouter).toHaveBeenCalledWith(["Lait", "Œufs"]);
    expect(issues).toEqual([{ ok: true, avertissement: "« Lait » était déjà dans la liste." }, { ok: true }]);
  });

  it("laisse l'erreur remonter (l'action serveur échoue alors tout le lot du module)", async () => {
    ajouter.mockRejectedValue(new Error("Le libellé est requis."));
    await expect(moduleCourses.creer([course("")])).rejects.toThrow("Le libellé est requis.");
  });
});
