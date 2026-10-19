import { describe, expect, it } from "vitest";
import {
  calculerProximite,
  classerPartis,
  colonnesDepuisScores,
  compterLues,
  explicationDepuisColonnes,
  filtrerSuivi,
  formaterMoyenne,
  moyennesParAxe,
  nettoyerParti,
  nettoyerProgramme,
  nettoyerProposition,
  placerMarqueurs,
  programmeRecent,
  scoresDepuisColonnes,
  type PartiComplet,
  type ProgrammeParti,
  type PropositionParti,
} from "./partis";
import type { IdeePourProfil } from "./profil";
import { scoresVides, type Scores, type Theme } from "./types";

function scores(surcharge: Partial<Scores>): Scores {
  return { ...scoresVides(), ...surcharge };
}

function idee(theme: Theme, s: Partial<Scores>, surcharge: Partial<IdeePourProfil> = {}): IdeePourProfil {
  return { id: `${theme}-${JSON.stringify(s)}`, position: "x", statut: "validee", theme, conviction: "plutot", scores: scores(s), ...surcharge };
}

function proposition(theme: Theme, s: Partial<Scores>): PropositionParti {
  return { id: `${theme}-${JSON.stringify(s)}`, position: "p", theme, scores: scores(s), termes: [], explication: null, lu: false, favori: false };
}

function programme(id: string, date: string | null, createdAt: string, propositions: PropositionParti[] = []): ProgrammeParti {
  return { id, echeance: id, date_programme: date, created_at: createdAt, propositions };
}

describe("explicationDepuisColonnes", () => {
  it("vaut null quand rien n'est écrit (colonnes vides, absentes ou nulles)", () => {
    expect(explicationDepuisColonnes({})).toBeNull();
    expect(explicationDepuisColonnes({ explication_concret: "", explication_pour: " ", explication_contre: null })).toBeNull();
  });

  it("garde une explication partielle et nettoie les espaces", () => {
    expect(explicationDepuisColonnes({ explication_concret: " Elle change X. ", explication_pour: "", explication_contre: "Contre." })).toEqual({
      concret: "Elle change X.",
      pour: "",
      contre: "Contre.",
    });
  });
});

describe("programmeRecent", () => {
  it("préfère la date de publication la plus récente, puis la création", () => {
    const ancien = programme("a", "2022-04-01", "2026-10-01T00:00:00Z");
    const recent = programme("b", "2027-01-15", "2026-09-01T00:00:00Z");
    const sansDate = programme("c", null, "2026-10-10T00:00:00Z");
    expect(programmeRecent([ancien, sansDate, recent])?.id).toBe("b");
    expect(programmeRecent([sansDate, ancien])?.id).toBe("a");
    expect(programmeRecent([programme("d", null, "2026-01-01T00:00:00Z"), programme("e", null, "2026-02-01T00:00:00Z")])?.id).toBe("e");
    expect(programmeRecent([])).toBeNull();
  });
});

describe("moyennesParAxe", () => {
  it("fait la moyenne simple des propositions qui touchent l'axe", () => {
    const profil = moyennesParAxe([proposition("economie", { economique: -2 }), proposition("sante", { economique: 1, societal: 2 })]);
    expect(profil.find((p) => p.axe.id === "economique")).toMatchObject({ moyenne: -0.5, nombre: 2 });
    expect(profil.find((p) => p.axe.id === "societal")).toMatchObject({ moyenne: 2, nombre: 1 });
    expect(profil.find((p) => p.axe.id === "identite")).toMatchObject({ moyenne: null, nombre: 0 });
  });
});

describe("formaterMoyenne", () => {
  it("met la virgule, le signe et le vrai moins", () => {
    expect(formaterMoyenne(-0.84)).toBe("−0,8");
    expect(formaterMoyenne(1.5)).toBe("+1,5");
    expect(formaterMoyenne(0.02)).toBe("0,0");
  });
});

describe("calculerProximite", () => {
  it("vaut 100 % pour des positions identiques et 0 % pour des positions opposées", () => {
    const moi = [idee("economie", { economique: -2 })];
    expect(calculerProximite(moi, [proposition("economie", { economique: -2 })])).toMatchObject({ pourcentage: 100, comparees: 1, miennes: 1 });
    expect(calculerProximite(moi, [proposition("economie", { economique: 2 })])?.pourcentage).toBe(0);
  });

  it("ne compare que les thèmes et axes communs, et ignore brouillons et idées sans thème", () => {
    const moi = [
      idee("economie", { economique: 0 }),
      idee("sante", { societal: 1 }),
      idee("travail", { economique: 2 }, { statut: "brouillon" }),
      idee("economie", { economique: 2 }, { theme: null }),
    ];
    const resultat = calculerProximite(moi, [proposition("economie", { economique: 2 })]);
    expect(resultat).toMatchObject({ comparees: 1, miennes: 2, pourcentage: 50 });
  });

  it("renvoie null sans idée validée ou sans point commun", () => {
    expect(calculerProximite([], [proposition("economie", { economique: 1 })])).toBeNull();
    expect(calculerProximite([idee("sante", { societal: 1 })], [proposition("economie", { economique: 1 })])).toBeNull();
  });

  it("pondère par les priorités par thème", () => {
    const moi = [idee("economie", { economique: -2 }), idee("fiscalite", { economique: -2 })];
    const parti = [proposition("economie", { economique: -2 }), proposition("fiscalite", { economique: 2 })];
    expect(calculerProximite(moi, parti)?.pourcentage).toBe(50);
    // économie ×2 (accord), fiscalité ×1 (désaccord) : 2/3
    expect(calculerProximite(moi, parti, { economie: "prioritaire" })?.pourcentage).toBe(67);
    // économie ×0,5, fiscalité ×1 : 1/3
    expect(calculerProximite(moi, parti, { economie: "secondaire" })?.pourcentage).toBe(33);
  });

  it("pèse mes idées selon ma conviction", () => {
    const moi = [idee("economie", { economique: 2 }, { conviction: "certain" }), idee("economie", { economique: -2 }, { conviction: "hesitant" })];
    // moi = (2×1,5 − 2×0,5) / 2 = 1 ; parti = 1 → écart 0
    expect(calculerProximite(moi, [proposition("economie", { economique: 1 })])?.pourcentage).toBe(100);
  });
});

describe("classerPartis", () => {
  it("classe du plus proche au plus éloigné, sans donnée en dernier", () => {
    const moi = [idee("economie", { economique: -2 })];
    const partis: PartiComplet[] = [
      { id: "1", nom: "Loin", sigle: "LO", couleur: "indigo", programmes: [programme("p", null, "2026-01-01", [proposition("economie", { economique: 2 })])] },
      { id: "2", nom: "Sans", sigle: "", couleur: "corail", programmes: [] },
      { id: "3", nom: "Proche", sigle: "PR", couleur: "olive", programmes: [programme("p", null, "2026-01-01", [proposition("economie", { economique: -2 })])] },
    ];
    expect(classerPartis(partis, moi).map((c) => c.parti.id)).toEqual(["3", "1", "2"]);
  });
});

describe("placerMarqueurs", () => {
  it("garde une seule ligne quand les étiquettes sont éloignées", () => {
    const { places, lignes } = placerMarqueurs([
      { id: "a", libelle: "PS", valeur: -2 },
      { id: "b", libelle: "LR", valeur: 2 },
    ]);
    expect(lignes).toBe(1);
    expect(places.map((p) => p.pourcent)).toEqual([0, 100]);
  });

  it("répartit sur plusieurs lignes celles qui se chevauchent", () => {
    const { places, lignes } = placerMarqueurs([
      { id: "a", libelle: "PS", valeur: 0 },
      { id: "b", libelle: "LR", valeur: 0.1 },
      { id: "c", libelle: "RN", valeur: 0.2 },
    ]);
    expect(lignes).toBe(3);
    expect(new Set(places.map((p) => p.ligne)).size).toBe(3);
  });
});

describe("colonnes de scores", () => {
  it("fait l'aller-retour et neutralise les valeurs hors domaine", () => {
    const s = scores({ economique: -1, ecologie: 2 });
    expect(scoresDepuisColonnes(colonnesDepuisScores(s))).toEqual(s);
    expect(scoresDepuisColonnes({ ...colonnesDepuisScores(s), score_identite: 7 }).identite).toBeNull();
  });
});

describe("nettoyage des saisies", () => {
  it("nettoie un parti", () => {
    expect(nettoyerParti("  Renaissance ", " RE ")).toEqual({ nom: "Renaissance", sigle: "RE" });
    expect(nettoyerParti("  ", "")).toBe("Le nom du parti est requis.");
    expect(nettoyerParti("x", "y".repeat(13))).toMatch(/sigle/);
  });

  it("nettoie un programme et valide la date", () => {
    expect(nettoyerProgramme(" Présidentielle 2027 ", "2027-01-15")).toEqual({ echeance: "Présidentielle 2027", date_programme: "2027-01-15" });
    expect(nettoyerProgramme("Législatives", "")).toEqual({ echeance: "Législatives", date_programme: null });
    expect(nettoyerProgramme(" ", null)).toBe("L'échéance est requise.");
    expect(nettoyerProgramme("x", "2027-02-30")).toBe("La date est invalide.");
    expect(nettoyerProgramme("x", "15/01/2027")).toBe("La date est invalide.");
  });

  it("exige un thème et une phrase pour une proposition, et borne les scores", () => {
    expect(nettoyerProposition({ position: " Baisser la TVA ", theme: "fiscalite", scores: scores({ economique: 1 }) })).toEqual({
      position: "Baisser la TVA",
      theme: "fiscalite",
      scores: scores({ economique: 1 }),
      termes: [],
    });
    expect(nettoyerProposition({ position: "x", theme: null, scores: scoresVides() })).toBe("Choisis un thème.");
    expect(nettoyerProposition({ position: " ", theme: "sante", scores: scoresVides() })).toBe("La proposition est requise.");
    expect(nettoyerProposition({ position: "x", theme: "sante", scores: scores({ societal: 3 }) })).toMatch(/Sociétal/);
  });

  it("nettoie les mots-clés d'une proposition et refuse un mot absent du texte", () => {
    const base = { theme: "fiscalite" as const, scores: scoresVides() };
    expect(
      nettoyerProposition({ ...base, position: "Baisser la TVA", termes: [{ terme: " TVA ", definition: " un impôt " }, { terme: "", definition: "" }] })
    ).toMatchObject({ termes: [{ terme: "TVA", definition: "un impôt" }] });
    expect(nettoyerProposition({ ...base, position: "Baisser la TVA", termes: [{ terme: "ISF", definition: "" }] })).toMatch(/n'apparaît pas/);
  });
});

describe("suivi de lecture", () => {
  const lue = { ...proposition("sante", {}), id: "a", lu: true, favori: false };
  const luFavori = { ...proposition("sante", {}), id: "b", lu: true, favori: true };
  const neuve = { ...proposition("sante", {}), id: "c", lu: false, favori: false };
  const neuveFavorite = { ...proposition("sante", {}), id: "d", lu: false, favori: true };
  const toutes = [lue, luFavori, neuve, neuveFavorite];

  it("compte les propositions lues", () => {
    expect(compterLues(toutes)).toBe(2);
    expect(compterLues([])).toBe(0);
  });

  it("filtre sans rien retirer quand aucun filtre n'est actif", () => {
    expect(filtrerSuivi(toutes, { nonLues: false, favoris: false })).toEqual(toutes);
  });

  it("cumule « non lues » et « favoris » (ET)", () => {
    expect(filtrerSuivi(toutes, { nonLues: true, favoris: false }).map((p) => p.id)).toEqual(["c", "d"]);
    expect(filtrerSuivi(toutes, { nonLues: false, favoris: true }).map((p) => p.id)).toEqual(["b", "d"]);
    expect(filtrerSuivi(toutes, { nonLues: true, favoris: true }).map((p) => p.id)).toEqual(["d"]);
  });
});
