import { FadeInImage } from "@/components/FadeInImage";
import { estTypeVideo } from "@/lib/collection/video";
import type { ApercuItem } from "@/app/actions/collections";

function PhotoPlaceholderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.3" />
      <path d="M4.5 16.5l4.5-4.5 3 3 3.5-3.5 4.5 4.5" />
    </svg>
  );
}

// Mosaïque de couverture d'une collection, façon Raindrop : jusqu'à 4
// vignettes selon le nombre de photos disponibles.
export function CollectionMosaic({
  photos,
  viewTransitionName,
}: {
  photos: ApercuItem[];
  viewTransitionName?: string;
}) {
  if (photos.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-line bg-surface-alt">
        <PhotoPlaceholderIcon />
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-alt">
        <FadeInImage
          src={photos[0].url}
          alt=""
          fill
          sizes="50vw"
          unoptimized={estTypeVideo(photos[0].type)}
          style={{ viewTransitionName }}
          className="object-cover"
        />
      </div>
    );
  }

  if (photos.length === 2) {
    return (
      <div className="grid aspect-square grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border border-line bg-surface-alt">
        {photos.map((photo, i) => (
          <div key={i} className="relative h-full w-full">
            <FadeInImage
              src={photo.url}
              alt=""
              fill
              sizes="25vw"
              unoptimized={estTypeVideo(photo.type)}
              style={i === 0 ? { viewTransitionName } : undefined}
              className="object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  if (photos.length === 3) {
    return (
      <div className="grid aspect-square grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border border-line bg-surface-alt">
        <div className="relative row-span-2 h-full w-full">
          <FadeInImage
            src={photos[0].url}
            alt=""
            fill
            sizes="25vw"
            unoptimized={estTypeVideo(photos[0].type)}
            style={{ viewTransitionName }}
            className="object-cover"
          />
        </div>
        <div className="grid grid-rows-2 gap-0.5">
          <div className="relative h-full w-full">
            <FadeInImage
              src={photos[1].url}
              alt=""
              fill
              sizes="25vw"
              unoptimized={estTypeVideo(photos[1].type)}
              className="object-cover"
            />
          </div>
          <div className="relative h-full w-full">
            <FadeInImage
              src={photos[2].url}
              alt=""
              fill
              sizes="25vw"
              unoptimized={estTypeVideo(photos[2].type)}
              className="object-cover"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border border-line bg-surface-alt">
      {photos.slice(0, 4).map((photo, i) => (
        <div key={i} className="relative h-full w-full">
          <FadeInImage
            src={photo.url}
            alt=""
            fill
            sizes="25vw"
            unoptimized={estTypeVideo(photo.type)}
            style={i === 0 ? { viewTransitionName } : undefined}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
