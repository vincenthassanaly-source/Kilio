"use client";

import { useId, useActionState, useEffect, useRef, useState } from "react";
import { rattacherPhotoACollection, type RattacherPhotoFormState } from "@/app/actions/collections";
import { suggererCollection } from "@/app/actions/collection-rangement";
import { runAction } from "@/lib/actions/runAction";
import type { TypeVideo } from "@/lib/collection/video";
import { LigneChoix } from "@/components/ListeChoix";
import type { Tables } from "@/lib/supabase/types";
import { errorText, input, label as labelClass, primaryButton } from "@/lib/ui";

const initialState: RattacherPhotoFormState = { error: null };

export function ChoisirCollectionForm({
  collections,
  photos,
  video,
}: {
  collections: Tables<"collections">[];
  photos: string[];
  video?: { url: string; thumbnailUrl: string; titre: string; type: TypeVideo } | null;
}) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const [state, formAction, pending] = useActionState(rattacherPhotoACollection, initialState);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [nouvelleCollection, setNouvelleCollection] = useState("");
  // Suggestion de Gemini : « attente » pendant l'appel, puis la collection
  // proposée (ou null si aucune ne convient / l'appel a échoué).
  const [suggestion, setSuggestion] = useState<{ etat: "attente" } | { etat: "fini"; collectionId: string | null }>(
    () => ({ etat: "attente" })
  );
  // Dès que tu choisis toi-même (ou tapes un nom), la suggestion ne touche plus à la sélection.
  const choixManuel = useRef(false);

  const premierePhoto = photos[0] ?? null;
  const nbCollections = collections.length;
  const videoUrl = video?.url;
  const videoThumbnail = video?.thumbnailUrl;
  const videoTitre = video?.titre;
  const videoType = video?.type;

  // Rien à choisir, ou rien à montrer à Gemini : pas d'appel.
  const rienASuggerer = nbCollections === 0 || (!premierePhoto && !videoUrl);

  useEffect(() => {
    if (rienASuggerer) return;
    // Annulation propre à CETTE exécution de l'effet (StrictMode en développement).
    let annule = false;
    (async () => {
      // Avec plusieurs photos, la première suffit à orienter le choix.
      const resultat = await runAction(
        () =>
          suggererCollection({
            photoUrl: videoUrl ? null : premierePhoto,
            video: videoUrl && videoType ? { type: videoType, thumbnailUrl: videoThumbnail ?? "", titre: videoTitre ?? "" } : null,
          }),
        { silencieux: true }
      );
      if (annule) return;
      const suggeree = resultat.ok && resultat.data.statut === "ok" ? resultat.data.collectionId : null;
      setSuggestion({ etat: "fini", collectionId: suggeree });
      if (suggeree && !choixManuel.current) setCollectionId(suggeree);
    })();
    return () => {
      annule = true;
    };
  }, [rienASuggerer, premierePhoto, videoUrl, videoThumbnail, videoTitre, videoType]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {photos.map((url) => (
        <input key={url} type="hidden" name="url" value={url} />
      ))}
      {video && (
        <>
          <input type="hidden" name="video_url" value={video.url} />
          <input type="hidden" name="video_thumbnail" value={video.thumbnailUrl} />
          <input type="hidden" name="video_titre" value={video.titre} />
          <input type="hidden" name="video_type" value={video.type} />
        </>
      )}
      <input type="hidden" name="collection_id" value={collectionId ?? ""} />

      {collections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Collection existante</span>
          {/* Zone vocale toujours montée (annonce), visible seulement pendant la recherche : pas de trou sous le titre. */}
          <p className={!rienASuggerer && suggestion.etat === "attente" ? "text-small text-ink-3" : "sr-only"} aria-live="polite">
            {!rienASuggerer && suggestion.etat === "attente" ? "Gemini cherche la meilleure collection…" : ""}
          </p>
          <div className="flex flex-col gap-1.5">
            {collections.map((collection) => {
              const selected = collectionId === collection.id;
              const suggeree = suggestion.etat === "fini" && suggestion.collectionId === collection.id;
              return (
                <LigneChoix
                  key={collection.id}
                  selected={selected}
                  onSelect={() => {
                    choixManuel.current = true;
                    setCollectionId(collection.id);
                    setNouvelleCollection("");
                  }}
                >
                  <span className={`min-w-0 break-words text-ink ${selected ? "font-semibold" : ""}`}>{collection.nom}</span>
                  {suggeree && (
                    <span className="shrink-0 rounded-full bg-kcal-soft px-2 py-0.5 text-micro font-semibold text-kcal">
                      Suggérée
                    </span>
                  )}
                </LigneChoix>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-nouvelle_collection`} className={labelClass}>
          Nouvelle collection
        </label>
        <input
          id={`${uid}-nouvelle_collection`}
          name="nouvelle_collection"
          value={nouvelleCollection}
          onChange={(e) => {
            choixManuel.current = true;
            setNouvelleCollection(e.target.value);
            setCollectionId(null);
          }}
          placeholder="Nom de la collection"
          className={input}
        />
      </div>

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Ajout..." : "Ajouter"}
      </button>
    </form>
  );
}
