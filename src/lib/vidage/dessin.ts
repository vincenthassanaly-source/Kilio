// Dessin des traits sur un canvas 2D. Les traits sont en coordonnées logiques
// (largeur de la feuille = 1000) : le canvas applique l'échelle, donc la même
// feuille s'affiche nette sur tous les écrans, en clair comme en sombre.
import { intersecteBande, largeurPoint, type Epaisseur, type PointBrut, type Trait } from "./traits";

export type Rendu = {
  /** Pixels CSS par unité logique. */
  echelle: number;
  /** Ordonnée CSS (dans la feuille) du haut du canvas. */
  top: number;
  dpr: number;
  couleur: string;
};

/** Repère du canvas : unités logiques, origine sur le haut de la fenêtre dessinée. */
export function preparer(ctx: CanvasRenderingContext2D, rendu: Rendu): void {
  ctx.setTransform(rendu.dpr * rendu.echelle, 0, 0, rendu.dpr * rendu.echelle, 0, -rendu.top * rendu.dpr);
  ctx.strokeStyle = rendu.couleur;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function dessinerTrait(ctx: CanvasRenderingContext2D, trait: Trait): void {
  const { p, e } = trait;
  let uniforme = true;
  for (let i = 5; i < p.length; i += 3) {
    if (p[i] !== p[2]) {
      uniforme = false;
      break;
    }
  }
  if (uniforme) {
    // Souris, sans pression : un seul chemin, plus rapide et sans jointures visibles.
    ctx.lineWidth = largeurPoint(e, p[2]);
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 3; i < p.length; i += 3) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
    return;
  }
  for (let i = 3; i < p.length; i += 3) {
    ctx.lineWidth = (largeurPoint(e, p[i - 1]) + largeurPoint(e, p[i + 2])) / 2;
    ctx.beginPath();
    ctx.moveTo(p[i - 3], p[i - 2]);
    ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }
}

/** Segment du trait en cours d'écriture (pression de 0 à 1), tracé au fil du stylet. */
export function dessinerSegmentEnCours(ctx: CanvasRenderingContext2D, e: Epaisseur, a: PointBrut, b: PointBrut): void {
  ctx.lineWidth = (largeurPoint(e, a.pression * 100) + largeurPoint(e, b.pression * 100)) / 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/**
 * Efface le canvas puis redessine les traits qui touchent la fenêtre visible.
 * `effaces` : traits en cours de gommage, affichés très pâles avant retrait.
 */
export function dessinerFeuille(
  ctx: CanvasRenderingContext2D,
  traits: Trait[],
  rendu: Rendu,
  hauteurCss: number,
  effaces?: ReadonlySet<number>
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  preparer(ctx, rendu);
  const yMin = rendu.top / rendu.echelle;
  const yMax = (rendu.top + hauteurCss) / rendu.echelle;
  traits.forEach((trait, indice) => {
    if (!intersecteBande(trait, yMin, yMax)) return;
    ctx.globalAlpha = effaces?.has(indice) ? 0.2 : 1;
    dessinerTrait(ctx, trait);
  });
  ctx.globalAlpha = 1;
}
