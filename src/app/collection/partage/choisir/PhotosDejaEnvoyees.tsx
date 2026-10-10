"use client";

import { ChoisirCollectionForm } from "./ChoisirCollectionForm";
import { DestinationPartage } from "./DestinationPartage";
import type { TexteTache } from "@/lib/partage/tache";
import type { TypeVideo } from "@/lib/collection/video";
import type { Tables } from "@/lib/supabase/types";

/**
 * Chemin de secours (pas de service worker) : les photos sont déjà dans le
 * bucket des collections. Pour une tâche, on les récupère par leur URL pour
 * les joindre au formulaire ; les fichiers du bucket restent alors orphelins.
 */
export function PhotosDejaEnvoyees({
  photos,
  video,
  collections,
  listes,
  tags,
  texte,
}: {
  photos: string[];
  video: { url: string; thumbnailUrl: string; titre: string; type: TypeVideo } | null;
  collections: Tables<"collections">[];
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  texte: TexteTache;
}) {
  const formulaire = <ChoisirCollectionForm collections={collections} photos={photos} video={video} />;
  if (video || photos.length === 0) return formulaire;
  return (
    <DestinationPartage
      collectionContenu={formulaire}
      obtenirFichiers={() =>
        Promise.all(
          photos.map(async (url, i) => {
            const reponse = await fetch(url);
            if (!reponse.ok) throw new Error("Image introuvable");
            const blob = await reponse.blob();
            return new File([blob], `partage-${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
          })
        )
      }
      listes={listes}
      tags={tags}
      texte={texte}
    />
  );
}
