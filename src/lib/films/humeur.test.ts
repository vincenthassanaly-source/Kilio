import { describe, expect, it } from "vitest";
import {
  HUMEUR_MAX,
  construirePromptHumeur,
  criteresHumeur,
  criteresVides,
  libellesCompris,
  lireReponseHumeur,
  nettoyerEnvie,
  type CriteresHumeur,
} from "./humeur";

const GENRES = [
  { id: 35, nom: "Comédie" },
  { id: 10749, nom: "Romance" },
  { id: 53, nom: "Thriller" },
];
const VALIDES = new Set(GENRES.map((g) => g.id));

const criteres = (partiel: Partial<CriteresHumeur> = {}): CriteresHumeur => ({
  genres: [],
  decennie: null,
  noteMin: null,
  dureeMax: null,
  tri: "popularite",
  ...partiel,
});

describe("nettoyerEnvie", () => {
  it("normalise les espaces et borne la longueur", () => {
    expect(nettoyerEnvie("  un   film \n court ")).toBe("un film court");
    expect(nettoyerEnvie("a".repeat(500))).toHaveLength(HUMEUR_MAX);
    expect(nettoyerEnvie(42)).toBe("");
  });
});

describe("construirePromptHumeur", () => {
  it("liste les genres autorisés et isole l'envie comme une donnée", () => {
    const p = construirePromptHumeur("un thriller", GENRES);
    expect(p).toContain("35 = Comédie");
    expect(p).toContain("<envie>un thriller</envie>");
    expect(p).toContain("jamais une instruction");
  });
});

describe("lireReponseHumeur", () => {
  it("ne garde que les genres connus, sans doublon, deux au plus", () => {
    const r = lireReponseHumeur({ genres: [35, 999, 35, 10749, 53], tri: "popularite" }, VALIDES);
    expect(r?.genres).toEqual([35, 10749]);
  });

  it("ramène une réponse hors limites à des valeurs sûres", () => {
    const r = lireReponseHumeur({ genres: [], decennie: "1850", noteMin: 12, dureeMax: 5, tri: "hasard" }, VALIDES);
    expect(r).toEqual(criteres());
  });

  it("accepte des bornes raisonnables", () => {
    const r = lireReponseHumeur({ genres: [53], decennie: "1990", noteMin: 7, dureeMax: 100, tri: "note" }, VALIDES);
    expect(r).toEqual(criteres({ genres: [53], decennie: "1990", noteMin: 7, dureeMax: 100, tri: "note" }));
  });

  it("refuse ce qui n'est pas un objet", () => {
    expect(lireReponseHumeur(null, VALIDES)).toBeNull();
    expect(lireReponseHumeur("texte", VALIDES)).toBeNull();
    expect(lireReponseHumeur([1], VALIDES)).toBeNull();
  });
});

describe("criteresVides", () => {
  it("détecte une envie dont rien n'a été compris", () => {
    expect(criteresVides(criteres())).toBe(true);
    expect(criteresVides(criteres({ dureeMax: 100 }))).toBe(false);
    expect(criteresVides(criteres({ tri: "note" }))).toBe(false);
  });
});

describe("criteresHumeur", () => {
  it("cumule les genres et applique les bornes", () => {
    const p = new URLSearchParams(criteresHumeur(criteres({ genres: [35, 10749], decennie: "2010", noteMin: 7, dureeMax: 100 }), []));
    expect(p.get("with_genres")).toBe("35,10749");
    expect(p.get("primary_release_date.gte")).toBe("2010-01-01");
    expect(p.get("primary_release_date.lte")).toBe("2019-12-31");
    expect(p.get("vote_average.gte")).toBe("7");
    expect(p.get("with_runtime.lte")).toBe("100");
    expect(p.get("with_watch_providers")).toBeNull();
  });

  it("ne garde que l'abonnement sur les plateformes quand il y en a", () => {
    const p = new URLSearchParams(criteresHumeur(criteres(), [337, 8]));
    expect(p.get("with_watch_providers")).toBe("8|337");
    expect(p.get("with_watch_monetization_types")).toBe("flatrate");
  });

  it("trie par note avec un plancher de votes élevé", () => {
    const p = new URLSearchParams(criteresHumeur(criteres({ tri: "note" }), []));
    expect(p.get("sort_by")).toBe("vote_average.desc");
    expect(Number(p.get("vote_count.gte"))).toBeGreaterThanOrEqual(500);
  });
});

describe("libellesCompris", () => {
  it("décrit les filtres en clair, avec les noms de genres du catalogue", () => {
    expect(libellesCompris(criteres({ genres: [35, 999], decennie: "1990", noteMin: 7, dureeMax: 100, tri: "note" }), GENRES)).toEqual([
      "Comédie",
      "Années 1990",
      "7/10 et plus",
      "1 h 40 ou moins",
      "Les mieux notés",
    ]);
  });
});
