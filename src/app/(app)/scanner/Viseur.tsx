"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { useBackClose } from "@/hooks/useBackClose";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { Quad } from "@/lib/scanner/geometrie";
import { ETAT_SUIVI_INITIAL, suivreCadre, type EtatSuivi } from "@/lib/scanner/suivi";
import { capturerImage, detecterDepuisVideo } from "@/lib/scanner/traitement";

/** Pause entre deux détections en direct (après la fin de la précédente) et côté de l'image analysée. */
const PAUSE_ENTRE_DETECTIONS_MS = 120;
const COTE_DETECTION_LIVE_PX = 180;

type Erreur = "refuse" | "indisponible" | null;

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
  const [pret, setPret] = useState(false);
  const [detection, setDetection] = useState<{ quad: Quad | null; largeur: number; hauteur: number } | null>(null);

  // Reste actif même en pause : l'écran de recadrage empile sa propre entrée
  // d'historique par-dessus. Désactiver celle du viseur ferait un
  // history.back() qui déclencherait aussitôt le « retour » du recadrage.
  useBackClose(true, onClose);
  useDialogFocus(overlayRef, onClose);

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
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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

  function capturer() {
    const video = videoRef.current;
    if (!video || !pret) return;
    onCapture(capturerImage(video));
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
              <polygon
                points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="rgba(80, 220, 140, 0.18)"
                stroke="rgb(80, 220, 140)"
                strokeWidth={Math.max(detection.largeur, detection.hauteur) * 0.006}
                strokeLinejoin="round"
              />
            </svg>
          )}

          {erreur && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center">
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
                onClick={onImporter}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
            disabled={!pret}
            aria-label="Prendre la photo"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white transition active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <span className="h-14 w-14 rounded-full bg-white" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-2xl bg-white/15 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {nombrePages > 0 ? `Terminer (${nombrePages})` : "Terminer"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
