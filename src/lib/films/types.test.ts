import { describe, expect, it } from "vitest";
import { FILTRES_VIDES, formaterDuree, formaterNote, metaFilm, nettoyerFiltres, passeFiltres, type FilmListe } from "./types";

const film = (partiel: Partial<FilmListe> = {}): FilmListe => ({
  id: 1,
  titre: "Test",
  annee: 2015,
  affiche: null,
  note: 7.4,
  genreIds: [18, 53],
  resume: "",
  dureeMin: 112,
  dispo: null,
  ...partiel,
});

describe("formatage", () => {
  it("formate la durée", () => {
    expect(formaterDuree(112)).toBe("1 h 52");
    expect(formaterDuree(120)).toBe("2 h");
    expect(formaterDuree(45)).toBe("45 min");
    expect(formaterDuree(null)).toBeNull();
    expect(formaterDuree(0)).toBeNull();
  });

  it("formate la note avec une virgule", () => {
    expect(formaterNote(7.43)).toBe("7,4");
    expect(formaterNote(0)).toBeNull();
  });

  it("assemble la ligne de méta sans trous", () => {
    expect(metaFilm(film())).toBe("2015 · 1 h 52 · 7,4/10");
    expect(metaFilm(film({ annee: null, dureeMin: null, note: null }))).toBe("");
  });
});

describe("nettoyerFiltres", () => {
  it("ramène une entrée non fiable à des valeurs connues", () => {
    expect(nettoyerFiltres(null)).toEqual(FILTRES_VIDES);
    const f = nettoyerFiltres({ requete: "  alien  ", genre: -3, decennie: "1850", noteMin: 4, dureeMax: 120, mesPlateformes: "oui" });
    expect(f).toEqual({ ...FILTRES_VIDES, requete: "alien", dureeMax: 120 });
  });

  it("borne la longueur de la requête", () => {
    expect(nettoyerFiltres({ requete: "a".repeat(500) }).requete).toHaveLength(100);
  });
});

describe("passeFiltres", () => {
  it("sans filtre, tout passe", () => {
    expect(passeFiltres(film(), FILTRES_VIDES)).toBe(true);
  });

  it("filtre sur le genre, l'époque, la note et la durée", () => {
    expect(passeFiltres(film(), { ...FILTRES_VIDES, genre: 18 })).toBe(true);
    expect(passeFiltres(film(), { ...FILTRES_VIDES, genre: 35 })).toBe(false);
    expect(passeFiltres(film(), { ...FILTRES_VIDES, decennie: "2010" })).toBe(true);
    expect(passeFiltres(film(), { ...FILTRES_VIDES, decennie: "1990" })).toBe(false);
    expect(passeFiltres(film(), { ...FILTRES_VIDES, noteMin: 8 })).toBe(false);
    expect(passeFiltres(film(), { ...FILTRES_VIDES, dureeMax: 120 })).toBe(true);
    expect(passeFiltres(film(), { ...FILTRES_VIDES, dureeMax: 90 })).toBe(false);
  });

  it("écarte un film dont la donnée filtrée est inconnue", () => {
    expect(passeFiltres(film({ dureeMin: null }), { ...FILTRES_VIDES, dureeMax: 150 })).toBe(false);
    expect(passeFiltres(film({ note: null }), { ...FILTRES_VIDES, noteMin: 5 })).toBe(false);
    expect(passeFiltres(film({ annee: null }), { ...FILTRES_VIDES, decennie: "2010" })).toBe(false);
  });
});
