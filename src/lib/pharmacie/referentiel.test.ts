import { describe, expect, it } from "vitest";
import {
  cheminDeClasse,
  moleculesParInitiale,
  nbMoleculesDeClasse,
  pathologiesDeClasse,
  pathologiesDeMolecule,
  profilsDePathologie,
  rechercherReferentiel,
  type PharmaRefSnapshot,
} from "./referentiel";

const base = { created_at: "2026-09-30T00:00:00Z" };

const snap: PharmaRefSnapshot = {
  genereLe: "2026-09-30T00:00:00Z",
  classes: [
    { ...base, id: "c-cardio", nom: "Cardiovasculaire", parent_id: null, atc: "C", mecanisme: null, contre_indications: null, interactions: null, conseils: null, ordre: 0 },
    { ...base, id: "c-iec", nom: "IEC", parent_id: "c-cardio", atc: "C09A", mecanisme: "Inhibent l’enzyme de conversion", contre_indications: null, interactions: null, conseils: null, ordre: 1 },
    { ...base, id: "c-bb", nom: "Bêta-bloquants", parent_id: "c-cardio", atc: "C07", mecanisme: null, contre_indications: null, interactions: null, conseils: null, ordre: 2 },
  ],
  molecules: [
    { ...base, id: "m-ramipril", dci: "ramipril", classe_id: "c-iec", association: false, composants: [], indications: ["HTA", "Insuffisance cardiaque"], particularites: null, ordre: 0 },
    { ...base, id: "m-bisoprolol", dci: "bisoprolol", classe_id: "c-bb", association: false, composants: [], indications: ["HTA", "Angor"], particularites: null, ordre: 1 },
    { ...base, id: "m-asso", dci: "périndopril/amlodipine", classe_id: "c-iec", association: true, composants: ["périndopril", "amlodipine"], indications: ["HTA"], particularites: null, ordre: 2 },
  ],
  specialites: [
    { ...base, id: "s-triatec", molecule_id: "m-ramipril", nom: "Triatec", dosages: "5 mg" },
    { ...base, id: "s-cardensiel", molecule_id: "m-bisoprolol", nom: "Cardensiel", dosages: null },
  ],
  pathologies: [{ ...base, id: "p-hta", nom: "Hypertension artérielle", resume: null, source: "HAS 2016", source_date: "2016", ordre: 0 }],
  lignes: [
    { ...base, id: "l-g1", pathologie_id: "p-hta", profil: "Général", rang: 1, titre: "Bithérapie", description: null },
    { ...base, id: "l-g2", pathologie_id: "p-hta", profil: "Général", rang: 2, titre: "Trithérapie", description: null },
    { ...base, id: "l-age", pathologie_id: "p-hta", profil: "Sujet âgé", rang: 1, titre: "Faible dose", description: null },
  ],
  items: [
    { id: "i1", ligne_id: "l-g1", classe_id: "c-iec", molecule_id: null, role: "traitement", note: null, ordre: 0 },
    { id: "i2", ligne_id: "l-g1", classe_id: "c-bb", molecule_id: null, role: "eviter", note: "sans indication cardiaque", ordre: 1 },
    { id: "i3", ligne_id: "l-age", classe_id: null, molecule_id: "m-bisoprolol", role: "traitement", note: null, ordre: 0 },
  ],
};

describe("référentiel : classes", () => {
  it("remonte le chemin de la racine à la classe", () => {
    const iec = snap.classes[1];
    expect(cheminDeClasse(snap, iec).map((c) => c.nom)).toEqual(["Cardiovasculaire", "IEC"]);
  });

  it("compte les molécules des sous-classes", () => {
    expect(nbMoleculesDeClasse(snap, "c-cardio")).toBe(3);
    expect(nbMoleculesDeClasse(snap, "c-iec")).toBe(2);
  });

  it("regroupe les molécules par initiale sans tenir compte des accents", () => {
    const groupes = moleculesParInitiale(snap);
    expect(groupes.map((g) => g.initiale)).toEqual(["B", "P", "R"]);
  });
});

describe("référentiel : pathologies", () => {
  it("met le profil Général en tête et ordonne les lignes par rang", () => {
    const profils = profilsDePathologie(snap, "p-hta");
    expect(profils.map((p) => p.profil)).toEqual(["Général", "Sujet âgé"]);
    expect(profils[0].lignes.map((l) => l.ligne.rang)).toEqual([1, 2]);
    expect(profils[0].lignes[0].items[0].classe?.nom).toBe("IEC");
    expect(profils[1].lignes[0].items[0].molecule?.dci).toBe("bisoprolol");
  });

  it("retrouve les pathologies d’une classe et d’une molécule", () => {
    expect(pathologiesDeClasse(snap, "c-bb").map((p) => p.id)).toEqual(["p-hta"]);
    expect(pathologiesDeClasse(snap, "c-cardio").map((p) => p.id)).toEqual(["p-hta"]);
    expect(pathologiesDeMolecule(snap, snap.molecules[0]).map((p) => p.id)).toEqual(["p-hta"]);
  });
});

describe("référentiel : recherche", () => {
  it("trouve par DCI sans accent ni casse", () => {
    expect(rechercherReferentiel(snap, "PERINDOPRIL")[0].id).toBe("m-asso");
  });

  it("trouve par nom commercial et l’affiche en détail", () => {
    const [premier] = rechercherReferentiel(snap, "triatec");
    expect(premier.type).toBe("molecule");
    expect(premier.id).toBe("m-ramipril");
    expect(premier.detail).toContain("Triatec");
  });

  it("tolère une faute de frappe sur un nom de 4 lettres ou plus", () => {
    expect(rechercherReferentiel(snap, "bisoprolo").some((r) => r.id === "m-bisoprolol")).toBe(true);
  });

  it("trouve une classe, une pathologie et une indication", () => {
    expect(rechercherReferentiel(snap, "iec").some((r) => r.type === "classe" && r.id === "c-iec")).toBe(true);
    expect(rechercherReferentiel(snap, "hypertension").some((r) => r.type === "pathologie")).toBe(true);
    expect(rechercherReferentiel(snap, "angor").map((r) => r.id)).toContain("m-bisoprolol");
  });

  it("exige que tous les mots de la requête soient trouvés", () => {
    expect(rechercherReferentiel(snap, "ramipril angor")).toEqual([]);
    expect(rechercherReferentiel(snap, "a")).toEqual([]);
  });
});
