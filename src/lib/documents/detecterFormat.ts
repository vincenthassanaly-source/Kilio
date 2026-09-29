// Reconnaît le format d'après le contenu quand le type MIME est vide ou
// générique : Android n'en fournit pas pour un fichier sans extension dans
// son nom (ex. « Swiss_Life_Insurance_Document »), ce qui faisait rejeter de
// vrais PDF. Signatures : %PDF-, JPEG (FF D8 FF), PNG, GIF, WebP (RIFF…WEBP).
export function detecterFormat(fichier: File, buffer: Uint8Array): "image" | "pdf" | null {
  if (fichier.type.startsWith("image/")) return "image";
  if (fichier.type === "application/pdf") return "pdf";
  if (Buffer.from(buffer.subarray(0, 5)).toString("latin1") === "%PDF-") return "pdf";
  const debut = Buffer.from(buffer.subarray(0, 12));
  const estJpeg = debut[0] === 0xff && debut[1] === 0xd8 && debut[2] === 0xff;
  const estPng = debut.subarray(0, 4).toString("hex") === "89504e47";
  const estGif = debut.subarray(0, 3).toString("latin1") === "GIF";
  const estWebp = debut.subarray(0, 4).toString("latin1") === "RIFF" && debut.subarray(8, 12).toString("latin1") === "WEBP";
  return estJpeg || estPng || estGif || estWebp ? "image" : null;
}
