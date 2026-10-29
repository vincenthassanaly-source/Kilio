// Reconnaît le format d'après le contenu quand le type MIME est vide ou
// générique : Android n'en fournit pas pour un fichier sans extension dans
// son nom (ex. « Swiss_Life_Insurance_Document »), ce qui faisait rejeter de
// vrais PDF. Signatures : %PDF-, JPEG (FF D8 FF), PNG, GIF, WebP (RIFF…WEBP).
// Sans `Buffer` : utilisable aussi côté navigateur (partage vers le vrac).
function texte(octets: Uint8Array, debut: number, fin: number): string {
  return String.fromCharCode(...octets.subarray(debut, fin));
}

export function detecterFormat(fichier: Pick<File, "type">, octets: Uint8Array): "image" | "pdf" | null {
  if (fichier.type.startsWith("image/")) return "image";
  if (fichier.type === "application/pdf") return "pdf";
  if (texte(octets, 0, 5) === "%PDF-") return "pdf";
  const estJpeg = octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff;
  const estPng = octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47;
  const estGif = texte(octets, 0, 3) === "GIF";
  const estWebp = texte(octets, 0, 4) === "RIFF" && texte(octets, 8, 12) === "WEBP";
  return estJpeg || estPng || estGif || estWebp ? "image" : null;
}
