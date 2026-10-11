"use client";

import { useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { Modal } from "@/components/Modal";
import { cleAnimationOuNull, urlPoster, urlVideo, type CleAnimation } from "@/lib/musculation/animations";

// Silhouette animée d'un exercice (vidéo WebM transparente). Rien n'est rendu
// si l'exercice n'a pas d'animation. Les vidéos sont précachées par le service
// worker : elles jouent aussi sans réseau.

const TUILE = "relative shrink-0 overflow-hidden rounded-2xl bg-surface-alt";

function Video({ cle, className }: { cle: CleAnimation; className?: string }) {
  return (
    <video
      src={urlVideo(cle)}
      poster={urlPoster(cle)}
      className={className}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
    />
  );
}

/**
 * Séance en cours : miniature qui tourne en boucle ; un tap l'agrandit dans une
 * feuille. Avec « réduire les animations », l'image fixe remplace la boucle.
 */
export function AnimationMiniature({ animation, nom }: { animation: string | null | undefined; nom: string }) {
  const cle = cleAnimationOuNull(animation);
  const [ouvert, setOuvert] = useState(false);
  const reduit = useReducedMotion() ?? false;
  if (!cle) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={`Agrandir l'animation de ${nom}`}
        className={`${TUILE} h-14 w-14 transition active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal`}
      >
        {reduit ? (
          // eslint-disable-next-line @next/next/no-img-element -- image locale précachée, déjà dimensionnée
          <img src={urlPoster(cle)} alt="" className="h-full w-full object-contain" />
        ) : (
          <Video cle={cle} className="h-full w-full object-contain" />
        )}
      </button>
      <AnimatePresence>
        {ouvert && (
          <Modal key="animation-exercice" title={nom} onClose={() => setOuvert(false)}>
            <div className="flex justify-center p-4">
              {reduit ? (
                // eslint-disable-next-line @next/next/no-img-element -- image locale précachée
                <img src={urlPoster(cle)} alt={`Mouvement : ${nom}`} className="aspect-square w-full max-w-[320px] rounded-2xl bg-surface-alt object-contain" />
              ) : (
                <Video cle={cle} className="aspect-square w-full max-w-[320px] rounded-2xl bg-surface-alt object-contain" />
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Listes (sélecteur, éditeur de routine) : image fixe, qui s'anime au tap puis
 * revient à l'image fixe au tap suivant. Ne soumet rien et ne se propage pas.
 */
export function AnimationVignette({ animation, nom }: { animation: string | null | undefined; nom: string }) {
  const cle = cleAnimationOuNull(animation);
  const [joue, setJoue] = useState(false);
  const reduit = useReducedMotion() ?? false;
  if (!cle) return null;
  return (
    <button
      type="button"
      onClick={() => setJoue((j) => !j)}
      aria-pressed={joue}
      aria-label={`${joue ? "Arrêter" : "Voir"} l'animation de ${nom}`}
      className={`${TUILE} h-14 w-14 transition active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal`}
    >
      {joue && !reduit ? (
        <Video cle={cle} className="h-full w-full object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- image locale précachée, déjà dimensionnée
        <img src={urlPoster(cle)} alt="" className="h-full w-full object-contain" />
      )}
    </button>
  );
}
