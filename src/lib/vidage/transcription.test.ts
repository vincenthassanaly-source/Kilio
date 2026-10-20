import { describe, expect, it } from "vitest";
import {
  CHEVAUCHEMENT,
  HAUTEUR_TRANCHE,
  LONGUEUR_MAX_TEXTE,
  MAX_TRANCHES,
  PROMPT_TRANSCRIPTION,
  SCHEMA_TRANSCRIPTION,
  hauteurUtile,
  lireTranscription,
  tranchesDeFeuille,
} from "./transcription";
import type { Trait } from "./traits";

const traitA = (y: number): Trait => ({ e: 2, p: [10, y, 50, 200, y, 50] });

describe("hauteurUtile", () => {
  it("vaut 0 pour une feuille vide", () => {
    expect(hauteurUtile([])).toBe(0);
  });

  it("ajoute une marge sous le trait le plus bas", () => {
    expect(hauteurUtile([traitA(100), traitA(900)])).toBeGreaterThan(900);
  });
});

describe("tranchesDeFeuille", () => {
  it("n'envoie qu'une tranche pour une feuille courte ou vide", () => {
    expect(tranchesDeFeuille([])).toEqual({ tops: [0], tronquee: false });
    expect(tranchesDeFeuille([traitA(500)])).toEqual({ tops: [0], tronquee: false });
  });

  it("découpe une feuille longue en tranches qui se chevauchent et couvrent tout", () => {
    const traits = [traitA(3000)];
    const { tops, tronquee } = tranchesDeFeuille(traits);
    expect(tronquee).toBe(false);
    expect(tops.length).toBeGreaterThan(1);
    tops.slice(1).forEach((top, i) => expect(top).toBe(tops[i] + HAUTEUR_TRANCHE - CHEVAUCHEMENT));
    expect(tops[tops.length - 1] + HAUTEUR_TRANCHE).toBeGreaterThanOrEqual(hauteurUtile(traits));
  });

  it("plafonne le nombre de tranches et le signale", () => {
    const { tops, tronquee } = tranchesDeFeuille([traitA(29_000)]);
    expect(tops).toHaveLength(MAX_TRANCHES);
    expect(tronquee).toBe(true);
  });
});

describe("lireTranscription", () => {
  it("renvoie le texte nettoyé des espaces en trop", () => {
    expect(lireTranscription({ texte: "  Bonjour\nle monde  " })).toBe("Bonjour\nle monde");
  });

  it("accepte un texte vide : rien de lisible sur la feuille", () => {
    expect(lireTranscription({ texte: "   " })).toBe("");
  });

  it("refuse toute réponse qui n'a pas la forme attendue", () => {
    expect(lireTranscription(null)).toBeNull();
    expect(lireTranscription("texte")).toBeNull();
    expect(lireTranscription({ texte: 42 })).toBeNull();
    expect(lireTranscription({})).toBeNull();
  });

  it("tronque un texte plus long que la limite de la base", () => {
    expect(lireTranscription({ texte: "a".repeat(LONGUEUR_MAX_TEXTE + 10) })).toHaveLength(LONGUEUR_MAX_TEXTE);
  });
});

describe("consigne envoyée à Gemini", () => {
  it("demande une copie fidèle, sans réécriture, et [illisible] en cas de doute", () => {
    expect(PROMPT_TRANSCRIPTION).toMatch(/fidèle/i);
    expect(PROMPT_TRANSCRIPTION).toContain("[illisible]");
    expect(PROMPT_TRANSCRIPTION).toMatch(/chevauch/i);
  });

  it("contraint la réponse à un objet { texte }", () => {
    expect(SCHEMA_TRANSCRIPTION).toMatchObject({ type: "OBJECT", required: ["texte"] });
  });
});
