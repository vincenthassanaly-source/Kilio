"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { useBackClose } from "@/hooks/useBackClose";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { bornerQuad, quadParDefaut, quadValide, type Quad } from "@/lib/scanner/geometrie";
import { detecterFeuille, imageVersJpeg } from "@/lib/scanner/traitement";

const QUALITE_APERCU = 0.85;

/**
 * Écran de recadrage : la photo avec les 4 coins de la feuille (détectés
 * automatiquement, puis déplaçables au doigt). `onValider` reçoit le quad
 * dans le repère de l'image source.
 */
export function EditeurCoins({
  source,
  restantes,
  enCours,
  erreur,
  onValider,
  onAnnuler,
}: {
  source: ImageData;
  /** Nombre de photos encore à recadrer après celle-ci (import multiple). */
  restantes: number;
  enCours: boolean;
  erreur: string | null;
  onValider: (quad: Quad) => void;
  onAnnuler: () => void;
}) {
  const { width: w, height: h } = source;
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [detecte, setDetecte] = useState<boolean | null>(null);
  const [quad, setQuad] = useState<Quad>(() => quadParDefaut(w, h));
  const [indexActif, setIndexActif] = useState<number | null>(null);

  useBackClose(true, onAnnuler);
  useDialogFocus(overlayRef, onAnnuler);

  // Aperçu JPEG de la source + détection automatique des coins.
  useEffect(() => {
    let annule = false;
    let objectUrl: string | null = null;
    (async () => {
      const blob = await imageVersJpeg(source, QUALITE_APERCU);
      if (annule) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      const trouve = detecterFeuille(source);
      if (annule) return;
      setDetecte(trouve !== null);
      if (trouve) setQuad(trouve);
    })();
    return () => {
      annule = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  function deplacer(e: React.PointerEvent) {
    if (indexActif === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const p = { x: ((e.clientX - rect.left) / rect.width) * w, y: ((e.clientY - rect.top) / rect.height) * h };
    setQuad((q) => {
      const copie = [...q] as Quad;
      copie[indexActif] = p;
      return bornerQuad(copie, w, h);
    });
  }

  const rayon = Math.max(w, h) * 0.028;
  const valide = quadValide(quad);

  return (
    <Portal>
      <div
        ref={overlayRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Recadrer le document"
        className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none"
      >
        <div className="px-5 pt-[calc(env(safe-area-inset-top)+14px)] text-center">
          <p className="text-sm font-semibold">Ajuste les 4 coins sur les bords de la feuille</p>
          <p className="mt-0.5 text-xs text-white/70" aria-live="polite">
            {detecte === null
              ? "Détection en cours…"
              : detecte
                ? "Feuille détectée automatiquement."
                : "Feuille non détectée : place les coins à la main."}
            {restantes > 0 ? ` · ${restantes} autre${restantes > 1 ? "s" : ""} photo${restantes > 1 ? "s" : ""} ensuite` : ""}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-3">
          {url && (
            <div className="relative inline-block max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), next/image n'apporte rien */}
              <img src={url} alt="Photo à recadrer" className="block max-h-[calc(100dvh-13rem)] max-w-full select-none" draggable={false} />
              <svg
                ref={svgRef}
                className="absolute inset-0 h-full w-full touch-none"
                viewBox={`0 0 ${w} ${h}`}
                onPointerMove={deplacer}
                onPointerUp={() => setIndexActif(null)}
                onPointerCancel={() => setIndexActif(null)}
              >
                <polygon
                  points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={valide ? "rgba(80, 220, 140, 0.18)" : "rgba(240, 80, 80, 0.2)"}
                  stroke={valide ? "rgb(80, 220, 140)" : "rgb(240, 80, 80)"}
                  strokeWidth={rayon * 0.18}
                  strokeLinejoin="round"
                />
                {quad.map((p, i) => (
                  <g key={i}>
                    {/* Zone de prise agrandie : un doigt couvre le coin visible. */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={rayon * 2}
                      fill="transparent"
                      onPointerDown={(e) => {
                        (e.target as Element).setPointerCapture(e.pointerId);
                        setIndexActif(i);
                      }}
                      role="presentation"
                    />
                    <circle cx={p.x} cy={p.y} r={rayon} fill="white" stroke="rgb(80, 220, 140)" strokeWidth={rayon * 0.2} pointerEvents="none" />
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>

        {erreur && (
          <p role="alert" className="px-5 pb-2 text-center text-sm text-red-300">
            {erreur}
          </p>
        )}
        {!valide && (
          <p className="px-5 pb-2 text-center text-xs text-red-300">Les coins se croisent : replace-les pour former un quadrilatère.</p>
        )}

        <div className="flex items-center justify-between gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
          <button
            type="button"
            onClick={onAnnuler}
            disabled={enCours}
            className="min-h-11 rounded-2xl bg-white/15 px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => setQuad(quadParDefaut(w, h, 0))}
            disabled={enCours}
            className="min-h-11 rounded-2xl bg-white/15 px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Photo entière
          </button>
          <button
            type="button"
            onClick={() => onValider(quad)}
            disabled={enCours || !valide || detecte === null}
            className="min-h-11 rounded-2xl bg-white px-5 text-sm font-semibold text-black disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {enCours ? "Traitement…" : "Valider"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
