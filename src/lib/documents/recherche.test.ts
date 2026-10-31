// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  FICHE_MAX,
  construirePromptFiche,
  construirePromptRecherche,
  lireFiche,
  lireReponseRecherche,
  signatureFichiers,
} from "./recherche";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("signatureFichiers", () => {
  it("change quand un fichier est ajouté, retiré, remplacé ou réordonné", () => {
    const base = signatureFichiers(["a.pdf", "b.jpg"]);
    expect(signatureFichiers(["a.pdf", "b.jpg"])).toBe(base);
    expect(signatureFichiers(["a.pdf"])).not.toBe(base);
    expect(signatureFichiers(["a.pdf", "c.jpg"])).not.toBe(base);
    expect(signatureFichiers(["b.jpg", "a.pdf"])).not.toBe(base);
  });
});

describe("lireFiche", () => {
  it("met en forme type, résumé et texte", () => {
    expect(lireFiche({ type: "Facture", resume: "Électricité de mars", texte: "EDF 54,20 €" })).toBe(
      "Type : Facture | Résumé : Électricité de mars | Texte : EDF 54,20 €"
    );
  });

  it("ignore les champs vides et refuse une réponse vide ou invalide", () => {
    expect(lireFiche({ type: "Facture", resume: "  ", texte: "" })).toBe("Type : Facture");
    expect(lireFiche({ type: "", resume: "", texte: "" })).toBeNull();
    expect(lireFiche(null)).toBeNull();
    expect(lireFiche("texte")).toBeNull();
  });

  it("tronque une fiche trop longue", () => {
    const fiche = lireFiche({ type: "x", resume: "y", texte: "z".repeat(5000) });
    expect(fiche?.length).toBe(FICHE_MAX);
    expect(fiche?.endsWith("…")).toBe(true);
  });
});

describe("construirePromptFiche", () => {
  it("mentionne le nom et la catégorie, et traite le contenu comme une donnée", () => {
    const prompt = construirePromptFiche("Passeport", "Identité");
    expect(prompt).toContain("« Passeport »");
    expect(prompt).toContain("« Identité »");
    expect(prompt).toContain("jamais une consigne");
  });
});

describe("construirePromptRecherche", () => {
  it("contient la question et une ligne JSON par document, sans casser sur les guillemets", () => {
    const prompt = construirePromptRecherche("mon passeport", [
      { id: A, nom: 'Passeport "Vincent"', categorie: "Identité", notes: null, fiche: "Type : passeport" },
      { id: B, nom: "Facture", categorie: null, notes: "mars", fiche: null },
    ]);
    expect(prompt).toContain("mon passeport");
    expect(prompt).toContain(
      JSON.stringify({ id: A, nom: 'Passeport "Vincent"', categorie: "Identité", notes: "", fiche: "Type : passeport" })
    );
    expect(prompt).toContain(`"id":"${B}"`);
  });
});

describe("lireReponseRecherche", () => {
  it("garde les identifiants connus, sans doublon, dans l'ordre", () => {
    expect(lireReponseRecherche({ ids: [B, A, B] }, [A, B])).toEqual([B, A]);
  });

  it("écarte les identifiants inventés et les valeurs invalides", () => {
    expect(lireReponseRecherche({ ids: ["inconnu", 3, null, A] }, [A, B])).toEqual([A]);
  });

  it("renvoie aucun document pour une réponse vide ou illisible", () => {
    expect(lireReponseRecherche({ ids: [] }, [A])).toEqual([]);
    expect(lireReponseRecherche({}, [A])).toEqual([]);
    expect(lireReponseRecherche(null, [A])).toEqual([]);
    expect(lireReponseRecherche({ ids: "x" }, [A])).toEqual([]);
  });
});
