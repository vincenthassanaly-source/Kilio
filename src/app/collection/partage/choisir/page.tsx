import { getCollections } from "@/app/actions/collections";
import { getListes, getTags } from "@/app/actions/taches";
import { PhotosDejaEnvoyees } from "./PhotosDejaEnvoyees";
import { PhotosPartageesEnAttente } from "./PhotosPartageesEnAttente";
import { FadeInImage } from "@/components/FadeInImage";
import { estTypeVideo } from "@/lib/collection/video";
import { screenTitle } from "@/lib/ui";

// Atterrissage du Web Share Target (partage natif Android) : reçoit les
// urls des photos déjà uploadées par la Route Handler /collection/partage
// (query param `photo`, répété une fois par photo) et/ou les métadonnées
// d'un lien vidéo TikTok ou YouTube partagé (query params `video_url`/
// `video_thumbnail`/`video_titre`/`video_type`), et laisse choisir entre une
// collection (existante ou créée à la volée) et une nouvelle tâche avec les
// images jointes (`tache_titre`/`tache_notes` : texte partagé en valeurs de départ).
export default async function ChoisirCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{
    photo?: string | string[];
    video_url?: string;
    video_thumbnail?: string;
    video_titre?: string;
    video_type?: string;
    tache_titre?: string;
    tache_notes?: string;
    attente?: string;
    nb?: string;
  }>;
}) {
  const { photo, video_url, video_thumbnail, video_titre, video_type, tache_titre, tache_notes, attente, nb } = await searchParams;
  // Photos gardées par le service worker, à compresser et envoyer côté client.
  const nbEnAttente = Number(nb);
  const enAttente =
    attente && /^[a-z0-9]{1,32}$/.test(attente) && Number.isInteger(nbEnAttente) && nbEnAttente > 0
      ? { id: attente, nb: Math.min(nbEnAttente, 50) }
      : null;
  const photos = photo === undefined ? [] : Array.isArray(photo) ? photo : [photo];
  const video =
    video_url && video_thumbnail && video_type && estTypeVideo(video_type)
      ? { url: video_url, thumbnailUrl: video_thumbnail, titre: video_titre ?? "", type: video_type }
      : null;
  const [collections, listes, tags] = await Promise.all([getCollections(), getListes(), getTags()]);
  const texte = { titre: tache_titre ?? "", notes: tache_notes ?? "" };

  return (
    <div
      className="flex-1 overflow-y-auto px-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <div className="flex flex-col gap-4">
        <h1 className={screenTitle}>{video ? "Ajouter à une collection" : "Que faire de ce partage ?"}</h1>

        {enAttente ? (
          <PhotosPartageesEnAttente
            id={enAttente.id}
            nb={enAttente.nb}
            collections={collections}
            listes={listes}
            tags={tags}
            texte={texte}
            video={video}
          />
        ) : photos.length === 0 && !video ? (
          <p className="text-ink-2">Rien reçu.</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((url) => (
                <FadeInImage
                  key={url}
                  src={url}
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                />
              ))}
              {video && (
                <div className="relative h-24 w-24 shrink-0">
                  <FadeInImage
                    src={video.thumbnailUrl}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                    className="h-24 w-24 rounded-2xl object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {video.type === "youtube" ? "YouTube" : "TikTok"}
                  </span>
                </div>
              )}
            </div>
            <PhotosDejaEnvoyees
              photos={photos}
              video={video}
              collections={collections}
              listes={listes}
              tags={tags}
              texte={texte}
            />
          </>
        )}
      </div>
    </div>
  );
}
