import { afterEach, describe, expect, it, vi } from "vitest";
import { nomFichierSur, nomsPagesJpeg, partager, peutPartager } from "./partage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("nomFichierSur", () => {
  it("ajoute l'extension et retire les caractères interdits", () => {
    expect(nomFichierSur('Facture: EDF/2026 <ok>?', "pdf")).toBe("Facture EDF 2026 ok.pdf");
  });

  it("n'ajoute pas l'extension deux fois", () => {
    expect(nomFichierSur("contrat.PDF", "pdf")).toBe("contrat.pdf");
  });

  it("retombe sur un nom par défaut si le nom est vide", () => {
    expect(nomFichierSur("  ...  ", "pdf")).toBe("scan.pdf");
    expect(nomFichierSur("", "pdf", "document")).toBe("document.pdf");
  });

  it("tronque les noms trop longs", () => {
    expect(nomFichierSur("a".repeat(300), "pdf").length).toBeLessThanOrEqual(84);
  });
});

describe("nomsPagesJpeg", () => {
  it("numérote les pages avec un remplissage commun", () => {
    expect(nomsPagesJpeg("Bail", 3)).toEqual(["Bail - 1.jpg", "Bail - 2.jpg", "Bail - 3.jpg"]);
    expect(nomsPagesJpeg("Bail", 10)[0]).toBe("Bail - 01.jpg");
  });
});

describe("peutPartager / partager", () => {
  const fichier = new File(["x"], "a.pdf", { type: "application/pdf" });

  it("est faux sans Web Share API", () => {
    vi.stubGlobal("navigator", {});
    expect(peutPartager([fichier])).toBe(false);
  });

  it("suit canShare quand l'API existe", () => {
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => true });
    expect(peutPartager([fichier])).toBe(true);
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => false });
    expect(peutPartager([fichier])).toBe(false);
  });

  it("renvoie « annule » quand l'utilisateur ferme la feuille", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new DOMException("annulé", "AbortError")),
      canShare: () => true,
    });
    await expect(partager([fichier], "Scan")).resolves.toBe("annule");
  });

  it("relance les autres erreurs", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new Error("boom")),
      canShare: () => true,
    });
    await expect(partager([fichier], "Scan")).rejects.toThrow("boom");
  });

  it("renvoie « partage » en cas de succès", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    await expect(partager([fichier], "Scan")).resolves.toBe("partage");
    expect(share).toHaveBeenCalledWith({ files: [fichier], title: "Scan" });
  });
});
