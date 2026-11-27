import { describe, expect, it } from "vitest";
import { parseDisponibilite, parseFiche, parseFilm, parseListeFournisseurs, parsePageFilms } from "./parse";

describe("parseFilm", () => {
  it("lit un résultat TMDB", () => {
    expect(
      parseFilm({ id: 603, title: "Matrix", release_date: "1999-03-30", poster_path: "/a.jpg", vote_average: 8.2, genre_ids: [28, 878], overview: "Neo." })
    ).toEqual({ id: 603, titre: "Matrix", annee: 1999, affiche: "/a.jpg", note: 8.2, genreIds: [28, 878], resume: "Neo." });
  });

  it("rejette ce qui n'est pas un film exploitable", () => {
    expect(parseFilm(null)).toBeNull();
    expect(parseFilm({ id: "x", title: "A" })).toBeNull();
    expect(parseFilm({ id: 1, title: "  " })).toBeNull();
  });

  it("ignore une affiche ou une note invalide", () => {
    const f = parseFilm({ id: 1, title: "A", poster_path: "http://evil/x.jpg", vote_average: 0 });
    expect(f?.affiche).toBeNull();
    expect(f?.note).toBeNull();
  });
});

describe("parseDisponibilite", () => {
  it("ne lit que la région France", () => {
    const d = parseDisponibilite({
      results: {
        FR: { link: "https://www.themoviedb.org/movie/1/watch?locale=FR", flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" }], rent: [{ provider_id: 2, provider_name: "Apple TV" }] },
        US: { flatrate: [{ provider_id: 9, provider_name: "Prime Video" }] },
      },
    });
    expect(d.abonnement.map((f) => f.nom)).toEqual(["Netflix"]);
    expect(d.location.map((f) => f.nom)).toEqual(["Apple TV"]);
    expect(d.achat).toEqual([]);
    expect(d.lien).toContain("themoviedb.org");
  });

  it("renvoie des listes vides quand le film n'a aucune offre française", () => {
    expect(parseDisponibilite({ results: { US: {} } })).toEqual({ abonnement: [], location: [], achat: [], lien: null });
    expect(parseDisponibilite(undefined).abonnement).toEqual([]);
  });

  it("retire les doublons et refuse un lien non https", () => {
    const d = parseDisponibilite({
      results: { FR: { link: "javascript:alert(1)", flatrate: [{ provider_id: 8, provider_name: "Netflix" }, { provider_id: 8, provider_name: "Netflix" }] } },
    });
    expect(d.abonnement).toHaveLength(1);
    expect(d.lien).toBeNull();
  });
});

describe("parseFiche", () => {
  it("assemble la fiche avec durée, genres et plateformes", () => {
    const f = parseFiche({
      id: 1,
      title: "A",
      release_date: "2010-01-01",
      runtime: 95,
      tagline: "Une accroche",
      genres: [{ id: 18, name: "Drame" }],
      "watch/providers": { results: { FR: { flatrate: [{ provider_id: 8, provider_name: "Netflix" }] } } },
    });
    expect(f?.dureeMin).toBe(95);
    expect(f?.genres).toEqual(["Drame"]);
    expect(f?.genreIds).toEqual([18]);
    expect(f?.dispo?.abonnement).toHaveLength(1);
    expect(f?.dateSortie).toBe("2010-01-01");
  });

  it("garde une durée nulle quand TMDB renvoie 0", () => {
    expect(parseFiche({ id: 1, title: "A", runtime: 0 })?.dureeMin).toBeNull();
  });
});

describe("listes", () => {
  it("trie les fournisseurs par priorité d'affichage en France", () => {
    const l = parseListeFournisseurs({
      results: [
        { provider_id: 2, provider_name: "Z", display_priorities: { FR: 5 } },
        { provider_id: 1, provider_name: "A", display_priorities: { FR: 1 } },
        { provider_id: 3, provider_name: "B" },
      ],
    });
    expect(l.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("plafonne la pagination à 500 pages", () => {
    expect(parsePageFilms({ results: [], page: 1, total_pages: 9999 }).totalPages).toBe(500);
    expect(parsePageFilms(undefined)).toEqual({ films: [], page: 1, totalPages: 1 });
  });
});
