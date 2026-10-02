"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const INTERVALLE_MS = 1000;

/**
 * Démonstration d'un exercice : deux images (départ / arrivée) en fondu
 * croisé en boucle. Toucher l'image met l'animation en pause ou la relance.
 * Avec « réduire les animations », la première image reste fixe et un tap
 * bascule d'une image à l'autre.
 */
export function ExerciceMedia({ urls, alt }: { urls: string[]; alt: string }) {
  const reduireMouvement = useReducedMotion() ?? false;
  const [image, setImage] = useState(0);
  const [enPause, setEnPause] = useState(false);

  const anime = urls.length > 1 && !reduireMouvement && !enPause;
  useEffect(() => {
    if (!anime) return;
    const minuteur = setInterval(() => setImage((i) => (i + 1) % urls.length), INTERVALLE_MS);
    return () => clearInterval(minuteur);
  }, [anime, urls.length]);

  if (urls.length === 0) {
    return (
      <div className="flex aspect-[3/2] w-full items-center justify-center rounded-[22px] border border-line bg-surface-alt text-sm text-ink-2">
        Pas d&apos;image pour cet exercice
      </div>
    );
  }

  const interactif = urls.length > 1;
  const libelle = reduireMouvement
    ? "Afficher l'autre image de l'exercice"
    : enPause
      ? "Relancer l'animation"
      : "Mettre l'animation en pause";

  return (
    <button
      type="button"
      disabled={!interactif}
      aria-label={interactif ? `${alt} : ${libelle}` : alt}
      onClick={() => (reduireMouvement ? setImage((i) => (i + 1) % urls.length) : setEnPause((p) => !p))}
      className="relative block aspect-[3/2] w-full overflow-hidden rounded-[22px] border border-line bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
    >
      {urls.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- images déjà optimisées (WebP 600 px) dans Supabase Storage
        <img
          key={url}
          src={url}
          alt=""
          width={600}
          height={400}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
            index === image ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </button>
  );
}
