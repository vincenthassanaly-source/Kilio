import { describe, expect, it } from "vitest";
import { formatHeureHHMM, getBlocInterval, layoutChevauchements } from "./compute";

describe("getBlocInterval", () => {
  it("renvoie les bornes en minutes depuis minuit", () => {
    expect(getBlocInterval({ heure: "09:00", heure_fin: "10:30" })).toEqual({ start: 540, end: 630 });
  });

  it("dure 30 min sans heure de fin ou avec une fin incohérente", () => {
    expect(getBlocInterval({ heure: "09:00", heure_fin: null })).toEqual({ start: 540, end: 570 });
    expect(getBlocInterval({ heure: "09:00", heure_fin: "09:00" })).toEqual({ start: 540, end: 570 });
    expect(getBlocInterval({ heure: "09:00", heure_fin: "08:00" })).toEqual({ start: 540, end: 570 });
  });

  it("renvoie null sans heure de début valide", () => {
    expect(getBlocInterval({ heure: null, heure_fin: "10:00" })).toBeNull();
    expect(getBlocInterval({ heure: "abc", heure_fin: null })).toBeNull();
  });
});

describe("formatHeureHHMM", () => {
  it("formate avec zéros de remplissage", () => {
    expect(formatHeureHHMM(0)).toBe("00:00");
    expect(formatHeureHHMM(65)).toBe("01:05");
    expect(formatHeureHHMM(23 * 60 + 59)).toBe("23:59");
  });
});

describe("layoutChevauchements", () => {
  const bloc = (id: string, heure: string | null, heure_fin: string | null) => ({ id, heure, heure_fin });

  it("donne une colonne unique à un bloc isolé", () => {
    const res = layoutChevauchements([bloc("a", "09:00", "10:00")]);
    expect(res.get("a")).toEqual({ colonne: 0, nbColonnes: 1 });
  });

  it("ne partage pas de colonne entre blocs qui se touchent seulement", () => {
    const res = layoutChevauchements([bloc("a", "09:00", "10:00"), bloc("b", "10:00", "11:00")]);
    expect(res.get("a")).toEqual({ colonne: 0, nbColonnes: 1 });
    expect(res.get("b")).toEqual({ colonne: 0, nbColonnes: 1 });
  });

  it("place deux blocs qui se chevauchent côte à côte", () => {
    const res = layoutChevauchements([bloc("a", "09:00", "10:30"), bloc("b", "10:00", "11:00")]);
    expect(res.get("a")).toEqual({ colonne: 0, nbColonnes: 2 });
    expect(res.get("b")).toEqual({ colonne: 1, nbColonnes: 2 });
  });

  it("réutilise la colonne libérée dans une chaîne A-B-C", () => {
    const res = layoutChevauchements([
      bloc("a", "09:00", "10:00"),
      bloc("b", "09:30", "11:00"),
      bloc("c", "10:00", "11:30"),
    ]);
    expect(res.get("a")).toEqual({ colonne: 0, nbColonnes: 2 });
    expect(res.get("b")).toEqual({ colonne: 1, nbColonnes: 2 });
    expect(res.get("c")).toEqual({ colonne: 0, nbColonnes: 2 });
  });

  it("calcule nbColonnes par groupe, pas globalement", () => {
    const res = layoutChevauchements([
      bloc("a", "09:00", "10:00"),
      bloc("b", "09:00", "10:00"),
      bloc("c", "14:00", "15:00"),
    ]);
    expect(res.get("a")?.nbColonnes).toBe(2);
    expect(res.get("c")).toEqual({ colonne: 0, nbColonnes: 1 });
  });

  it("ignore les blocs sans heure de début et ne dépend pas de l'ordre d'entrée", () => {
    const res = layoutChevauchements([
      bloc("sans", null, null),
      bloc("b", "10:00", "11:00"),
      bloc("a", "09:30", "10:30"),
    ]);
    expect(res.has("sans")).toBe(false);
    expect(res.get("a")).toEqual({ colonne: 0, nbColonnes: 2 });
    expect(res.get("b")).toEqual({ colonne: 1, nbColonnes: 2 });
  });
});
