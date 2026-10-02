import { describe, expect, it } from "vitest";
import {
  ajouterExercice,
  ajouterSerie,
  ajusterRepos,
  ajusterReposExercice,
  basculerSerie,
  compterSeries,
  creerBrouillon,
  formaterDureeSeance,
  formaterMinutes,
  formaterPoids,
  lireNombre,
  modifierSerie,
  resteRepos,
  retirerExercice,
  retirerSerie,
  terminerRepos,
  validerPayload,
  validerRoutine,
  versPayload,
  volumeTotal,
  type Brouillon,
  type NouvelExercice,
} from "./seance";

function compteur() {
  let n = 0;
  return () => `id-${++n}`;
}

const DEBUT = "2026-10-02T17:00:00.000Z";
const banc: NouvelExercice = {
  exerciceId: "Bench",
  nom: "Développé couché",
  image: null,
  typeMesure: "poids_reps",
  reposS: 90,
  nbSeries: 3,
  precedent: [
    { poids: 80, reps: 8, duree: null },
    { poids: 82.5, reps: 6, duree: null },
  ],
};

function brouillon(): Brouillon {
  return creerBrouillon({ nom: "Push", routineId: "r1", maintenant: DEBUT, exercices: [banc] }, compteur());
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
    expect(series.every((s) => !s.fait && s.faitA === null)).toBe(true);
  });

  it("reprend les répétitions visées de la routine quand il n'y a pas d'historique", () => {
    const b = creerBrouillon(
      { nom: "x", routineId: null, maintenant: DEBUT, exercices: [{ ...banc, precedent: [], repsCible: 10 }] },
      compteur(),
    );
    expect(b.exercices[0].series.map((s) => [s.poids, s.reps])).toEqual([
      [null, 10],
      [null, 10],
      [null, 10],
    ]);
  });

  it("démarre vide sans historique", () => {
    const b = creerBrouillon(
      { nom: "Vide", routineId: null, maintenant: DEBUT, exercices: [{ ...banc, precedent: [] }] },
      compteur(),
    );
    expect(b.exercices[0].series[0]).toMatchObject({ poids: null, reps: null });
  });
});

describe("édition", () => {
  it("ajoute une série en copiant la précédente", () => {
    let b = brouillon();
    const cle = b.exercices[0].cle;
    b = modifierSerie(b, cle, b.exercices[0].series[2].id, { poids: 90, reps: 5 });
    b = ajouterSerie(b, cle, compteur());
    expect(b.exercices[0].series).toHaveLength(4);
    expect(b.exercices[0].series[3]).toMatchObject({ poids: 90, reps: 5, fait: false });
  });

  it("garde au moins une série", () => {
    let b = creerBrouillon(
      { nom: "x", routineId: null, maintenant: DEBUT, exercices: [{ ...banc, nbSeries: 1 }] },
      compteur(),
    );
    b = retirerSerie(b, b.exercices[0].cle, b.exercices[0].series[0].id);
    expect(b.exercices[0].series).toHaveLength(1);
  });

  it("règle le repos prévu d'un exercice entre 0 et 30 min", () => {
    const b = brouillon();
    const { cle } = b.exercices[0];
    expect(ajusterReposExercice(b, cle, 30).exercices[0].reposS).toBe(120);
    expect(ajusterReposExercice(b, cle, -500).exercices[0].reposS).toBe(0);
    expect(ajusterReposExercice(b, cle, 5000).exercices[0].reposS).toBe(1800);
  });

  it("ajoute et retire un exercice, et arrête son minuteur", () => {
    let b = ajouterExercice(brouillon(), { ...banc, exerciceId: "Squat" }, compteur());
    expect(b.exercices).toHaveLength(2);
    const { cle } = b.exercices[0];
    b = basculerSerie(b, cle, b.exercices[0].series[0].id, apres(10));
    expect(b.repos).not.toBeNull();
    b = retirerExercice(b, cle);
    expect(b.exercices).toHaveLength(1);
    expect(b.repos).toBeNull();
  });
});

describe("basculerSerie et repos", () => {
  it("coche : horodate et lance le repos prévu", () => {
    const b0 = brouillon();
    const { cle } = b0.exercices[0];
    const b = basculerSerie(b0, cle, b0.exercices[0].series[0].id, apres(60));
    expect(b.exercices[0].series[0]).toMatchObject({ fait: true, faitA: apres(60) });
    expect(b.repos).toEqual({ debutA: apres(60), finA: apres(150), dureeS: 90, exerciceCle: cle });
  });

  it("enregistre le repos réellement pris sur la série précédente", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(60));
    b = basculerSerie(b, cle, series[1].id, apres(200));
    expect(b.exercices[0].series[0].reposPris).toBe(140);
    expect(b.exercices[0].series[1].reposPris).toBeNull();
  });

  it("décoche : annule le minuteur lancé et le repos de la précédente", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(60));
    b = basculerSerie(b, cle, series[1].id, apres(200));
    b = basculerSerie(b, cle, series[1].id, apres(210));
    expect(b.exercices[0].series[1]).toMatchObject({ fait: false, faitA: null });
    expect(b.exercices[0].series[0].reposPris).toBeNull();
    expect(b.repos).toBeNull();
  });

  it("décocher une ancienne série ne touche pas le minuteur en cours", () => {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(60));
    b = basculerSerie(b, cle, series[1].id, apres(200));
    b = basculerSerie(b, cle, series[0].id, apres(210));
    expect(b.repos?.debutA).toBe(apres(200));
  });

  it("sans repos prévu, aucun minuteur", () => {
    let b = creerBrouillon(
      { nom: "x", routineId: null, maintenant: DEBUT, exercices: [{ ...banc, reposS: 0 }] },
      compteur(),
    );
    b = basculerSerie(b, b.exercices[0].cle, b.exercices[0].series[0].id, apres(5));
    expect(b.repos).toBeNull();
  });

  it("ajuste et termine le repos, sans descendre sous 5 s", () => {
    let b = brouillon();
    b = basculerSerie(b, b.exercices[0].cle, b.exercices[0].series[0].id, apres(0));
    b = ajusterRepos(b, 15);
    expect(b.repos).toMatchObject({ dureeS: 105, finA: apres(105) });
    b = ajusterRepos(b, -500);
    expect(b.repos?.dureeS).toBe(5);
    expect(terminerRepos(b).repos).toBeNull();
  });

  it("calcule le temps restant sans passer sous zéro", () => {
    const b = basculerSerie(brouillon(), brouillon().exercices[0].cle, "inconnue", apres(0));
    expect(b.repos).toBeNull();
    const repos = { debutA: apres(0), finA: apres(90), dureeS: 90, exerciceCle: "c" };
    expect(resteRepos(repos, apres(30))).toBe(60);
    expect(resteRepos(repos, apres(30.2))).toBe(60);
    expect(resteRepos(repos, apres(500))).toBe(0);
  });
});

describe("synthèse et payload", () => {
  function avecDeuxSeriesFaites() {
    let b = brouillon();
    const { cle, series } = b.exercices[0];
    b = basculerSerie(b, cle, series[0].id, apres(60));
    b = basculerSerie(b, cle, series[2].id, apres(200));
    return b;
  }

  it("compte les séries et le volume", () => {
    const b = avecDeuxSeriesFaites();
    expect(compterSeries(b)).toEqual({ faites: 2, total: 3 });
    expect(volumeTotal(b)).toBe(80 * 8 + 82.5 * 6);
  });

  it("n'envoie que les séries faites, renumérotées sans trou", () => {
    const payload = versPayload(avecDeuxSeriesFaites(), apres(3000));
    expect(payload?.finA).toBe(apres(3000));
    expect(payload?.series.map((s) => [s.position, s.ordre, s.poids, s.reps])).toEqual([
      [0, 0, 80, 8],
      [0, 1, 82.5, 6],
    ]);
    // La 1re série a été suivie de 140 s de repos (60 s → 200 s) ; la dernière n'a pas de suivante.
    expect(payload?.series.map((s) => s.reposPris)).toEqual([140, null]);
  });

  it("renvoie null quand rien n'est validé", () => {
    expect(versPayload(brouillon(), apres(60))).toBeNull();
  });
});

describe("validation serveur", () => {
  const UUID_A = "11111111-1111-4111-8111-111111111111";
  const UUID_B = "22222222-2222-4222-8222-222222222222";
  const serie = {
    id: UUID_B,
    exerciceId: "Barbell_Bench_Press_-_Medium_Grip",
    position: 0,
    ordre: 0,
    poids: 80,
    reps: 8,
    duree: null,
    reposPris: 90,
    faitA: DEBUT,
  };
  const valide = { id: UUID_A, nom: "Push", routineId: null, debutA: DEBUT, finA: apres(3600), series: [serie] };

  it("accepte une séance bien formée", () => {
    expect(validerPayload(valide)).toBeNull();
  });

  it.each([
    ["un objet absent", null],
    ["un identifiant qui n'est pas un uuid", { ...valide, id: "abc" }],
    ["un nom vide", { ...valide, nom: "  " }],
    ["une fin avant le début", { ...valide, finA: apres(-5) }],
    ["une séance de plus de 24 h", { ...valide, finA: apres(25 * 3600) }],
    ["aucune série", { ...valide, series: [] }],
    ["un poids négatif", { ...valide, series: [{ ...serie, poids: -1 }] }],
    ["un poids énorme", { ...valide, series: [{ ...serie, poids: 5000 }] }],
    ["des répétitions décimales", { ...valide, series: [{ ...serie, reps: 8.5 }] }],
    ["un exercice avec des caractères interdits", { ...valide, series: [{ ...serie, exerciceId: "x;drop table" }] }],
    ["deux séries au même identifiant", { ...valide, series: [serie, serie] }],
    ["une date de série invalide", { ...valide, series: [{ ...serie, faitA: "hier" }] }],
  ])("refuse %s", (_nom, payload) => {
    expect(validerPayload(payload)).toEqual(expect.any(String));
  });

  const routine = { nom: "Push", exercices: [{ exerciceId: "Pullups", nbSeries: 3, repsCible: 10, reposS: 90 }] };

  it("valide une routine", () => {
    expect(validerRoutine(routine)).toBeNull();
    expect(validerRoutine({ ...routine, id: UUID_A, exercices: [{ ...routine.exercices[0], repsCible: null }] })).toBeNull();
  });

  it.each([
    ["sans nom", { ...routine, nom: "" }],
    ["sans exercice", { ...routine, exercices: [] }],
    ["avec trop de séries", { ...routine, exercices: [{ ...routine.exercices[0], nbSeries: 21 }] }],
    ["avec un repos trop long", { ...routine, exercices: [{ ...routine.exercices[0], reposS: 3600 }] }],
    ["avec un id invalide", { ...routine, id: "123" }],
  ])("refuse une routine %s", (_nom, valeur) => {
    expect(validerRoutine(valeur)).toEqual(expect.any(String));
  });
});

describe("saisie et affichage", () => {
  it("lit les nombres à la française", () => {
    expect(lireNombre("82,5")).toBe(82.5);
    expect(lireNombre(" 12 ")).toBe(12);
    expect(lireNombre("")).toBeNull();
    expect(lireNombre("abc")).toBeNull();
    expect(lireNombre("-3")).toBeNull();
  });

  it("formate les durées et les poids", () => {
    expect(formaterMinutes(90)).toBe("1:30");
    expect(formaterMinutes(5)).toBe("0:05");
    expect(formaterDureeSeance(DEBUT, apres(45 * 60))).toBe("45 min");
    expect(formaterDureeSeance(DEBUT, apres(75 * 60))).toBe("1 h 15");
    expect(formaterPoids(80)).toBe("80");
    expect(formaterPoids(82.5)).toBe("82,5");
  });
});
