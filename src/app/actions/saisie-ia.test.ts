import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleIAServeur } from "@/lib/saisie-ia/module";
import type { ElementACreer } from "@/lib/saisie-ia/types";

const creerTache = vi.fn();
const creerCourse = vi.fn();
const preparerTache = vi.fn();

vi.mock("@/lib/saisie-ia/registre", () => {
  const base = { libelle: "x", max: 5, schemaElement: {}, regles: [], casQuestion: [] };
  const modules: ModuleIAServeur[] = [
    { ...base, type: "tache", cle: "taches", preparer: (a) => preparerTache(a), creer: (e) => creerTache(e) },
    { ...base, type: "course", cle: "courses", preparer: async () => ({ lignesContexte: [], interpreter: () => [] }), creer: (e) => creerCourse(e) },
  ];
  return { MODULES_SERVEUR: modules };
});
const appelerGemini = vi.fn();
vi.mock("@/lib/saisie-ia/gemini", () => ({ appelerGeminiSaisie: (...args: unknown[]) => appelerGemini(...args) }));

import { analyserSaisie, creerElementsProposes } from "./saisie-ia";

const tache = (titre: string) => ({ type: "tache", donnees: { titre } }) as unknown as ElementACreer;
const course = (libelle: string) => ({ type: "course", donnees: { libelle } }) as unknown as ElementACreer;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  preparerTache.mockResolvedValue({ lignesContexte: [], interpreter: () => [] });
});

describe("creerElementsProposes", () => {
  it("répartit par module et rend un résultat par élément, indexé comme la requête", async () => {
    creerTache.mockResolvedValue([{ ok: true }, { ok: false, message: "Liste introuvable." }]);
    creerCourse.mockResolvedValue([{ ok: true, avertissement: "déjà là" }]);

    const r = await creerElementsProposes([tache("A"), course("Lait"), tache("B")]);

    expect(creerTache).toHaveBeenCalledWith([tache("A"), tache("B")]);
    expect(creerCourse).toHaveBeenCalledWith([course("Lait")]);
    expect(r).toEqual({
      ok: true,
      data: [
        { index: 0, ok: true },
        { index: 1, ok: true, avertissement: "déjà là" },
        { index: 2, ok: false, message: "Liste introuvable." },
      ],
    });
  });

  it("un module qui plante n'empêche pas les autres et échoue seulement ses éléments", async () => {
    creerTache.mockRejectedValue(new Error("base indisponible"));
    creerCourse.mockResolvedValue([{ ok: true }]);

    const r = await creerElementsProposes([tache("A"), course("Lait")]);

    expect(r).toEqual({
      ok: true,
      data: [
        { index: 0, ok: false, message: "La création a échoué. Réessaie." },
        { index: 1, ok: true },
      ],
    });
  });

  it("refuse un type inconnu (requête forgée) sans le confier à un module", async () => {
    creerCourse.mockResolvedValue([{ ok: true }]);
    const forge = { type: "virement", donnees: {} } as unknown as ElementACreer;

    const r = await creerElementsProposes([forge, course("Lait")]);

    expect(r).toEqual({
      ok: true,
      data: [
        { index: 0, ok: false, message: "Type d'élément inconnu." },
        { index: 1, ok: true },
      ],
    });
    expect(creerTache).not.toHaveBeenCalled();
  });

  it("refuse une requête vide ou trop grosse", async () => {
    expect(await creerElementsProposes([])).toMatchObject({ ok: false });
    expect(await creerElementsProposes(Array.from({ length: 21 }, (_, i) => course(`a${i}`)))).toMatchObject({ ok: false });
    expect(creerCourse).not.toHaveBeenCalled();
  });
});

describe("analyserSaisie", () => {
  it("refuse un texte vide, trop long ou des précisions invalides sans appeler Gemini", async () => {
    expect(await analyserSaisie("  ", [])).toMatchObject({ ok: false });
    expect(await analyserSaisie("x".repeat(501), [])).toMatchObject({ ok: false });
    expect(await analyserSaisie("x", [{ question: "q", reponse: "r" }, { question: "q", reponse: "r" }, { question: "q", reponse: "r" }])).toMatchObject({ ok: false });
    expect(appelerGemini).not.toHaveBeenCalled();
  });

  it("traduit le quota Gemini en message dédié", async () => {
    appelerGemini.mockResolvedValue({ ok: false, code: "quota", detail: "Gemini a répondu 429." });
    const r = await analyserSaisie("lait", []);
    expect(r).toMatchObject({ ok: true, data: { statut: "erreur", code: "quota", message: expect.stringContaining("quota gratuit de Gemini") } });
  });

  it("signale l'impossibilité de lire le contexte d'un module sans appeler Gemini", async () => {
    preparerTache.mockRejectedValue(new Error("lecture impossible"));
    const r = await analyserSaisie("lait", []);
    expect(r).toMatchObject({ ok: true, data: { statut: "erreur", code: "echec" } });
    expect(appelerGemini).not.toHaveBeenCalled();
  });

  it("rend « incompréhensible » quand Gemini ne propose rien", async () => {
    appelerGemini.mockResolvedValue({ ok: true, brut: { question: { texte: "", choix: [] }, taches: [], courses: [] } });
    const r = await analyserSaisie("bla", []);
    expect(r).toMatchObject({ ok: true, data: { statut: "erreur", code: "incomprehensible" } });
  });
});
