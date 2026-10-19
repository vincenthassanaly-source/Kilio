"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { dessinerFeuille, dessinerSegmentEnCours, preparer, type Rendu } from "@/lib/vidage/dessin";
import {
  LARGEUR_LOGIQUE,
  creerTrait,
  traitsTouches,
  type Epaisseur,
  type PointBrut,
  type Trait,
} from "@/lib/vidage/traits";

export type Outil = "stylo" | "gomme";

type Props = {
  traits: Trait[];
  hauteur: number;
  outil: Outil;
  epaisseur: Epaisseur;
  /** Faux : seul le stylet écrit, le doigt fait défiler la feuille. */
  ecritAuDoigt: boolean;
  onTrait: (trait: Trait) => void;
  onGomme: (indices: number[]) => void;
};

const RAYON_GOMME = 14;
const DPR_MAX = 3;
// Espacement des lignes d'écriture, en unités logiques.
const INTERLIGNE = 70;

type Trace = {
  id: number;
  mode: Outil;
  epaisseur: Epaisseur;
  points: PointBrut[];
  effaces: Set<number>;
  doigt: boolean;
};

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Feuille d'écriture manuscrite. Le conteneur a la hauteur de TOUTE la feuille
 * (le défilement est celui de la page) mais le canvas ne couvre qu'une fenêtre
 * de trois écrans autour de la zone visible, déplacée au défilement : la
 * mémoire reste bornée, même pour une feuille très longue. La fenêtre n'est
 * redessinée que lorsque la zone visible approche de son bord, donc le
 * défilement lui-même reste fluide (composé par le navigateur).
 *
 * Le stylet écrit ; le doigt fait défiler (sauf option « écrire au doigt »).
 * `touch-action` s'applique aussi au stylet : pour qu'il écrive au lieu de
 * faire défiler, les touchers de type « stylus » sont interceptés en natif.
 */
export function FeuilleCanvas({ traits, hauteur, outil, epaisseur, ecritAuDoigt, onTrait, onGomme }: Props) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [largeur, setLargeur] = useState(0);
  const echelle = largeur / LARGEUR_LOGIQUE;

  // Dernières valeurs lues par les écouteurs natifs et les rAF, sans les réabonner.
  const vue = useRef({ traits, hauteur, echelle, outil, epaisseur, ecritAuDoigt, onTrait, onGomme });
  const fenetre = useRef<{ top: number; hauteur: number; dpr: number; largeur: number } | null>(null);
  const rendu = useRef<Rendu | null>(null);
  const trace = useRef<Trace | null>(null);
  const rafDefilement = useRef(0);
  const rafGomme = useRef(0);

  const rafraichir = useCallback((force: boolean) => {
    const canvas = canvasRef.current;
    const conteneur = conteneurRef.current;
    const v = vue.current;
    if (!canvas || !conteneur || v.echelle <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hauteurCss = v.hauteur * v.echelle;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const zone = conteneur.closest("main")?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
    const boite = conteneur.getBoundingClientRect();
    const hautVisible = Math.max(0, zone.top - boite.top);
    const basVisible = Math.min(hauteurCss, zone.bottom - boite.top);
    const ecran = Math.max(300, zone.bottom - zone.top);
    const hauteurCanvas = Math.round(Math.min(hauteurCss, 3 * ecran));

    const f = fenetre.current;
    if (!force && f && f.hauteur === hauteurCanvas && f.dpr === dpr && f.largeur === largeur) {
      const finFenetre = f.top + f.hauteur;
      const margeHaut = f.top > 0 ? 0.25 * ecran : 0;
      const margeBas = finFenetre < hauteurCss ? 0.25 * ecran : 0;
      if (hautVisible >= f.top + margeHaut && basVisible <= finFenetre - margeBas) return;
    }

    const top = Math.round(borner(hautVisible - ecran, 0, Math.max(0, hauteurCss - hauteurCanvas)));
    const w = Math.round(largeur * dpr);
    const h = Math.round(hauteurCanvas * dpr);
    // Redimensionner efface le canvas et réinitialise son contexte.
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    canvas.style.width = `${largeur}px`;
    canvas.style.height = `${hauteurCanvas}px`;
    canvas.style.transform = `translateY(${top}px)`;
    fenetre.current = { top, hauteur: hauteurCanvas, dpr, largeur };
    rendu.current = { echelle: v.echelle, top, dpr, couleur: getComputedStyle(canvas).color };
    dessinerFeuille(ctx, v.traits, rendu.current, hauteurCanvas, trace.current?.effaces);
  }, [largeur]);

  // Mesure de la largeur disponible → échelle.
  useLayoutEffect(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur) return;
    const mesurer = () => setLargeur(conteneur.clientWidth);
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(conteneur);
    return () => observateur.disconnect();
  }, []);

  // Redessin complet quand le contenu, la taille ou l'échelle changent.
  useLayoutEffect(() => {
    vue.current = { traits, hauteur, echelle, outil, epaisseur, ecritAuDoigt, onTrait, onGomme };
    fenetre.current = null;
    rafraichir(true);
  }, [traits, hauteur, echelle, outil, epaisseur, ecritAuDoigt, onTrait, onGomme, rafraichir]);

  // Défilement de la page, changement de thème (l'encre suit --ink) et rotation.
  useEffect(() => {
    const conteneur = conteneurRef.current;
    const parent = conteneur?.closest("main");
    const auDefilement = () => {
      if (rafDefilement.current) return;
      rafDefilement.current = requestAnimationFrame(() => {
        rafDefilement.current = 0;
        rafraichir(false);
      });
    };
    const auChangement = () => rafraichir(true);
    parent?.addEventListener("scroll", auDefilement, { passive: true });
    window.addEventListener("resize", auDefilement);
    const theme = new MutationObserver(auChangement);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      parent?.removeEventListener("scroll", auDefilement);
      window.removeEventListener("resize", auDefilement);
      theme.disconnect();
      cancelAnimationFrame(rafDefilement.current);
      cancelAnimationFrame(rafGomme.current);
    };
  }, [rafraichir]);

  // Touchers du stylet : ni défilement de la page, ni balayage entre onglets.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const intercepter = (ev: TouchEvent) => {
      const touches = Array.from(ev.changedTouches) as Array<Touch & { touchType?: string }>;
      if (!vue.current.ecritAuDoigt && !touches.some((t) => t.touchType === "stylus")) return;
      if (ev.cancelable) ev.preventDefault();
      ev.stopPropagation();
    };
    const evenements = ["touchstart", "touchmove", "touchend", "touchcancel"] as const;
    for (const nom of evenements) canvas.addEventListener(nom, intercepter, { passive: false });
    return () => {
      for (const nom of evenements) canvas.removeEventListener(nom, intercepter);
    };
  }, []);

  function versLogique(e: { clientX: number; clientY: number }) {
    const boite = conteneurRef.current!.getBoundingClientRect();
    const v = vue.current;
    return {
      x: borner((e.clientX - boite.left) / v.echelle, 0, LARGEUR_LOGIQUE),
      y: borner((e.clientY - boite.top) / v.echelle, 0, v.hauteur),
    };
  }

  // Un stylet transmet sa pression ; souris et doigt n'en ont pas (0,5 par défaut).
  const pression = (e: PointerEvent | React.PointerEvent) =>
    e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;

  function gommerEn(x: number, y: number) {
    const t = trace.current;
    if (!t) return;
    const avant = t.effaces.size;
    for (const indice of traitsTouches(vue.current.traits, x, y, RAYON_GOMME)) t.effaces.add(indice);
    if (t.effaces.size === avant || rafGomme.current) return;
    rafGomme.current = requestAnimationFrame(() => {
      rafGomme.current = 0;
      rafraichir(true);
    });
  }

  function auContact(e: React.PointerEvent<HTMLCanvasElement>) {
    const v = vue.current;
    if (trace.current) return;
    if (e.pointerType === "touch" && !v.ecritAuDoigt) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Bouton gomme du stylet (ou bouton latéral du S Pen) : gomme le temps du contact.
    const gomme = v.outil === "gomme" || (e.buttons & 32) !== 0 || (e.pointerType === "pen" && (e.buttons & 2) !== 0);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    const { x, y } = versLogique(e);
    const point: PointBrut = { x, y, pression: pression(e) };
    trace.current = {
      id: e.pointerId,
      mode: gomme ? "gomme" : "stylo",
      epaisseur: v.epaisseur,
      points: [point],
      effaces: new Set(),
      doigt: e.pointerType === "touch",
    };
    if (gomme) {
      gommerEn(x, y);
    } else {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && rendu.current) {
        preparer(ctx, rendu.current);
        dessinerSegmentEnCours(ctx, v.epaisseur, point, point);
      }
    }
  }

  function enMouvement(e: React.PointerEvent<HTMLCanvasElement>) {
    const t = trace.current;
    if (!t || t.id !== e.pointerId) return;
    const groupe = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const evenements = groupe.length > 0 ? groupe : [e.nativeEvent];
    const ctx = canvasRef.current?.getContext("2d");
    for (const ev of evenements) {
      const { x, y } = versLogique(ev);
      if (t.mode === "gomme") {
        gommerEn(x, y);
        continue;
      }
      const suivant: PointBrut = { x, y, pression: pression(ev) };
      if (ctx && rendu.current) {
        preparer(ctx, rendu.current);
        dessinerSegmentEnCours(ctx, t.epaisseur, t.points[t.points.length - 1], suivant);
      }
      t.points.push(suivant);
    }
  }

  function aLaFin(e: React.PointerEvent<HTMLCanvasElement>, annule: boolean) {
    const t = trace.current;
    if (!t || t.id !== e.pointerId) return;
    trace.current = null;
    const v = vue.current;
    if (t.mode === "gomme") {
      if (t.effaces.size > 0) v.onGomme([...t.effaces]);
      else rafraichir(true);
      return;
    }
    // Doigt interrompu par le navigateur (défilement repris) : on jette le trait partiel.
    if (annule && t.doigt) {
      rafraichir(true);
      return;
    }
    v.onTrait(creerTrait(t.epaisseur, t.points));
  }

  const interligne = INTERLIGNE * echelle;

  return (
    <div
      ref={conteneurRef}
      className="relative w-full overflow-hidden rounded-[22px] border border-line bg-surface shadow-card"
      style={{
        height: hauteur * echelle,
        backgroundImage:
          interligne > 4
            ? `repeating-linear-gradient(to bottom, transparent 0, transparent ${interligne - 1}px, var(--line) ${interligne - 1}px, var(--line) ${interligne}px)`
            : undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Feuille du soir : écris ici au stylet"
        className="absolute left-0 top-0 select-none text-ink"
        style={{
          touchAction: ecritAuDoigt ? "none" : "pan-y",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
        }}
        onPointerDown={auContact}
        onPointerMove={enMouvement}
        onPointerUp={(e) => aLaFin(e, false)}
        onPointerCancel={(e) => aLaFin(e, true)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
