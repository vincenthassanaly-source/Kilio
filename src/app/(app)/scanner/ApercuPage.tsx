"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { useBackClose } from "@/hooks/useBackClose";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { PageBrouillon } from "@/lib/scanner/brouillon";
import {
  VUE_INITIALE,
  ZOOM_DOUBLE_TOUCHER,
  bornerVue,
  pincer,
  relatifAuCentre,
  zoomerAutour,
  type Point,
  type Taille,
  type Vue,
} from "@/lib/scanner/zoom";

type Version = "resultat" | "original";

/** Un toucher plus court que ça, et qui a peu bougé, est un « tap » (candidat au double-toucher). */
const TAP_DUREE_MAX_MS = 300;
const TAP_DEPLACEMENT_MAX_PX = 10;
/** Deux taps proches dans le temps et l'espace forment un double-toucher. */
const DOUBLE_TAP_INTERVALLE_MS = 300;
const DOUBLE_TAP_DISTANCE_MAX_PX = 30;
/** Pas de zoom au clavier et à la molette. */
const PAS_ZOOM_CLAVIER = 1.4;
const PAS_ZOOM_MOLETTE = 1.15;

type Geste =
  | { type: "deplacement"; depart: Point; vue0: Vue }
  | { type: "pincement"; milieu0: Point; distance0: number; vue0: Vue };

const milieuDe = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distanceEntre = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Aperçu agrandi d'une page scannée : plein écran noir (comme le viseur et le recadrage), zoom par
 * pincement, double-toucher ou molette, navigation entre les pages, et bascule Original / Résultat
 * pour juger l'effet du filtre. Une page « Original » est la page redressée avant filtre.
 */
export function ApercuPage({
  pages,
  indexInitial,
  onClose,
}: {
  pages: PageBrouillon[];
  indexInitial: number;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.min(Math.max(indexInitial, 0), pages.length - 1));
  const [version, setVersion] = useState<Version>("resultat");
  const [vue, setVue] = useState<Vue>(VUE_INITIALE);
  const [url, setUrl] = useState<string | null>(null);

  const pointeurs = useRef(new Map<number, Point>());
  const geste = useRef<Geste | null>(null);
  const toucher = useRef<{ t: number; x: number; y: number; unique: boolean } | null>(null);
  const dernierTap = useRef<{ t: number; x: number; y: number } | null>(null);

  useBackClose(true, onClose);
  useDialogFocus(overlayRef, onClose);

  const page = pages[index];
  const peutComparer = page.filtre !== "original";
  // Une page sans filtre n'a qu'une version : on ne montre pas la bascule, on affiche le résultat.
  const versionAffichee: Version = peutComparer ? version : "resultat";
  const blob = versionAffichee === "original" ? page.redresse : page.traite;

  // URL d'objet créée dans l'effet et publiée au frame suivant, révoquée au nettoyage (même schéma
  // que la miniature : sûr quand React rejoue les effets en mode strict).
  useEffect(() => {
    const objet = URL.createObjectURL(blob);
    const frame = requestAnimationFrame(() => setUrl(objet));
    return () => {
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(objet);
    };
  }, [blob]);

  const imageTaille: Taille = { largeur: page.largeur, hauteur: page.hauteur };

  function mesures(): { conteneur: Taille; zone: DOMRect } | null {
    const zone = zoneRef.current?.getBoundingClientRect();
    if (!zone || zone.width === 0 || zone.height === 0) return null;
    return { conteneur: { largeur: zone.width, hauteur: zone.height }, zone };
  }

  function aller(cible: number) {
    if (cible < 0 || cible >= pages.length || cible === index) return;
    setIndex(cible);
    setVue(VUE_INITIALE);
    setUrl(null);
  }

  /** Zoom d'un facteur autour d'un point (centre du conteneur par défaut). */
  function zoomer(facteur: number, point: Point = { x: 0, y: 0 }) {
    const m = mesures();
    if (!m) return;
    setVue((v) => zoomerAutour(v, v.echelle * facteur, point, imageTaille, m.conteneur));
  }

  function surPointeurBas(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = mesures();
    if (!m) return;
    const points = [...pointeurs.current.values()];
    if (points.length === 1) {
      toucher.current = { t: performance.now(), x: e.clientX, y: e.clientY, unique: true };
      geste.current = { type: "deplacement", depart: points[0], vue0: vue };
    } else if (points.length === 2) {
      if (toucher.current) toucher.current.unique = false;
      geste.current = {
        type: "pincement",
        milieu0: relatifAuCentre(milieuDe(points[0], points[1]), m.zone),
        distance0: distanceEntre(points[0], points[1]),
        vue0: vue,
      };
    }
  }

  function surPointeurMouvement(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = mesures();
    const g = geste.current;
    if (!m || !g) return;
    const points = [...pointeurs.current.values()];
    if (g.type === "pincement" && points.length >= 2) {
      const milieu = relatifAuCentre(milieuDe(points[0], points[1]), m.zone);
      setVue(pincer(g.vue0, g.milieu0, g.distance0, milieu, distanceEntre(points[0], points[1]), imageTaille, m.conteneur));
    } else if (g.type === "deplacement" && points.length === 1 && g.vue0.echelle > 1) {
      setVue(
        bornerVue(
          { echelle: g.vue0.echelle, x: g.vue0.x + (points[0].x - g.depart.x), y: g.vue0.y + (points[0].y - g.depart.y) },
          imageTaille,
          m.conteneur
        )
      );
    }
  }

  function surPointeurHaut(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointeurs.current.has(e.pointerId)) return;
    const m = mesures();
    const t = toucher.current;
    const fin = performance.now();
    pointeurs.current.delete(e.pointerId);

    // Tap court et immobile d'un seul doigt : deux de suite proches = double-toucher.
    if (t?.unique && m && fin - t.t < TAP_DUREE_MAX_MS && Math.hypot(e.clientX - t.x, e.clientY - t.y) < TAP_DEPLACEMENT_MAX_PX) {
      const precedent = dernierTap.current;
      if (
        precedent &&
        fin - precedent.t < DOUBLE_TAP_INTERVALLE_MS &&
        Math.hypot(e.clientX - precedent.x, e.clientY - precedent.y) < DOUBLE_TAP_DISTANCE_MAX_PX
      ) {
        dernierTap.current = null;
        const point = relatifAuCentre({ x: e.clientX, y: e.clientY }, m.zone);
        setVue((v) => (v.echelle > 1.01 ? VUE_INITIALE : zoomerAutour(v, ZOOM_DOUBLE_TOUCHER, point, imageTaille, m.conteneur)));
      } else {
        dernierTap.current = { t: fin, x: e.clientX, y: e.clientY };
      }
    }

    const restants = [...pointeurs.current.values()];
    if (restants.length === 1) {
      // Un doigt levé après un pincement : le doigt restant reprend en déplacement depuis la vue actuelle.
      geste.current = { type: "deplacement", depart: restants[0], vue0: vue };
      if (toucher.current) toucher.current.unique = false;
    } else if (restants.length === 0) {
      geste.current = null;
      toucher.current = null;
    }
  }

  function surMolette(e: React.WheelEvent<HTMLDivElement>) {
    const m = mesures();
    if (!m) return;
    zoomer(e.deltaY < 0 ? PAS_ZOOM_MOLETTE : 1 / PAS_ZOOM_MOLETTE, relatifAuCentre({ x: e.clientX, y: e.clientY }, m.zone));
  }

  function surTouche(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") aller(index - 1);
    else if (e.key === "ArrowRight") aller(index + 1);
    else if (e.key === "+" || e.key === "=") zoomer(PAS_ZOOM_CLAVIER);
    else if (e.key === "-") zoomer(1 / PAS_ZOOM_CLAVIER);
    else if (e.key === "0") setVue(VUE_INITIALE);
    else return;
    e.preventDefault();
  }

  const boutonRond =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/15 transition active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <Portal>
      <div
        ref={overlayRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Aperçu de la page ${index + 1}`}
        onKeyDown={surTouche}
        className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none"
      >
        <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-2">
          <p aria-live="polite" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold tabular-nums">
            {index + 1} / {pages.length}
          </p>
          <button type="button" onClick={onClose} aria-label="Fermer l'aperçu" className={boutonRond}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div
          ref={zoneRef}
          className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
          onPointerDown={surPointeurBas}
          onPointerMove={surPointeurMouvement}
          onPointerUp={surPointeurHaut}
          onPointerCancel={surPointeurHaut}
          onWheel={surMolette}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), next/image n'apporte rien
            <img
              src={url}
              alt={`Page ${index + 1}, ${versionAffichee === "original" ? "avant filtre" : "résultat"}`}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.echelle})`, transformOrigin: "center", willChange: "transform" }}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          <button
            type="button"
            onClick={() => aller(index - 1)}
            disabled={index === 0}
            aria-label="Page précédente"
            className={`${boutonRond} ${pages.length === 1 ? "invisible" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          {peutComparer ? (
            <div role="group" aria-label="Version de la page" className="flex gap-1 rounded-2xl bg-white/15 p-1">
              {(
                [
                  ["original", "Original"],
                  ["resultat", "Résultat"],
                ] as const
              ).map(([valeur, texte]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={versionAffichee === valeur}
                  onClick={() => setVersion(valeur)}
                  className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    versionAffichee === valeur ? "bg-white text-black" : "text-white/80"
                  }`}
                >
                  {texte}
                </button>
              ))}
            </div>
          ) : (
            <span aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={() => aller(index + 1)}
            disabled={index === pages.length - 1}
            aria-label="Page suivante"
            className={`${boutonRond} ${pages.length === 1 ? "invisible" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </Portal>
  );
}
