import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddPhotoButton } from "./AddPhotoButton";

const { ajouterLienVideo, uploadCollectionPhotos, compresserImages } = vi.hoisted(() => ({
  ajouterLienVideo: vi.fn(),
  uploadCollectionPhotos: vi.fn(),
  compresserImages: vi.fn(),
}));

vi.mock("@/app/actions/collections", () => ({ ajouterLienVideo, uploadCollectionPhotos }));
vi.mock("@/lib/images/compression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images/compression")>()),
  compresserImages,
}));

function rendre() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AddPhotoButton collectionId="col-1" />
    </QueryClientProvider>
  );
}

describe("AddPhotoButton - erreurs d'ajout", () => {
  it("l'erreur du lien vidéo remplace une erreur de photo périmée", async () => {
    compresserImages.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    ajouterLienVideo.mockRejectedValueOnce(new Error("Lien TikTok ou YouTube invalide"));
    const user = userEvent.setup({ applyAccept: false });
    rendre();

    const fichier = new File(["x"], "a.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Galerie"), fichier);
    expect(await screen.findByRole("alert")).toHaveTextContent("Pas de connexion");

    await user.click(screen.getByRole("button", { name: "Lien vidéo" }));
    await user.type(screen.getByLabelText("Lien TikTok ou YouTube"), "https://exemple.test/x");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    const alerte = await screen.findByText("Lien TikTok ou YouTube invalide");
    expect(alerte).toBeInTheDocument();
    expect(screen.queryByText(/Pas de connexion/)).not.toBeInTheDocument();
  });

  it("un texte qui n'est pas une URL part au serveur au lieu de la bulle native en anglais", async () => {
    ajouterLienVideo.mockRejectedValueOnce(new Error("Lien TikTok ou YouTube invalide"));
    const user = userEvent.setup({ applyAccept: false });
    rendre();

    await user.click(screen.getByRole("button", { name: "Lien vidéo" }));
    await user.type(screen.getByLabelText("Lien TikTok ou YouTube"), "pas un lien");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(ajouterLienVideo).toHaveBeenCalledWith("col-1", "pas un lien");
    expect(await screen.findByText("Lien TikTok ou YouTube invalide")).toBeInTheDocument();
  });

  it("« Annuler » referme le champ du lien vidéo sans rien envoyer et le vide", async () => {
    ajouterLienVideo.mockClear();
    const user = userEvent.setup({ applyAccept: false });
    rendre();

    await user.click(screen.getByRole("button", { name: "Lien vidéo" }));
    await user.type(screen.getByLabelText("Lien TikTok ou YouTube"), "https://exemple.test/x");
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.queryByLabelText("Lien TikTok ou YouTube")).not.toBeInTheDocument();
    expect(ajouterLienVideo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Lien vidéo" }));
    expect(screen.getByLabelText("Lien TikTok ou YouTube")).toHaveValue("");
  });

  it("les champs fichier restent atteignables au clavier", () => {
    rendre();
    expect(screen.getByLabelText("Galerie")).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Lien vidéo" })).toHaveAttribute("aria-expanded", "false");
  });
});

afterEach(cleanup);
