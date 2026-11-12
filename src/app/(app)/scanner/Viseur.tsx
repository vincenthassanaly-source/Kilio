"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Portal } from "@/components/Portal";
import { useBackClose } from "@/hooks/useBackClose";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { Quad } from "@/lib/scanner/geometrie";
import { ETAT_SUIVI_INITIAL, suivreCadre, type EtatSuivi } from "@/lib/scanner/suivi";
import { capturerPhoto, detecterDepuisVideo, prechargerOpenCv } from "@/lib/scanner/traitement";

/** Pause entre deux détections en direct (après la fin de la précédente) et côté de l'image analysée. */
const PAUSE_ENTRE_DETECTIONS_MS = 120;
const COTE_DETECTION_LIVE_PX = 180;

type Erreur = "refuse" | "indisponible" | null;

/** Cadre détecté sous forme de tracé SVG fermé (même format pour l'attribut `d` et la propriété CSS `d`). */
function cheminQuad(quad: Quad): string {
  return `M${quad.map((p) => `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`).join(" L")} Z`;
}

/**
 * Viseur plein écran : flux caméra arrière, cadre de détection en direct et
 * capture. `onCapture` reçoit l'image complète ; le viseur reste monté (en
 * pause) sous l'écran de recadrage pour enchaîner les pages sans rouvrir la
 * caméra, jusqu'à « Terminer ».
 */
export function Viseur({
  nombrePages,
  enPause,
  onCapture,
  onImporter,
  onClose,
}: {
  nombrePages: number;
  /** Vrai quand l'écran de recadrage est ouvert par-dessus : plus de détection. */
  enPause: boolean;
  onCapture: (image: ImageData) => void;
  onImporter: () => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erreur, setErreur] = useState<Erreur>(null);
  const pisteRef = useRef<MediaStreamTrack | null>(null);
  const [pret, setPret] = useState(false);
  const [enCapture, setEnCapture] = useState(false);
  const [flash, setFlash] = useState(false);
  const [echecCapture, setEchecCapture] = useState(false);
  /** Incrémenté par « Réessayer » : relance l'ouverture de la caméra. */
  const [essai, setEssai] = useState(0);
  const [detection, setDetection] = useState<{ quad: Quad | null; largeur: number; hauteur: number } | null>(null);

  // Reste actif même en pause : l'écran de recadrage empile sa propre entrée
  // d'historique par-dessus. Désactiver celle du viseur ferait un
  // history.back() qui déclencherait aussitôt le « retour » du recadrage.
  useBackClose(true, onClose);
  useDialogFocus(overlayRef, onClose);

  // OpenCV se charge pendant que la caméra s'ouvre ; d'ici là, l'ancienne détection suffit.
  useEffect(() => {
    prechargerOpenCv();
  }, []);

  // Ouverture de la caméra ; le flux est arrêté à la fermeture.
  useEffect(() => {
    let flux: MediaStream | null = null;
    let annule = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur("indisponible");
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (annule) {
          flux.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        pisteRef.current = flux.getVideoTracks()[0] ?? null;
        // Flux coupé par le système (retour d'arrière-plan sur mobile) : on bascule sur l'erreur, avec « Réessayer ».
        if (pisteRef.current) {
          pisteRef.current.onended = () => {
            if (annule) return;
            setPret(false);
            setErreur("indisponible");
          };
        }
        video.srcObject = flux;
        await video.play();
        setPret(true);
      } catch (e) {
        if (annule) return;
        const nom = e instanceof DOMException ? e.name : "";
        setErreur(nom === "NotAllowedError" || nom === "SecurityError" ? "refuse" : "indisponible");
      }
    })();
    return () => {
      annule = true;
      if (pisteRef.current) pisteRef.current.onended = null;
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [essai]);

  // Détection en direct (cadre vert sur le document repéré). Boucle séquentielle : la
  // suivante ne démarre qu'après la fin de la précédente, donc rien ne s'empile si le
  // téléphone est lent. Le cadre est lissé et maintenu entre images (suivi.ts).
  const suivi = useRef<EtatSuivi>(ETAT_SUIVI_INITIAL);
  useEffect(() => {
    if (!pret || enPause) return;
    let arrete = false;
    let minuteur = 0;
    const boucle = () => {
      if (arrete) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const res = detecterDepuisVideo(video, COTE_DETECTION_LIVE_PX);
          if (res) {
            suivi.current = suivreCadre(suivi.current, res.quad, res.largeur, res.hauteur);
            setDetection({ quad: suivi.current.quad, largeur: res.largeur, hauteur: res.hauteur });
          }
        } catch {
          // La détection est un confort : on ignore un échec ponctuel.
        }
      }
      minuteur = window.setTimeout(boucle, PAUSE_ENTRE_DETECTIONS_MS);
    };
    minuteur = window.setTimeout(boucle, 0);
    return () => {
      arrete = true;
      window.clearTimeout(minuteur);
    };
  }, [pret, enPause]);

  function reessayer() {
    setErreur(null);
    setPret(false);
    setEssai((n) => n + 1);
  }

  async function capturer() {
    const video = videoRef.current;
    if (!video || !pret || enCapture) return;
    setEnCapture(true);
    setEchecCapture(false);
    try {
      const image = await capturerPhoto(video, pisteRef.current);
      // Pas d'éclair si le système demande moins de mouvement : un flash blanc est plus gênant qu'une transition.
      // Il n'a lieu qu'après une capture réussie : il ne promet jamais une photo qui n'est pas partie.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 110);
      }
      onCapture(image);
    } catch {
      // Ni photo ni image du flux (caméra coupée entre-temps) : on reste sur le viseur, avec un message.
      setEchecCapture(true);
    } finally {
      setEnCapture(false);
    }
  }

  const quad = detection?.quad ?? null;

  return (
    <Portal>
      <div
        ref={overlayRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Scanner un document"
        className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none"
      >
        <div className="relative min-h-0 flex-1">
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-contain" />
          {detection && quad && !enPause && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${detection.largeur} ${detection.hauteur}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              {/* Chemin plutôt que polygone : la propriété CSS `d` s'anime (Chrome), si bien que le cadre glisse
                  d'une détection à la suivante au lieu de sauter. Ailleurs, l'attribut `d` s'affiche sans animation. */}
              <path
                d={cheminQuad(quad)}
                style={{ d: `path("${cheminQuad(quad)}")`, transition: "d 140ms linear" } as CSSProperties}
                fill="rgba(80, 220, 140, 0.18)"
                stroke="rgb(80, 220, 140)"
                strokeWidth={Math.max(detection.largeur, detection.hauteur) * 0.006}
                strokeLinejoin="round"
              />
            </svg>
          )}

          {/* Éclair blanc très bref à la prise : confirme que la photo est partie. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 bg-white ${flash ? "opacity-60" : "opacity-0 transition-opacity duration-300"}`}
          />

          {!pret && !erreur && (
            <p role="status" className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-8 text-center text-sm text-white/70">
              Ouverture de la caméra…
            </p>
          )}

          {pret && !erreur && !enPause && (
            <p
              className="absolute left-4 top-[calc(env(safe-area-inset-top)+16px)] flex h-11 items-center gap-2 rounded-full bg-black/50 px-4 text-xs font-semibold"
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${quad ? "bg-[rgb(80,220,140)]" : "bg-white/50"}`} />
              {quad ? "Feuille repérée" : "Cherche la feuille…"}
            </p>
          )}

          {echecCapture && !erreur && (
            <p role="alert" className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/60 px-4 py-3 text-center text-sm font-semibold">
              La photo n&apos;a pas pu être prise. Réessaie.
            </p>
          )}

          {erreur && (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center">
              <p className="text-base font-semibold">
                {erreur === "refuse" ? "L'accès à la caméra est refusé." : "La caméra n'est pas disponible."}
              </p>
              <p className="text-sm text-white/70">
                {erreur === "refuse"
                  ? "Autorise la caméra dans les réglages du navigateur, ou importe une photo depuis ta galerie."
                  : "Importe une photo depuis ta galerie pour continuer."}
              </p>
              <button
                type="button"
                onClick={reessayer}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={onImporter}
                className="rounded-2xl bg-white/15 px-5 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Importer une photo
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le viseur"
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] flex h-11 w-11 items-center justify-center rounded-full bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
          <button
            type="button"
            onClick={onImporter}
            className="min-h-11 rounded-2xl bg-white/15 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Importer
          </button>
          <button
            type="button"
            onClick={capturer}
            disabled={!pret || enCapture}
            aria-busy={enCapture}
            aria-label={enCapture ? "Prise de la photo en cours" : "Prendre la photo"}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <span className="h-14 w-14 rounded-full bg-white" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-2xl bg-white/15 px-4 text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {nombrePages > 0 ? `Terminer (${nombrePages})` : "Terminer"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
