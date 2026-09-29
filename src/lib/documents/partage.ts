// Partage et téléchargement des fichiers d'un document, côté navigateur.
//
// Partager = feuille de partage native du téléphone (Web Share API avec les
// fichiers eux-mêmes : WhatsApp, mail, Drive…), pas un lien. Télécharger =
// enregistrement dans le téléphone. L'attribut `download` d'un lien est
// ignoré pour une URL d'un autre domaine (le stockage Supabase) : on récupère
// donc le fichier en mémoire (fetch → Blob) avant de le proposer.

export type FichierADiffuser = { url: string; nom: string };

const TYPES_PAR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function extensionDe(url: string): string {
  const chemin = url.split("?")[0];
  return chemin.split(".").pop()?.toLowerCase() ?? "";
}

/** Nom lisible et sûr : « Mutuelle 2026 - recto.jpg ». */
export function nomDeFichier(base: string, complement: string | null, url: string): string {
  const propre =
    [base, complement]
      .filter(Boolean)
      .join(" - ")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "document";
  const extension = extensionDe(url);
  return extension ? `${propre}.${extension}` : propre;
}

/** Récupère les fichiers en mémoire, avec le bon type MIME (d'après l'extension). */
export async function chargerFichiers(fichiers: FichierADiffuser[]): Promise<File[]> {
  return Promise.all(
    fichiers.map(async ({ url, nom }) => {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error(`Fichier inaccessible (${reponse.status}).`);
      const blob = await reponse.blob();
      return new File([blob], nom, { type: TYPES_PAR_EXTENSION[extensionDe(url)] ?? blob.type });
    })
  );
}

/** Vrai si le navigateur sait partager ces fichiers (Android/iOS, pas le bureau). */
export function peutPartager(fichiers: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: fichiers })
  );
}

/** Vrai si partagé, faux si la personne a fermé la feuille de partage. */
export async function partager(fichiers: File[], titre: string): Promise<boolean> {
  try {
    await navigator.share({ files: fichiers, title: titre });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    throw err;
  }
}

export function telecharger(fichier: File): void {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = fichier.name;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
