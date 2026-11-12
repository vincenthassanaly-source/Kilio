import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    await user.click(screen.getByRole("button", { name: "Ajouter la vidéo" }));

    const alerte = await screen.findByText("Lien TikTok ou YouTube invalide");
    expect(alerte).toBeInTheDocument();
    expect(screen.queryByText(/Pas de connexion/)).not.toBeInTheDocument();
  });

  it("les champs fichier restent atteignables au clavier", () => {
    rendre();
    expect(screen.getByLabelText("Galerie")).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Lien vidéo" })).toHaveAttribute("aria-expanded", "false");
  });
});
