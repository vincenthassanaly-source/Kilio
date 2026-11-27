import { describe, expect, it } from "vitest";
import { composerSections, criteresSuggestion, debutSortiesRecentes } from "./suggestions";

describe("debutSortiesRecentes", () => {
  it("remonte au premier jour du même mois, un an plus tôt", () => {
    expect(debutSortiesRecentes(new Date("2026-11-27T10:00:00Z"))).toBe("2025-11-01");
    expect(debutSortiesRecentes(new Date("2026-01-03T00:00:00Z"))).toBe("2025-01-01");
  });
});

describe("criteresSuggestion", () => {
  const maintenant = new Date("2026-11-27T10:00:00Z");

  it("ne garde que l'abonnement sur les plateformes choisies, triées", () => {
    const p = new URLSearchParams(criteresSuggestion("populaires", [337, 8], maintenant));
    expect(p.get("with_watch_providers")).toBe("8|337");
    expect(p.get("with_watch_monetization_types")).toBe("flatrate");
    expect(p.get("watch_region")).toBe("FR");
    expect(p.get("primary_release_date.gte")).toBeNull();
  });

  it("donne la même clé de cache quel que soit l'ordre des plateformes", () => {
    expect(criteresSuggestion("recents", [337, 8], maintenant)).toBe(criteresSuggestion("recents", [8, 337], maintenant));
  });

  it("borne les sorties récentes à l'année écoulée, avec un plancher de votes plus bas", () => {
    const p = new URLSearchParams(criteresSuggestion("recents", [8], maintenant));
    expect(p.get("primary_release_date.gte")).toBe("2025-11-01");
    expect(Number(p.get("vote_count.gte"))).toBeLessThan(150);
  });
});

describe("composerSections", () => {
  const film = (id: number) => ({ id });

  it("retire les films exclus et ceux déjà proposés plus haut", () => {
    const r = composerSections(
      [
        { id: "populaires", films: [film(1), film(2), film(3)] },
        { id: "recents", films: [film(2), film(4)] },
      ],
      new Set([3])
    );
    expect(r).toEqual([
      { id: "populaires", films: [film(1), film(2)] },
      { id: "recents", films: [film(4)] },
    ]);
  });

  it("tronque chaque rangée", () => {
    const r = composerSections([{ id: "populaires", films: [1, 2, 3, 4, 5].map(film) }], new Set(), 3);
    expect(r[0].films.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("écarte une rangée devenue vide", () => {
    const r = composerSections(
      [
        { id: "populaires", films: [film(1)] },
        { id: "recents", films: [film(1)] },
      ],
      new Set()
    );
    expect(r.map((s) => s.id)).toEqual(["populaires"]);
  });
});
