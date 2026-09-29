import { afterEach, describe, expect, it, vi } from "vitest";
import { chargerFichiers, nomDeFichier, partager, peutPartager } from "./partage";

afterEach(() => vi.unstubAllGlobals());

describe("nomDeFichier", () => {
  it("compose un nom lisible avec l'extension de l'URL", () => {
    expect(nomDeFichier("Mutuelle 2026", "recto", "https://x.supabase.co/storage/v1/object/public/documents-fichiers/a1.jpg?t=1")).toBe(
      "Mutuelle 2026 - recto.jpg"
    );
  });

  it("retire les caractères interdits dans un nom de fichier", () => {
    expect(nomDeFichier('Carte: "santé"/2026', null, "https://x/a.pdf")).toBe("Carte santé 2026.pdf");
  });

  it("garde un nom par défaut si le nom est vide", () => {
    expect(nomDeFichier("///", null, "https://x/a.pdf")).toBe("document.pdf");
  });
});

describe("chargerFichiers", () => {
  it("récupère le fichier avec le type MIME déduit de l'extension", async () => {
    // Réponse simulée avec un Blob de l'environnement de test : `Response`
    // (Node) renvoie un Blob que le File de jsdom ne sait pas lire.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(["%PDF-1.4"]) })
    );
    const [fichier] = await chargerFichiers([{ url: "https://x/a.pdf", nom: "Mutuelle.pdf" }]);
    expect(fichier.name).toBe("Mutuelle.pdf");
    expect(fichier.type).toBe("application/pdf");
    expect(await fichier.text()).toBe("%PDF-1.4");
  });

  it("échoue clairement si le fichier est inaccessible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    await expect(chargerFichiers([{ url: "https://x/a.pdf", nom: "a.pdf" }])).rejects.toThrow("404");
  });
});

describe("partage", () => {
  const fichier = new File(["x"], "a.pdf", { type: "application/pdf" });

  it("n'est pas disponible sans Web Share API", () => {
    vi.stubGlobal("navigator", {});
    expect(peutPartager([fichier])).toBe(false);
  });

  it("est disponible quand le navigateur accepte ces fichiers", () => {
    vi.stubGlobal("navigator", { canShare: () => true, share: vi.fn() });
    expect(peutPartager([fichier])).toBe(true);
  });

  it("renvoie faux quand la feuille de partage est fermée", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new DOMException("annulé", "AbortError")) });
    expect(await partager([fichier], "Mutuelle")).toBe(false);
  });

  it("renvoie vrai quand le partage réussit", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockResolvedValue(undefined) });
    expect(await partager([fichier], "Mutuelle")).toBe(true);
  });
});
