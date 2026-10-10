import { NextResponse, type NextRequest } from "next/server";
import { recupererLienVideoPartage, uploaderPhotosPartagees } from "@/app/actions/collections";
import { extraireLienVideoDuTexte } from "@/lib/collection/video";
import { texteTacheDepuisPartage } from "@/lib/partage/tache";

// Cible du Web Share Target déclaré dans public/manifest.json : reçoit les
// photos et/ou le lien vidéo TikTok ou YouTube partagés depuis une autre app
// Android (Galerie, app TikTok, app YouTube, navigateur...), uploade les
// photos dans le bucket collection-images et résout les métadonnées du lien
// vidéo (sans rien rattacher à une collection), puis redirige vers l'écran de
// sélection de collection avec un paramètre `photo` par photo uploadée et des
// paramètres `video_*` si un lien a été trouvé.
//
// Quand le service worker est actif, il intercepte ce POST et garde les
// photos de côté (paramètres `attente`/`nb`) : elles sont alors compressées
// côté client par la page de choix. L'upload direct ci-dessous reste le
// chemin de secours (premier lancement, service worker absent).
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const fichiers = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  // TikTok et YouTube envoient le lien partagé via `text` ou `url` selon les
  // versions Android, et le champ texte peut contenir d'autres mots autour du lien.
  const texteRecu = [formData.get("url"), formData.get("text")]
    .map((v) => (typeof v === "string" ? v : ""))
    .join(" ");
  const lienVideo = extraireLienVideoDuTexte(texteRecu);

  const url = new URL("/collection/partage/choisir", request.url);

  // Photos mises de côté par le service worker (public/sw.js) : elles seront
  // compressées et envoyées depuis la page de choix, pas ici.
  const attente = formData.get("attente");
  const nb = Number(formData.get("nb"));
  if (typeof attente === "string" && /^[a-z0-9]{1,32}$/.test(attente) && Number.isInteger(nb) && nb > 0) {
    url.searchParams.set("attente", attente);
    url.searchParams.set("nb", String(Math.min(nb, 50)));
  }

  // Texte et lien partagés avec des images : proposés comme titre et notes si
  // l'utilisateur choisit « Nouvelle tâche » (pas pour un lien vidéo, réservé
  // aux collections).
  if (!lienVideo) {
    const champ = (nom: string) => {
      const v = formData.get(nom);
      return typeof v === "string" ? v : undefined;
    };
    const { titre, notes } = texteTacheDepuisPartage({ text: champ("text"), url: champ("url"), title: champ("title") });
    if (titre) url.searchParams.set("tache_titre", titre);
    if (notes) url.searchParams.set("tache_notes", notes);
  }

  const photosPromise = fichiers.length > 0 ? uploaderPhotosPartagees(fichiers) : null;
  const videoPromise = lienVideo ? recupererLienVideoPartage(lienVideo) : null;

  const [urls, metadonnees] = await Promise.all([photosPromise, videoPromise]);

  if (urls) {
    for (const photoUrl of urls) {
      url.searchParams.append("photo", photoUrl);
    }
  }

  if (metadonnees) {
    url.searchParams.set("video_url", metadonnees.url);
    url.searchParams.set("video_thumbnail", metadonnees.thumbnailUrl);
    url.searchParams.set("video_titre", metadonnees.titre);
    url.searchParams.set("video_type", metadonnees.type);
  }

  return NextResponse.redirect(url, 303);
}
