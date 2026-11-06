"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { useBackClose } from "@/hooks/useBackClose";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { bornerQuad, quadParDefaut, quadValide, type Quad } from "@/lib/scanner/geometrie";
import { detecterFeuilleAuto, imageVersJpeg } from "@/lib/scanner/traitement";

const QUALITE_APERCU = 0.85;

type Props = {
  source: ImageData;
  /** Nombre de photos encore à recadrer après celle-ci (import multiple). */
  restantes: number;
  enCours: boolean;
  erreur: string | null;
  onValider: (quad: Quad) => void;
  /** Abandonne cette photo ; les suivantes de la file restent à traiter. */
  onAnnuler: () => void;
};

/** Diamètre de la loupe (px écran), grossissement, et distance au doigt pour ne pas être masquée par lui. */
const DIAMETRE_LOUPE = 112;
const ZOOM_LOUPE = 3;
const DECALAGE_LOUPE = 72;

/**
 * Loupe affichée pendant le déplacement d'un coin : la zone autour du coin,
 * agrandie, avec un réticule, au-dessus du doigt (en dessous s'il n'y a pas la place).
 */
function Loupe({ url, largeur, hauteur, coin, echelle, doigt }: { url: string; largeur: number; hauteur: number; coin: { x: number; y: number }; echelle: number; doigt: { x: number; y: number } }) {
  const marge = 8;
  const gauche = Math.min(Math.max(doigt.x - DIAMETRE_LOUPE / 2, marge), window.innerWidth - DIAMETRE_LOUPE - marge);
  const dessus = doigt.y - DIAMETRE_LOUPE - DECALAGE_LOUPE;
  const haut = dessus >= marge ? dessus : doigt.y + DECALAGE_LOUPE;
  const pas = echelle * ZOOM_LOUPE;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[60] overflow-hidden rounded-full border-2 border-white shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
      style={{
        left: gauche,
        top: haut,
        width: DIAMETRE_LOUPE,
        height: DIAMETRE_LOUPE,
        backgroundImage: `url(${url})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${largeur * pas}px ${hauteur * pas}px`,
        backgroundPosition: `${DIAMETRE_LOUPE / 2 - coin.x * pas}px ${DIAMETRE_LOUPE / 2 - coin.y * pas}px`,
      }}
    >
      {/* Réticule : le coin se trouve exactement au centre. */}
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[rgb(80,220,140)]" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[rgb(80,220,140)]" />
    </div>
  );
}

/**
 * Contenu du recadrage pour UNE photo : état (cadre, aperçu, détection)
 * propre à la photo, remis à zéro par le `key` de l'appelant.
 */
function Recadrage({ source, restantes, enCours, erreur, onValider, onAnnuler }: Props) {
  const { width: w, height: h } = source;
  const svgRef = useRef<SVGSVGElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [detecte, setDetecte] = useState<boolean | null>(null);
  const [quad, setQuad] = useState<Quad>(() => quadParDefaut(w, h));
  // Coin en cours de déplacement : son index, l'échelle d'affichage (pixels écran par pixel
  // d'image, mesurée au début du geste) et la position du doigt, pour placer la loupe.
  const [geste, setGeste] = useState<{ index: number; echelle: number; x: number; y: number } | null>(null);

  // Aperçu JPEG de la source + détection automatique des coins.
  useEffect(() => {
    let annule = false;
    let objectUrl: string | null = null;
    (async () => {
      const blob = await imageVersJpeg(source, QUALITE_APERCU);
      if (annule) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      const trouve = await detecterFeuilleAuto(source);
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
    if (!geste || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const p = { x: ((e.clientX - rect.left) / rect.width) * w, y: ((e.clientY - rect.top) / rect.height) * h };
    setQuad((q) => {
      const copie = [...q] as Quad;
      copie[geste.index] = p;
      return bornerQuad(copie, w, h);
    });
    setGeste({ ...geste, x: e.clientX, y: e.clientY });
  }

  const rayon = Math.max(w, h) * 0.028;
  const valide = quadValide(quad);

  return (
    <>
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+14px)] text-center">
        <p className="text-balance text-sm font-semibold">Ajuste les 4 coins sur les bords de la feuille</p>
        <p className="mt-0.5 text-balance text-xs text-white/70" aria-live="polite">
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
              onPointerUp={() => setGeste(null)}
              onPointerCancel={() => setGeste(null)}
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
                      const rect = svgRef.current?.getBoundingClientRect();
                      setGeste({ index: i, echelle: rect ? rect.width / w : 1, x: e.clientX, y: e.clientY });
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

      {geste && url && <Loupe url={url} largeur={w} hauteur={h} coin={quad[geste.index]} echelle={geste.echelle} doigt={{ x: geste.x, y: geste.y }} />}

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
    </>
  );
}

/**
 * Écran de recadrage plein écran : la photo avec les 4 coins de la feuille
 * (détectés automatiquement, puis déplaçables au doigt). `onValider` reçoit
 * le quad dans le repère de l'image source.
 *
 * Ce conteneur reste monté pendant toute la file d'import : seul le contenu
 * (`Recadrage`, identifié par `cle`) change d'une photo à l'autre. Démonter
 * puis remonter le conteneur entre deux photos ferait un `history.back()`
 * (useBackClose) qui fermerait aussitôt la photo suivante.
 */
export function EditeurCoins({ cle, onFermer, ...props }: Props & {
  /** Identifiant de la photo affichée : change à chaque photo de la file. */
  cle: number;
  /** Retour navigateur / Échap : abandonne toute la file. */
  onFermer: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useBackClose(true, onFermer);
  useDialogFocus(overlayRef, onFermer);

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
        <Recadrage key={cle} {...props} />
      </div>
    </Portal>
  );
}
