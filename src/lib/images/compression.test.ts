import { describe, expect, it } from "vitest";
import { ErreurLectureFichier, compresserFormData } from "./compression";

describe("compresserFormData", () => {
  it("recopie un PDF en mémoire et complète un type MIME vide d'après l'extension", async () => {
    const formData = new FormData();
    formData.append("fichier_recto", new File(["%PDF-1.4 contenu"], "carte.pdf", { type: "" }));

    const total = await compresserFormData(formData, ["fichier_recto"]);

    const recu = formData.get("fichier_recto") as File;
    expect(recu.name).toBe("carte.pdf");
    expect(recu.type).toBe("application/pdf");
    expect(await recu.text()).toBe("%PDF-1.4 contenu");
    expect(total).toBe(recu.size);
  });

  it("signale clairement un fichier devenu illisible au lieu de laisser fetch échouer", async () => {
    const illisible = new File(["x"], "carte.pdf", { type: "application/pdf" });
    illisible.arrayBuffer = () => Promise.reject(new DOMException("permission", "NotReadableError"));
    const formData = new FormData();
    formData.append("fichier_recto", illisible);

    await expect(compresserFormData(formData, ["fichier_recto"])).rejects.toBeInstanceOf(ErreurLectureFichier);
  });

  it("laisse un champ fichier vide tel quel", async () => {
    const formData = new FormData();
    formData.append("fichier_verso", new File([], "", { type: "application/octet-stream" }));

    expect(await compresserFormData(formData, ["fichier_verso"])).toBe(0);
  });
});
