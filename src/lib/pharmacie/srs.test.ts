import { describe, expect, it } from "vitest";
import { estAcquise, estNoteRevision, prochainEtatCarte } from "./srs";

const MAINTENANT = new Date("2026-10-01T10:00:00.000Z");
const NEUVE = { intervalle_jours: 0, facilite: 2.5, repetitions: 0 };

describe("prochainEtatCarte", () => {
  it("« À revoir » remet la carte à zéro et la ramène dans 10 minutes", () => {
    const etat = prochainEtatCarte({ intervalle_jours: 12, facilite: 2.5, repetitions: 4 }, "a-revoir", MAINTENANT);
    expect(etat.repetitions).toBe(0);
    expect(etat.intervalle_jours).toBe(0);
    expect(etat.facilite).toBe(2.3);
    expect(etat.echeance).toBe("2026-10-01T10:10:00.000Z");
  });

  it("« Bien » suit 1 jour, 3 jours, puis intervalle × facilité", () => {
    const un = prochainEtatCarte(NEUVE, "bien", MAINTENANT);
    expect(un.intervalle_jours).toBe(1);
    const deux = prochainEtatCarte(un, "bien", MAINTENANT);
    expect(deux.intervalle_jours).toBe(3);
    const trois = prochainEtatCarte(deux, "bien", MAINTENANT);
    expect(trois.intervalle_jours).toBe(8); // 3 × 2,5 = 7,5 -> 8
    expect(trois.repetitions).toBe(3);
  });

  it("« Facile » espace plus vite et augmente la facilité", () => {
    const etat = prochainEtatCarte(NEUVE, "facile", MAINTENANT);
    expect(etat.intervalle_jours).toBe(3);
    expect(etat.facilite).toBe(2.65);
  });

  it("« Difficile » garde un intervalle court et baisse la facilité", () => {
    const etat = prochainEtatCarte({ intervalle_jours: 10, facilite: 2.5, repetitions: 3 }, "difficile", MAINTENANT);
    expect(etat.intervalle_jours).toBe(12);
    expect(etat.facilite).toBe(2.35);
  });

  it("la facilité reste bornée entre 1,3 et 3", () => {
    let etat = { ...NEUVE, facilite: 1.35 };
    for (let i = 0; i < 5; i++) etat = { ...etat, ...prochainEtatCarte(etat, "a-revoir", MAINTENANT) };
    expect(etat.facilite).toBe(1.3);
    const haut = prochainEtatCarte({ ...NEUVE, facilite: 2.95 }, "facile", MAINTENANT);
    expect(haut.facilite).toBe(3);
  });
});

describe("helpers", () => {
  it("estAcquise à partir de 7 jours", () => {
    expect(estAcquise({ intervalle_jours: 6 })).toBe(false);
    expect(estAcquise({ intervalle_jours: 7 })).toBe(true);
  });
  it("estNoteRevision valide les 4 notes", () => {
    expect(estNoteRevision("bien")).toBe(true);
    expect(estNoteRevision("nul")).toBe(false);
    expect(estNoteRevision(3)).toBe(false);
  });
});
