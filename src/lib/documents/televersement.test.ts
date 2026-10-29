import { afterEach, describe, expect, it, vi } from "vitest";
import { ErreurTeleversement, televerserVersUrlSignee } from "./televersement";

const URL_SIGNEE = "https://stockage.test/storage/v1/object/upload/sign/documents-fichiers/a.pdf?token=t";

afterEach(() => vi.unstubAllGlobals());

describe("televerserVersUrlSignee", () => {
  it("envoie le fichier en PUT multipart, sans en-tête d'authentification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await televerserVersUrlSignee(URL_SIGNEE, new Blob(["%PDF-1.4"], { type: "application/pdf" }), "application/pdf");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(URL_SIGNEE);
    expect(options.method).toBe("PUT");
    expect(options.headers).toEqual({ "x-upsert": "false" });
    expect(options.body).toBeInstanceOf(FormData);
    const fichier = (options.body as FormData).get("");
    expect(fichier).toBeInstanceOf(Blob);
    expect((fichier as Blob).type).toBe("application/pdf");
  });

  it("force le type du fichier quand le navigateur n'en donne pas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await televerserVersUrlSignee(URL_SIGNEE, new Blob(["%PDF-1.4"], { type: "" }), "application/pdf");

    expect(((fetchMock.mock.calls[0][1].body as FormData).get("") as Blob).type).toBe("application/pdf");
  });

  it("retente une fois quand le réseau lâche, puis réussit", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(televerserVersUrlSignee(URL_SIGNEE, new Blob(["x"]), "image/jpeg")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("échoue avec un message clair après deux coupures réseau", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(televerserVersUrlSignee(URL_SIGNEE, new Blob(["x"]), "image/jpeg")).rejects.toThrow(
      "Pas de connexion"
    );
  });

  it("ne rejoue pas un refus du stockage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetchMock);

    const erreur = await televerserVersUrlSignee(URL_SIGNEE, new Blob(["x"]), "image/jpeg").catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurTeleversement);
    expect(erreur.message).toContain("403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
