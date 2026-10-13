import { describe, expect, it } from "vitest";
import {
  ajouterExercice,
  ajouterSerie,
  ajusterRepos,
  ajusterReposExercice,
  basculerSerie,
  compterSeries,
  creerBrouillon,
  deplacerExercice,
  formaterDureeSeance,
  formaterMinutes,
  formaterPoids,
  libellePrecedent,
  libelleSerie,
  lireNombre,
  modifierSerie,
  remplacerExercice,
  resteRepos,
  retirerExercice,
  retirerSerie,
  terminerRepos,
  validerPayload,
  versPayload,
  volumeTotal,
  type Brouillon,
  type NouvelExercice,
} from "./seance";

function compteur() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

const DEBUT = "2026-10-12T17:00:00.000Z";
const EXO = "11111111-1111-4111-8111-111111111111";
const banc: NouvelExercice = {
  exerciceId: EXO,
  nom: "Développé couché",
  mode: "poids_reps",
  reposS: 90,
  nbSeries: 3,
  precedent: [
    { poids: 80, reps: 8, duree: null, distance: null },
    { poids: 82.5, reps: 6, duree: null, distance: null },
  ],
};

function brouillon(): Brouillon {
  return creerBrouillon(
    { nom: "Push", routineId: null, maintenant: DEBUT, exercices: [banc] },
    compteur(),
  );
}

const apres = (secondes: number) => new Date(new Date(DEBUT).getTime() + secondes * 1000).toISOString();

describe("creerBrouillon", () => {
  it("préremplit chaque série depuis la dernière séance, sinon la dernière connue", () => {
    const series = brouillon().exercices[0].series;
    expect(series.map((s) => [s.poids, s.reps])).toEqual([
      [80, 8],
      [82.5, 6],
      [82.5, 6],
    ]);
    expect(series.every((s) => !s.fait && s.type === "normale")).toBe(true);
  });

  it("crée au moins une série vide sans historique", () => {
    const b = creerBrouillon(
      {
        nom: "x",
        routineId: null,
        maintenant: DEBUT,
        exercices: [{ ...banc, precedent: [], nbSeries: 0 }],
      },
      compteur(),
    );
    expect(b.exercices[0].series).toHaveLength(1);
    expect(b.exercices[0].series[0].poids).toBeNull();
  });
});

describe("records connus", () => {
  it("garde les records de l'exercice dans le brouillon, null par défaut", () => {
    const records = { poidsMax: { valeur: 90, date: "2026-10-01" } } as never;
    const avec = creerBrouillon(
      { nom: "x", routineId: null, maintenant: DEBUT, exercices: [{ ...banc, records }] },
      compteur(),
    );
    expect(avec.exercices[0].records).toBe(records);
    expect(brouillon().exercices[0].records).toBeNull();
  });
});

describe("édition", () => {
  it("ajoute une série en copiant la dernière, et n'en retire jamais la dernière restante", () => {
    let b = brouillon();
    const cle = b.exercices[0].cle;
    b = ajouterSerie(b, cle, compteur());
    expect(b.exercices[0].series).toHaveLength(4);
    expect(b.exercices[0].series[3].poids).toBe(82.5);
    for (const s of [...b.exercices[0].series]) b = retirerSerie(b, cle, s.id);
    expect(b.exercices[0].series).toHaveLength(1);
  });

  it("borne le repos prévu entre 0 et 30 min", () => {
    const b = brouillon();
    const cle = b.exercices[0].cle;
    expect(ajusterReposExercice(b, cle, -1000).exercices[0].reposS).toBe(0);
    expect(ajusterReposExercice(b, cle, 5000).exercices[0].reposS).toBe(1800);
  });

  it("répercute un poids saisi sur les séries suivantes non faites, hors échauffement", () => {
    let b = brouillon();
    const { cle } = b.exercices[0];
    b = ajouterSerie(b, cle, compteur());
    b = ajouterSerie(b, cle, compteur());
    const [s0, s1, s2] = b.exercices[0].series;
    b = modifierSerie(b, cle, s1.id, { type: "echauffement" });
    b = basculerSerie(b, cle, s2.id, apres(10));
    b = modifierSerie(b, cle, s0.id, { poids: 90 });
    const poids = b.exercices[0].series.map((s) => s.poids);
    expect(poids[0]).toBe(90);
    expect(poids[1]).not.toBe(90);
    expect(poids[2]).not.toBe(90);
    b = modifierSerie(b, cle, s2.id, { poids: 50 });
    expect(b.exercices[0].series.map((s) => s.poids)[0]).toBe(90);
  });

  it("modifie le type d'une série et retire un exercice avec son repos", () => {
    let b = brouillon();
    const { cle } = b.exercices[0];
    const serieId = b.exercices[0].series[0].id;
    b = modifierSerie(b, cle, serieId, { type: "echauffement" });
    expect(b.exercices[0].series[0].type).toBe("echauffement");
    b = basculerSerie(b, cle, serieId, apres(10));
    expect(b.repos).not.toBeNull();
    b = retirerExercice(b, cle);
    expect(b.exercices).toHaveLength(0);
    expect(b.repos).toBeNull();
    expect(ajouterExercice(b, banc, compteur()).exercices).toHaveLength(1);
  });
});

describe("remplacerExercice", () => {
  const AUTRE = "22222222-2222-4222-8222-222222222222";
  const planche: NouvelExercice = {
    exerciceId: AUTRE,
    nom: "Planche",
    mode: "duree",
    reposS: 45,
    nbSeries: 3,
    precedent: [{ poids: null, reps: null, duree: 60, distance: null }],
    animation: "planche",
  };

  it("garde place, clé, nombre et type des séries ; valeurs et cases repartent de zéro", () => {
    let b = creerBrouillon(
      { nom: "Push", routineId: null, maintenant: DEBUT, exercices: [banc, { ...banc, nom: "Autre" }] },
      compteur(),
    );
    const { cle, series } = b.exercices[0];
    b = modifierSerie(b, cle, series[0].id, { type: "echauffement", poids: 100 });
    b = basculerSerie(b, cle, series[0].id, apres(10));

    const apresRemplacement = remplacerExercice(b, cle, planche, compteur());
    const e = apresRemplacement.exercices[0];

    expect(apresRemplacement.exercices).toHaveLength(2);
    expect(apresRemplacement.exercices[1].nom).toBe("Autre");
    expect([e.cle, e.exerciceId, e.nom, e.mode, e.reposS, e.animation]).toEqual([cle, AUTRE, "Planche", "duree", 45, "planche"]);
    expect(e.series.map((s) => s.id)).toEqual(series.map((s) => s.id));
    expect(e.series.map((s) => s.type)).toEqual(["echauffement", "normale", "normale"]);
    expect(e.series.every((s) => !s.fait && s.faitA === null && s.poids === null && s.duree === 60)).toBe(true);
  });

  it("laisse un repos en cours finir", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(10));
    expect(remplacerExercice(b, cle, planche, compteur()).repos).toEqual(b.repos);
  });
});

describe("deplacerExercice", () => {
  function troisExercices(): Brouillon {
    return creerBrouillon(
      {
        nom: "x",
        routineId: null,
        maintenant: DEBUT,
        exercices: ["A", "B", "C"].map((nom) => ({ ...banc, nom })),
      },
      compteur(),
    );
  }
  const noms = (b: Brouillon) => b.exercices.map((e) => e.nom).join("");

  it("monte et descend d'un cran", () => {
    const b = troisExercices();
    expect(noms(deplacerExercice(b, b.exercices[1].cle, -1))).toBe("BAC");
    expect(noms(deplacerExercice(b, b.exercices[1].cle, 1))).toBe("ACB");
  });

  it("ne bouge pas aux extrémités ni pour une clé inconnue", () => {
    const b = troisExercices();
    expect(deplacerExercice(b, b.exercices[0].cle, -1)).toBe(b);
    expect(deplacerExercice(b, b.exercices[2].cle, 1)).toBe(b);
    expect(deplacerExercice(b, "inconnue", 1)).toBe(b);
  });
});

describe("basculerSerie et repos", () => {
  it("lance le repos prévu, calcule le repos pris et l'annule en décochant", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(0));
    expect(b.repos).toMatchObject({ dureeS: 90, exerciceCle: cle });
    b = basculerSerie(b, cle, series[1].id, apres(100));
    expect(b.exercices[0].series[0].reposPris).toBe(100);
    b = basculerSerie(b, cle, series[1].id, apres(110));
    expect(b.exercices[0].series[1].fait).toBe(false);
    expect(b.exercices[0].series[0].reposPris).toBeNull();
    expect(b.repos).toBeNull();
  });

  it("ne lance aucun repos quand l'exercice n'en prévoit pas", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = ajusterReposExercice(b, cle, -90);
    b = basculerSerie(b, cle, series[0].id, apres(0));
    expect(b.repos).toBeNull();
  });

  it("ajuste le repos en cours (minimum 5 s), le termine et compte le temps restant", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(0));
    b = ajusterRepos(b, 15);
    expect(b.repos?.dureeS).toBe(105);
    expect(resteRepos(b.repos!, apres(100))).toBe(5);
    expect(resteRepos(b.repos!, apres(500))).toBe(0);
    expect(ajusterRepos(b, -1000).repos?.dureeS).toBe(5);
    expect(terminerRepos(b).repos).toBeNull();
    expect(ajusterRepos({ ...b, repos: null }, 15).repos).toBeNull();
  });
});

describe("synthèse", () => {
  it("compte les séries et le volume hors échauffement", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = modifierSerie(b, cle, series[0].id, { type: "echauffement" });
    b = basculerSerie(b, cle, series[0].id, apres(0));
    b = basculerSerie(b, cle, series[1].id, apres(60));
    expect(compterSeries(b)).toEqual({ faites: 2, total: 3 });
    expect(volumeTotal(b)).toBe(82.5 * 6);
  });

  it("ne compte pas une assistance (poids négatif) comme du volume", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = modifierSerie(b, cle, series[0].id, { poids: -20, reps: 8 });
    b = basculerSerie(b, cle, series[0].id, apres(0));
    expect(volumeTotal(b)).toBe(0);
  });

  it("numérote les séries de travail sans compter les échauffements", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = modifierSerie(b, cle, series[0].id, { type: "echauffement" });
    const s = b.exercices[0].series;
    expect([0, 1, 2].map((i) => libelleSerie(s, i))).toEqual(["É", "1", "2"]);
  });
});

describe("versPayload", () => {
  it("n'envoie que les séries faites, et rien pour une séance vide", () => {
    let b = brouillon();
    expect(versPayload(b, apres(3600))).toBeNull();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[1].id, apres(0));
    const payload = versPayload(b, apres(3600))!;
    expect(payload.exercices).toHaveLength(1);
    expect(payload.exercices[0].series.map((s) => s.id)).toEqual([series[1].id]);
    expect(validerPayload(payload)).toBeNull();
  });

  it("envoie le type choisi d'une séance libre, mais pas pour une routine (le serveur reprend celui de la routine)", () => {
    const libre = brouillon();
    const { cle, series } = libre.exercices[0];
    const fait = basculerSerie({ ...libre, typeSeance: "LEGS" }, cle, series[0].id, apres(0));
    expect(versPayload(fait, apres(3600))!.typeSeance).toBe("LEGS");
    expect(versPayload({ ...fait, routineId: "33333333-3333-4333-8333-333333333333" }, apres(3600))!.typeSeance).toBeNull();
  });

  it("un ancien brouillon sans type part sans type", () => {
    const b = brouillon();
    const { cle, series } = b.exercices[0];
    expect(versPayload(basculerSerie(b, cle, series[0].id, apres(0)), apres(3600))!.typeSeance).toBeNull();
  });
});

describe("validerPayload", () => {
  function valide() {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(0));
    return versPayload(b, apres(1800))!;
  }

  it("accepte un envoi valide, avec un type de séance", () => {
    expect(validerPayload({ ...valide(), typeSeance: "PUSH" })).toBeNull();
  });

  it("accepte un envoi sans type, y compris ceux en attente créés avant ce champ", () => {
    const ancien: Record<string, unknown> = { ...valide() };
    delete ancien.typeSeance;
    expect(validerPayload(ancien)).toBeNull();
    expect(validerPayload({ ...valide(), typeSeance: null })).toBeNull();
  });

  it("refuse un type de séance inconnu", () => {
    expect(validerPayload({ ...valide(), typeSeance: "Renfo" })).toBe("Type de séance invalide.");
  });

  it.each([
    ["nom vide", (p: ReturnType<typeof valide>) => ({ ...p, nom: "  " })],
    ["identifiant invalide", (p: ReturnType<typeof valide>) => ({ ...p, id: "abc" })],
    ["fin avant début", (p: ReturnType<typeof valide>) => ({ ...p, finA: apres(-5) })],
    ["séance de plus de 24 h", (p: ReturnType<typeof valide>) => ({ ...p, finA: apres(90_000) })],
    ["aucun exercice", (p: ReturnType<typeof valide>) => ({ ...p, exercices: [] })],
    ["type de série inconnu", (p: ReturnType<typeof valide>) => ({
      ...p,
      exercices: [{ ...p.exercices[0], series: [{ ...p.exercices[0].series[0], type: "autre" }] }],
    })],
    ["poids hors bornes", (p: ReturnType<typeof valide>) => ({
      ...p,
      exercices: [{ ...p.exercices[0], series: [{ ...p.exercices[0].series[0], poids: 5000 }] }],
    })],
    ["reps décimales", (p: ReturnType<typeof valide>) => ({
      ...p,
      exercices: [{ ...p.exercices[0], series: [{ ...p.exercices[0].series[0], reps: 2.5 }] }],
    })],
  ])("refuse : %s", (_nom, alterer) => {
    expect(validerPayload(alterer(valide()))).not.toBeNull();
  });

  it("refuse un identifiant de série dupliqué et une valeur qui n'est pas un objet", () => {
    const p = valide();
    const serie = p.exercices[0].series[0];
    expect(validerPayload({ ...p, exercices: [{ ...p.exercices[0], series: [serie, serie] }] })).not.toBeNull();
    expect(validerPayload(null)).not.toBeNull();
    expect(validerPayload([])).not.toBeNull();
  });
});

describe("affichage", () => {
  it("lit un nombre saisi", () => {
    expect(lireNombre("82,5")).toBe(82.5);
    expect(lireNombre("  ")).toBeNull();
    expect(lireNombre("-5")).toBeNull();
    expect(lireNombre("-5", true)).toBe(-5);
    expect(lireNombre("-", true)).toBeNull();
    expect(lireNombre("abc")).toBeNull();
  });

  it("formate minutes, durée et poids", () => {
    expect(formaterMinutes(90)).toBe("1:30");
    expect(formaterMinutes(5)).toBe("0:05");
    expect(formaterDureeSeance(DEBUT, apres(45 * 60))).toBe("45 min");
    expect(formaterDureeSeance(DEBUT, apres(75 * 60))).toBe("1 h 15");
    expect(formaterPoids(80)).toBe("80");
    expect(formaterPoids(82.5)).toBe("82,5");
  });

  it("décrit la série précédente selon le mode de saisie", () => {
    const p = { poids: 80, reps: 8, duree: 45, distance: 500 };
    expect(libellePrecedent("poids_reps", p)).toBe("80 × 8");
    expect(libellePrecedent("poids_corps_reps", p)).toBe("80 × 8");
    expect(libellePrecedent("duree", p)).toBe("45 s");
    expect(libellePrecedent("distance_duree", p)).toBe("500 m · 45 s");
    expect(libellePrecedent("poids_duree", p)).toBe("80 · 45 s");
    expect(libellePrecedent("duree_vitesse", { ...p, duree: 1800, vitesse: 5.5 })).toBe("30 min · 5,5 km/h");
    expect(libellePrecedent("duree_vitesse", { ...p, duree: 90 })).toBe("1,5 min");
    expect(libellePrecedent("poids_reps", undefined)).toBe("–");
    expect(libellePrecedent("duree", { poids: 80, reps: 8, duree: null, distance: null })).toBe("–");
  });
});
