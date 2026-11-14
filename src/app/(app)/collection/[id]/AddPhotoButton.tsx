"use client";

import { useBackClose } from "@/hooks/useBackClose";
import { useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ajouterLienVideo, uploadCollectionPhotos } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { estErreurReseau } from "@/lib/actions/runAction";
import {
  TAILLE_MAX_REQUETE_OCTETS,
  compresserImages,
  fichiersTropLourds,
  formatTaille,
  repartirEnLots,
} from "@/lib/images/compression";
import { errorText, input, primaryButton } from "@/lib/ui";

const ADD_PHOTO_BUTTON =
  "flex flex-1 cursor-pointer items-center justify-center gap-1.5 min-h-11 rounded-2xl border-[1.5px] border-dashed border-kcal/50 py-3 text-small font-semibold text-kcal transition-colors hover:bg-kcal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kcal has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-kcal";

function CameraIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.6l1-1.7A1.5 1.5 0 0 1 9.4 4.5h5.2a1.5 1.5 0 0 1 1.3.8l1 1.7h1.6A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  );
}

function GalerieIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.4" />
      <path d="M4.5 16.5l4.5-4.5 3 3 3.5-3.5 4.5 4.5" />
    </svg>
  );
}

// Icône neutre (lecture) plutôt qu'un logo de plateforme : le même champ
// accepte indifféremment un lien TikTok ou YouTube.
function VideoIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 8.8v6.4l5-3.2-5-3.2z" />
    </svg>
  );
}

// Deux points d'entrée distincts plutôt qu'un seul input `capture` : sur pas
// mal de navigateurs mobiles, l'attribut `capture` fait sauter directement à
// l'appareil photo sans proposer la galerie. Un input dédié par usage
// (caméra vs galerie) garantit que les deux restent accessibles.
export function AddPhotoButton({
  collectionId,
  onAjoute,
}: {
  collectionId: string;
  /** Appelé une fois les nouveaux éléments rechargés (le parent propose alors de les décrire). */
  onAjoute?: () => void;
}) {
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galerieInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [etape, setEtape] = useState<string | null>(null);
  const [source, setSource] = useState<"camera" | "galerie" | null>(null);

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPending, startVideoTransition] = useTransition();
  const [videoError, setVideoError] = useState<string | null>(null);
  // Cohérent avec AddCollectionToggle : le geste retour ferme le formulaire.
  useBackClose(videoOpen, () => setVideoOpen(false));

  // Résolue une fois la collection rechargée : `onAjoute` lit alors les
  // éléments à jour dans le cache.
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.collections });
    return queryClient.invalidateQueries({ queryKey: queryKeys.collection(collectionId) });
  }

  // Compression côté client avant envoi (vague 1, point « uploads ») : les
  // photos de téléphone (2-5 Mo) dépassaient à deux ou trois le plafond de
  // 4 Mo des Server Actions. Les photos compressées partent ensuite par lots
  // qui tiennent chacun sous ce plafond.
  function handleFiles(
    files: FileList | null,
    inputRef: React.RefObject<HTMLInputElement | null>,
    origine: "camera" | "galerie",
  ) {
    if (!files || files.length === 0) return;
    const selection = Array.from(files);

    setError(null);
    setVideoError(null);
    setSource(origine);
    setEtape("Compression…");
    startTransition(async () => {
      try {
        const compressees = await compresserImages(selection);
        const tropLourdes = fichiersTropLourds(compressees);
        const aEnvoyer = compressees.filter((f) => !tropLourdes.includes(f));
        const lots = repartirEnLots(aEnvoyer);
        for (const [i, lot] of lots.entries()) {
          setEtape(lots.length > 1 ? `Envoi ${i + 1}/${lots.length}…` : "Envoi…");
          const formData = new FormData();
          for (const file of lot) formData.append("photos", file);
          await uploadCollectionPhotos(collectionId, formData);
        }
        if (tropLourdes.length > 0) {
          setError(
            `${tropLourdes.length} photo${tropLourdes.length > 1 ? "s" : ""} trop lourde${tropLourdes.length > 1 ? "s" : ""} même compressée${tropLourdes.length > 1 ? "s" : ""} (plus de ${formatTaille(TAILLE_MAX_REQUETE_OCTETS)}) : non envoyée${tropLourdes.length > 1 ? "s" : ""}.`
          );
        }
        await invalidate();
        if (aEnvoyer.length > 0) onAjoute?.();
      } catch (err) {
        // Contrat T1 : message lisible (celui d'une exception de Server
        // Action est masqué en production) ; les lots déjà envoyés restent.
        setError(
          estErreurReseau(err)
            ? "Pas de connexion : les photos n'ont pas été envoyées. Réessaie une fois en ligne."
            : "L'envoi des photos a échoué. Réessaie."
        );
        invalidate();
      } finally {
        setEtape(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleAjouterVideo(e: React.FormEvent) {
    e.preventDefault();
    const lien = videoUrl.trim();
    if (!lien) return;

    setVideoError(null);
    setError(null);
    startVideoTransition(async () => {
      try {
        await ajouterLienVideo(collectionId, lien);
        await invalidate();
        setVideoUrl("");
        setVideoOpen(false);
        onAjoute?.();
      } catch (err) {
        setVideoError(err instanceof Error ? err.message : "Erreur lors de l'ajout.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        {/* Inputs `sr-only` (et non `hidden`) dans leur label : atteignables au
            clavier et au lecteur d'écran ; l'anneau de focus passe sur le label. */}
        <label className={`${ADD_PHOTO_BUTTON} relative ${isPending ? "opacity-60" : ""}`}>
          <CameraIcon />
          {isPending && source === "camera" ? (etape ?? "Envoi…") : "Appareil photo"}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={isPending}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files, cameraInputRef, "camera")}
          />
        </label>

        <label className={`${ADD_PHOTO_BUTTON} relative ${isPending ? "opacity-60" : ""}`}>
          <GalerieIcon />
          {isPending && source === "galerie" ? (etape ?? "Envoi…") : "Galerie"}
          <input
            ref={galerieInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={isPending}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files, galerieInputRef, "galerie")}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setVideoOpen((v) => !v)}
          aria-expanded={videoOpen}
          className={`${ADD_PHOTO_BUTTON} ${videoPending ? "opacity-60" : ""}`}
        >
          <VideoIcon />
          Lien vidéo
        </button>
      </div>

      {videoOpen && (
        <form onSubmit={handleAjouterVideo} className="flex gap-2">
          <input
            autoFocus
            type="url"
            inputMode="url"
            aria-label="Lien TikTok ou YouTube"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.tiktok.com/… ou https://youtube.com/…"
            disabled={videoPending}
            className={`${input} min-w-0 flex-1`}
          />
          <button type="submit" disabled={videoPending} className={primaryButton}>
            {videoPending ? "Ajout…" : "Ajouter"}
          </button>
        </form>
      )}

      {(error || videoError) && (
        <p className={errorText} role="alert">
          {error ?? videoError}
        </p>
      )}
    </div>
  );
}
