import { describe, expect, it } from "vitest";
import { cartesARevoir, rechercherNotions, statsMatiere } from "./selecteurs";
import type { PharmaSnapshot } from "./types";

function notion(id: string, titre: string, contenu: string, tags: string[] = []) {
  return { id, chapitre_id: "c1", titre, contenu, tags, ordre: 0, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };
}

const SNAP: PharmaSnapshot = {
  genereLe: "2026-10-01T00:00:00Z",
  matieres: [{ id: "m1", nom: "Pharmacologie", ordre: 0, created_at: "" }],
  chapitres: [{ id: "c1", matiere_id: "m1", nom: "Cardio", ordre: 0, created_at: "" }],
  notions: [
    notion("n1", "IEC", "Les IEC baissent la tension artérielle.", ["hypertension"]),
    notion("n2", "Amoxicilline", "Antibiotique de la famille des pénicillines.", ["antibiotique"]),
  ],
  cartes: [
    { id: "k1", notion_id: "n1", question: "q", reponse: "r", echeance: "2026-09-30T00:00:00Z", intervalle_jours: 10, facilite: 2.5, repetitions: 3, dernier_passage: null },
    { id: "k2", notion_id: "n2", question: "q", reponse: "r", echeance: "2026-10-05T00:00:00Z", intervalle_jours: 1, facilite: 2.5, repetitions: 1, dernier_passage: null },
  ],
};

describe("rechercherNotions", () => {
  it("ignore accents et casse", () => {
    expect(rechercherNotions(SNAP, "ARTERIELLE").map((r) => r.notion.id)).toEqual(["n1"]);
  });
  it("tolère une faute de frappe sur les mots de 4 lettres et plus", () => {
    expect(rechercherNotions(SNAP, "amoxicillne").map((r) => r.notion.id)).toEqual(["n2"]);
  });
  it("classe le titre avant le contenu", () => {
    const snap = { ...SNAP, notions: [notion("a", "Autre", "parle des IEC"), notion("b", "IEC", "x")] };
    expect(rechercherNotions(snap, "iec").map((r) => r.notion.id)).toEqual(["b", "a"]);
  });
  it("renvoie vide pour une requête trop courte", () => {
    expect(rechercherNotions(SNAP, "a")).toEqual([]);
  });
});

describe("cartes et stats", () => {
  it("cartesARevoir ne garde que les échéances passées", () => {
    expect(cartesARevoir(SNAP.cartes, new Date("2026-10-01T12:00:00Z")).map((c) => c.id)).toEqual(["k1"]);
  });
  it("statsMatiere compte notions, cartes et cartes acquises", () => {
    expect(statsMatiere(SNAP, "m1")).toEqual({ chapitres: 1, notions: 2, cartes: 2, acquises: 1 });
  });
});
