// Remise du résultat sur le téléphone : feuille de partage native (Web Share
// API) quand elle accepte des fichiers, sinon téléchargement classique.

/** Nom de fichier sûr : sans caractères interdits, sans extension doublée. */
export function nomFichierSur(nom: string, extension: string, repli = "scan"): string {
  const propre = nom
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  const base = propre.replace(new RegExp(`\\.${extension}$`, "i"), "").trim() || repli;
  return `${base}.${extension}`;
}

/** Noms des pages JPEG : « Mon scan - 1.jpg », « Mon scan - 2.jpg »... */
export function nomsPagesJpeg(nom: string, nombre: number): string[] {
  const base = nomFichierSur(nom, "jpg").replace(/\.jpg$/i, "");
  const chiffres = String(nombre).length;
  return Array.from({ length: nombre }, (_, i) => `${base} - ${String(i + 1).padStart(chiffres, "0")}.jpg`);
}

export function peutPartager(fichiers: File[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: fichiers });
  } catch {
    return false;
  }
}

/**
 * Ouvre la feuille de partage. Renvoie "annule" si l'utilisateur la ferme
 * sans choisir ; toute autre erreur est relancée (l'appelant propose alors
 * le téléchargement).
 */
export async function partager(fichiers: File[], titre: string): Promise<"partage" | "annule"> {
  try {
    await navigator.share({ files: fichiers, title: titre });
    return "partage";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "annule";
    throw e;
  }
}

/** Télécharge un fichier via un lien temporaire. */
export function telecharger(fichier: File): void {
  const url = URL.createObjectURL(fichier);
  const a = document.createElement("a");
  a.href = url;
  a.download = fichier.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Laisse le temps au navigateur de lancer le téléchargement avant de libérer.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Télécharge plusieurs fichiers l'un après l'autre (les navigateurs bloquent les rafales). */
export async function telechargerTous(fichiers: File[]): Promise<void> {
  for (const f of fichiers) {
    telecharger(f);
    await new Promise((r) => setTimeout(r, 400));
  }
}
