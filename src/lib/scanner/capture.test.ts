import { describe, expect, it, vi } from "vitest";
import { capturerPhotoPleine, optionsPhoto, type CaptureurPhoto } from "./capture";

const piste = {} as MediaStreamTrack;
const photo = new Blob(["jpeg"], { type: "image/jpeg" });

describe("optionsPhoto", () => {
  it("demande la plus grande taille du capteur, bornée à 4096 px, proportions gardées", () => {
    expect(optionsPhoto({ imageWidth: { max: 8000 }, imageHeight: { max: 6000 } })).toEqual({ imageWidth: 4096, imageHeight: 3072 });
  });

  it("garde la taille du capteur quand elle est déjà raisonnable", () => {
    expect(optionsPhoto({ imageWidth: { max: 4000 }, imageHeight: { max: 3000 } })).toEqual({ imageWidth: 4000, imageHeight: 3000 });
  });

  it("ne demande rien (taille par défaut) sans capacités lisibles", () => {
    expect(optionsPhoto(undefined)).toEqual({});
    expect(optionsPhoto({ imageWidth: { max: 4000 } })).toEqual({});
  });
});

describe("capturerPhotoPleine", () => {
  const charger = vi.fn(async (b: Blob) => `chargee:${b.size}`);

  it("renvoie la vraie photo décodée quand takePhoto réussit, à la taille maximale du capteur", async () => {
    const takePhoto = vi.fn(async () => photo);
    const captureur: CaptureurPhoto = { takePhoto, getPhotoCapabilities: async () => ({ imageWidth: { max: 4000 }, imageHeight: { max: 3000 } }) };
    const repli = vi.fn(() => "flux");
    await expect(capturerPhotoPleine(piste, () => captureur, charger, repli)).resolves.toBe("chargee:4");
    expect(takePhoto).toHaveBeenCalledWith({ imageWidth: 4000, imageHeight: 3000 });
    expect(repli).not.toHaveBeenCalled();
  });

  it("prend quand même la photo si les capacités sont illisibles", async () => {
    const captureur: CaptureurPhoto = { takePhoto: vi.fn(async () => photo), getPhotoCapabilities: async () => Promise.reject(new Error("non")) };
    await expect(capturerPhotoPleine(piste, () => captureur, charger, () => "flux")).resolves.toBe("chargee:4");
  });

  it("retombe sur l'image du flux sans ImageCapture (iOS, Firefox) ou sans piste", async () => {
    await expect(capturerPhotoPleine(piste, null, charger, () => "flux")).resolves.toBe("flux");
    await expect(capturerPhotoPleine(null, () => ({ takePhoto: async () => photo }), charger, () => "flux")).resolves.toBe("flux");
  });

  it("retombe sur l'image du flux quand takePhoto échoue", async () => {
    const captureur: CaptureurPhoto = { takePhoto: async () => Promise.reject(new Error("refusé")) };
    await expect(capturerPhotoPleine(piste, () => captureur, charger, () => "flux")).resolves.toBe("flux");
  });

  it("retombe sur l'image du flux quand le décodage de la photo échoue", async () => {
    const captureur: CaptureurPhoto = { takePhoto: async () => photo };
    await expect(capturerPhotoPleine(piste, () => captureur, async () => Promise.reject(new Error("mémoire")), () => "flux")).resolves.toBe("flux");
  });

  it("abandonne et retombe sur l'image du flux si la prise dépasse le délai", async () => {
    const captureur: CaptureurPhoto = { takePhoto: () => new Promise<Blob>(() => {}) };
    await expect(capturerPhotoPleine(piste, () => captureur, charger, () => "flux", 30)).resolves.toBe("flux");
  });

  it("retombe sur l'image du flux si le constructeur d'ImageCapture lève", async () => {
    const fabrique = () => {
      throw new Error("piste terminée");
    };
    await expect(capturerPhotoPleine(piste, fabrique, charger, () => "flux")).resolves.toBe("flux");
  });
});
