import { urlAffiche } from "@/lib/films/types";

/** Affiche d'un film (2:3). Décorative : le titre voisin porte le sens. Sans affiche,
 * un fond neutre avec le pictogramme du module garde la grille alignée. */
export function AfficheFilm({
  chemin,
  className = "h-24 w-16",
  taille = "w185",
}: {
  chemin: string | null;
  className?: string;
  taille?: "w185" | "w342";
}) {
  const url = urlAffiche(chemin, taille);
  return (
    <div
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-alt text-ink-3 after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-ink/10 ${className}`}
    >
      {url ? (
        // Affiche TMDB (CDN externe, 185 px de large) : <img> plutôt que next/image, dont l'optimiseur n'apporterait rien ici.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
          <path d="M8 4.5v15M16 4.5v15M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" />
        </svg>
      )}
    </div>
  );
}
