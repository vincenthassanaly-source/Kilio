// Assemblage d'un PDF multi-pages A4 à partir de pages JPEG, côté navigateur.
// `pdf-lib` est chargé à la demande (import dynamique) : aucun coût pour le
// reste de l'application, et rien ne transite par les fonctions Vercel.

export type QualitePdf = "standard" | "elevee";

/** Réglages d'export : plus grand côté de l'image et qualité JPEG. */
export const PARAMS_QUALITE: Record<QualitePdf, { coteMax: number; jpeg: number }> = {
  standard: { coteMax: 1600, jpeg: 0.7 },
  elevee: { coteMax: 2400, jpeg: 0.88 },
};

/** A4 en points PDF (1 pt = 1/72 pouce). */
export const A4_PORTRAIT = { largeur: 595.28, hauteur: 841.89 };

export type Placement = {
  /** Taille de la page A4 (portrait ou paysage selon l'image). */
  page: { largeur: number; hauteur: number };
  /** Position et taille de l'image sur la page (origine en bas à gauche). */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
};

/**
 * Place une image sur une page A4 : paysage si l'image est plus large que
 * haute, puis mise à l'échelle pour tenir entièrement, centrée.
 */
export function placerSurA4(imgLargeur: number, imgHauteur: number): Placement {
  const paysage = imgLargeur > imgHauteur;
  const page = paysage
    ? { largeur: A4_PORTRAIT.hauteur, hauteur: A4_PORTRAIT.largeur }
    : { ...A4_PORTRAIT };
  const echelle = Math.min(page.largeur / imgLargeur, page.hauteur / imgHauteur);
  const largeur = imgLargeur * echelle;
  const hauteur = imgHauteur * echelle;
  return {
    page,
    x: (page.largeur - largeur) / 2,
    y: (page.hauteur - hauteur) / 2,
    largeur,
    hauteur,
  };
}

/** Génère le PDF : une page A4 par JPEG, dans l'ordre. */
export async function genererPdf(pagesJpeg: Uint8Array[], titre?: string): Promise<Uint8Array> {
  if (pagesJpeg.length === 0) throw new Error("Aucune page à exporter");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  if (titre) pdf.setTitle(titre);
  pdf.setCreator("Kilio");
  pdf.setProducer("Kilio");
  for (const octets of pagesJpeg) {
    const image = await pdf.embedJpg(octets);
    const p = placerSurA4(image.width, image.height);
    const page = pdf.addPage([p.page.largeur, p.page.hauteur]);
    page.drawImage(image, { x: p.x, y: p.y, width: p.largeur, height: p.hauteur });
  }
  return pdf.save();
}
