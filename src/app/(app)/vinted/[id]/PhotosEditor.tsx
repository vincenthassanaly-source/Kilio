"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ajouterPhotosAnnonce,
  reordonnerPhotosAnnonce,
  supprimerPhotoAnnonce,
  type AnnonceVinted,
  type PhotoVinted,
} from "@/app/actions/vinted";
import { FadeInImage } from "@/components/FadeInImage";
import { estErreurReseau, runAction } from "@/lib/actions/runAction";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import {
  TAILLE_MAX_REQUETE_OCTETS,
  compresserImages,
  fichiersTropLourds,
  formatTaille,
  repartirEnLots,
} from "@/lib/images/compression";
import { queryKeys } from "@/lib/query/keys";
import { card, errorText, sectionTitle } from "@/lib/ui";
import { PHOTOS_MAX } from "@/lib/vinted/types";

const BOUTON_AJOUT =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-kcal/50 py-3 text-[13px] font-semibold text-kcal transition-colors hover:bg-kcal-soft focus-within:ring-2 focus-within:ring-kcal focus-within:ring-offset-2";
const BOUTON_TUILE =
  "flex h-11 flex-1 items-center justify-center text-ink transition active:scale-[0.95] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-inset";

function CameraIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.6l1-1.7A1.5 1.5 0 0 1 9.4 4.5h5.2a1.5 1.5 0 0 1 1.3.8l1 1.7h1.6A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  );
}

function GalerieIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.4" />
      <path d="M4.5 16.5l4.5-4.5 3 3 3.5-3.5 4.5 4.5" />
    </svg>
  );
}

export function PhotosEditor({ annonceId, photos }: { annonceId: string; photos: PhotoVinted[] }) {
  const uid = useId();
  const queryClient = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);
  const [enCours, startTransition] = useTransition();
  const [etape, setEtape] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const cle = queryKeys.vintedAnnonce(annonceId);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.vinted });
  }

  function majPhotos(fn: (photos: PhotoVinted[]) => PhotoVinted[]) {
    queryClient.setQueryData<AnnonceVinted | null>(cle, (ancienne) => (ancienne ? { ...ancienne, photos: fn(ancienne.photos) } : ancienne));
  }

  // Compression côté client (plafond de 4 Mo des Server Actions), puis envoi par lots.
  function ajouter(files: FileList | null, input: React.RefObject<HTMLInputElement | null>) {
    if (!files || files.length === 0) return;
    const selection = Array.from(files);
    setErreur(null);
    setEtape("Compression…");
    startTransition(async () => {
      try {
        const compressees = await compresserImages(selection);
        const tropLourdes = fichiersTropLourds(compressees);
        const lots = repartirEnLots(compressees.filter((f) => !tropLourdes.includes(f)));
        for (const [i, lot] of lots.entries()) {
          setEtape(lots.length > 1 ? `Envoi ${i + 1}/${lots.length}…` : "Envoi…");
          const formData = new FormData();
          for (const file of lot) formData.append("photos", file);
          const resultat = await ajouterPhotosAnnonce(annonceId, formData);
          if (!resultat.ok) {
            setErreur(resultat.error);
            break;
          }
        }
        if (tropLourdes.length > 0) {
          setErreur(
            `${tropLourdes.length} photo${tropLourdes.length > 1 ? "s" : ""} trop lourde${tropLourdes.length > 1 ? "s" : ""} même compressée${tropLourdes.length > 1 ? "s" : ""} (plus de ${formatTaille(TAILLE_MAX_REQUETE_OCTETS)}) : non envoyée${tropLourdes.length > 1 ? "s" : ""}.`
          );
        }
      } catch (err) {
        setErreur(
          estErreurReseau(err)
            ? "Pas de connexion : les photos n'ont pas été envoyées. Réessaie une fois en ligne."
            : "L'envoi des photos a échoué. Réessaie."
        );
      } finally {
        invalidate();
        setEtape(null);
        if (input.current) input.current.value = "";
      }
    });
  }

  function deplacer(index: number, sens: -1 | 1) {
    const cible = index + sens;
    if (cible < 0 || cible >= photos.length) return;
    const ordonnees = [...photos];
    [ordonnees[index], ordonnees[cible]] = [ordonnees[cible], ordonnees[index]];
    majPhotos(() => ordonnees);
    void runAction(() => reordonnerPhotosAnnonce(annonceId, ordonnees.map((p) => p.id)), {
      erreur: "Impossible d'enregistrer l'ordre des photos.",
    }).then(() => invalidate());
  }

  function retirer(photo: PhotoVinted) {
    supprimerAvecAnnulation({
      texte: "Photo supprimée",
      ariaLabel: "Annuler la suppression de la photo",
      masquer: () => majPhotos((l) => l.filter((p) => p.id !== photo.id)),
      restaurer: () => invalidate(),
      supprimer: () => supprimerPhotoAnnonce(photo.id),
      erreur: "La photo n'a pas pu être supprimée.",
      onSupprime: () => invalidate(),
    });
  }

  const complet = photos.length >= PHOTOS_MAX;

  return (
    <section className={`${card} flex flex-col gap-3`} aria-labelledby={`${uid}-titre`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${uid}-titre`} className={sectionTitle}>
          Photos
        </h2>
        <span className="text-xs tabular-nums text-ink-3">
          {photos.length}/{PHOTOS_MAX}
        </span>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-alt">
              <div className="relative aspect-square">
                <FadeInImage src={photo.url} alt={`Photo ${index + 1}`} fill sizes="33vw" className="object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                  {index === 0 ? "Couverture" : index + 1}
                </span>
              </div>
              <div className="flex divide-x divide-line border-t border-line">
                <button type="button" className={BOUTON_TUILE} disabled={index === 0} onClick={() => deplacer(index, -1)} aria-label={`Déplacer la photo ${index + 1} avant`}>
                  ‹
                </button>
                <button type="button" className={BOUTON_TUILE} disabled={index === photos.length - 1} onClick={() => deplacer(index, 1)} aria-label={`Déplacer la photo ${index + 1} après`}>
                  ›
                </button>
                <button type="button" className={`${BOUTON_TUILE} text-alert`} onClick={() => retirer(photo)} aria-label={`Supprimer la photo ${index + 1}`}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <label className={`${BOUTON_AJOUT} ${enCours || complet ? "pointer-events-none opacity-50" : ""}`}>
          <CameraIcon /> Prendre une photo
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" disabled={enCours || complet} onChange={(e) => ajouter(e.target.files, cameraRef)} />
        </label>
        <label className={`${BOUTON_AJOUT} ${enCours || complet ? "pointer-events-none opacity-50" : ""}`}>
          <GalerieIcon /> Galerie
          <input ref={galerieRef} type="file" accept="image/*" multiple className="sr-only" disabled={enCours || complet} onChange={(e) => ajouter(e.target.files, galerieRef)} />
        </label>
      </div>

      {etape && (
        <p className="text-sm text-ink-2" role="status">
          {etape}
        </p>
      )}
      {erreur && (
        <p className={errorText} role="alert">
          {erreur}
        </p>
      )}
      <p className="text-xs text-ink-3">La première photo sert de couverture. Lumière naturelle, fond neutre, défauts visibles.</p>
    </section>
  );
}
