"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { URL_IMAGES_SPORT } from "@/lib/sport/libelles";
import {
  HAUTEUR_VUE,
  LARGEUR_VUE,
  construireSilhouette,
  lirePoses,
  zonesDuMuscle,
  type PosesExercice,
} from "@/lib/sport/silhouette";
import { ExerciceMedia } from "./exercices/[id]/ExerciceMedia";

const DUREE_CYCLE_MS = 2400;

/** Dessin SVG d'un instant `t` du mouvement (0 = départ, 1 = arrivée). */
function Dessin({ poses, t, muscle, alt }: { poses: PosesExercice; t: number; muscle?: string | null; alt: string }) {
  const { formes, sol } = useMemo(
    () => construireSilhouette(poses, t, muscle ? zonesDuMuscle(muscle) : []),
    [poses, t, muscle],
  );
  const corps = (arriere: boolean) =>
    formes
      .filter((f) => f.arriere === arriere)
      .map((f, i) => {
        const couleur = f.cible ? "var(--accent-sport)" : arriere ? "var(--ink-3)" : "var(--ink)";
        return f.type === "trait" ? (
          <path
            key={i}
            d={f.d}
            stroke={couleur}
            strokeWidth={f.largeur}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <circle key={i} cx={f.cx} cy={f.cy} r={f.r} fill={f.cible ? couleur : "var(--ink)"} />
        );
      });

  return (
    <svg
      viewBox={`0 0 ${LARGEUR_VUE} ${HAUTEUR_VUE}`}
      data-dessin=""
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      className="h-full w-full"
    >
      <ellipse cx={LARGEUR_VUE / 2} cy={sol} rx={70} ry={4} fill="var(--line)" />
      {corps(true)}
      {corps(false)}
    </svg>
  );
}

/**
 * Vignette statique d'un exercice (liste, séance, routine) : pose de départ
 * dessinée, ou photo à défaut de poses validées.
 */
export function VignetteExercice({
  poses,
  image,
  muscle,
  taille,
  rayon = 12,
}: {
  poses: unknown;
  image: string | null;
  muscle?: string | null;
  /** Côté en pixels (carré). */
  taille: number;
  rayon?: number;
}) {
  const dessin = lirePoses(poses);
  return (
    <span
      className="shrink-0 overflow-hidden bg-surface-alt"
      style={{ width: taille, height: taille, borderRadius: rayon }}
    >
      {dessin ? (
        <Dessin poses={dessin} t={0} muscle={muscle} alt="" />
      ) : (
        image && (
          // eslint-disable-next-line @next/next/no-img-element -- images déjà optimisées (WebP 600 px)
          <img
            src={`${URL_IMAGES_SPORT}/${image}`}
            alt=""
            width={taille}
            height={taille}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        )
      )}
    </span>
  );
}

/**
 * Démonstration animée d'un exercice : départ ↔ arrivée en boucle, un tap
 * met en pause ou relance. Avec « réduire les animations », la pose de départ
 * reste fixe et un tap bascule d'une pose à l'autre. Sans poses validées,
 * retombe sur les photos (ExerciceMedia).
 */
export function IllustrationExercice({
  poses,
  photos,
  muscle,
  alt,
}: {
  poses: unknown;
  /** URLs complètes des photos, utilisées si l'exercice n'a pas de poses. */
  photos: string[];
  muscle?: string | null;
  alt: string;
}) {
  const dessin = lirePoses(poses);
  if (!dessin) return <ExerciceMedia urls={photos} alt={alt} />;
  return <DessinAnime poses={dessin} muscle={muscle} alt={alt} />;
}

function DessinAnime({ poses, muscle, alt }: { poses: PosesExercice; muscle?: string | null; alt: string }) {
  const reduireMouvement = useReducedMotion() ?? false;
  const [enPause, setEnPause] = useState(false);
  const [arrivee, setArrivee] = useState(false);
  const [t, setT] = useState(0);

  const anime = !reduireMouvement && !enPause;
  useEffect(() => {
    if (!anime) return;
    let image = 0;
    // Reprend là où l'animation s'est arrêtée (pas de saut au retour de pause).
    const debut = performance.now() - phaseDepuis(t) * DUREE_CYCLE_MS;
    const boucle = (maintenant: number) => {
      const phase = ((maintenant - debut) / DUREE_CYCLE_MS) % 1;
      setT(0.5 - 0.5 * Math.cos(phase * 2 * Math.PI));
      image = requestAnimationFrame(boucle);
    };
    image = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(image);
    // `t` n'est lu qu'à l'entrée dans l'animation : le relire à chaque image la relancerait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime]);

  const libelle = reduireMouvement
    ? "Afficher l'autre position de l'exercice"
    : enPause
      ? "Relancer l'animation"
      : "Mettre l'animation en pause";

  return (
    <button
      type="button"
      aria-label={`${alt} : ${libelle}`}
      onClick={() => (reduireMouvement ? setArrivee((a) => !a) : setEnPause((p) => !p))}
      className="relative block aspect-[3/2] w-full overflow-hidden rounded-[22px] border border-line bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
    >
      <Dessin poses={poses} t={reduireMouvement ? (arrivee ? 1 : 0) : t} muscle={muscle} alt="" />
    </button>
  );
}

/** Phase (0‑1) du cycle correspondant à l'avancement `t` (sens aller), pour reprendre sans saut. */
function phaseDepuis(t: number): number {
  return Math.acos(1 - 2 * Math.min(1, Math.max(0, t))) / (2 * Math.PI);
}
