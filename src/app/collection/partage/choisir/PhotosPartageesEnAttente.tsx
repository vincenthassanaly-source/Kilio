"use client";

import { useEffect, useRef, useState } from "react";
import { televerserPhotosPartagees } from "@/app/actions/collections";
import { runAction } from "@/lib/actions/runAction";
import { compresserImages, fichiersTropLourds, repartirEnLots } from "@/lib/images/compression";
import type { TypeVideo } from "@/lib/collection/video";
import type { Tables } from "@/lib/supabase/types";
import { errorText, secondaryButton } from "@/lib/ui";
import { ChoisirCollectionForm } from "./ChoisirCollectionForm";
import { DestinationPartage } from "./DestinationPartage";
import type { TexteTache } from "@/lib/partage/tache";

// Même nom que dans public/sw.js.
const CACHE_PARTAGE = "kilio-partage-en-attente";

type Etat =
  | { phase: "lecture" }
  | { phase: "envoi"; apercus: string[]; message: string }
  | { phase: "pret"; urls: string[]; avertissement: string | null }
  | { phase: "erreur"; message: string };

async function lireFichiersEnAttente(id: string, nb: number): Promise<File[]> {
  const cache = await caches.open(CACHE_PARTAGE);
  const fichiers: File[] = [];
  for (let i = 0; i < nb; i++) {
    const reponse = await cache.match(`/__partage/${id}/${i}`);
    if (!reponse) continue;
    const blob = await reponse.blob();
    const nom = decodeURIComponent(reponse.headers.get("X-Nom-Fichier") ?? `photo-${i + 1}.jpg`);
    fichiers.push(new File([blob], nom, { type: blob.type || "image/jpeg" }));
  }
  return fichiers;
}

async function oublierFichiersEnAttente(id: string, nb: number) {
  const cache = await caches.open(CACHE_PARTAGE);
  await Promise.all(Array.from({ length: nb }, (_, i) => cache.delete(`/__partage/${id}/${i}`)));
}

/**
 * Choix de destination des photos mises de côté par le service worker :
 * collection (envoi par lots, ci-dessous) ou nouvelle tâche (fichiers
 * compressés puis joints au formulaire de tâche, envoyés à sa validation).
 */
export function PhotosPartageesEnAttente({
  id,
  nb,
  collections,
  listes,
  tags,
  texte,
  video,
}: {
  id: string;
  nb: number;
  collections: Tables<"collections">[];
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  texte: TexteTache;
  video: { url: string; thumbnailUrl: string; titre: string; type: TypeVideo } | null;
}) {
  const collectionContenu = <EnvoiVersCollection id={id} nb={nb} collections={collections} video={video} />;
  // Un lien vidéo est réservé aux collections : pas de choix.
  if (video) return collectionContenu;
  return (
    <DestinationPartage
      collectionContenu={collectionContenu}
      obtenirFichiers={async () => compresserImages(await lireFichiersEnAttente(id, nb))}
      apresTache={() => void oublierFichiersEnAttente(id, nb).catch(() => {})}
      listes={listes}
      tags={tags}
      texte={texte}
    />
  );
}

/**
 * Photos reçues par le partage natif et mises de côté par le service worker :
 * compressées ici avec l'utilitaire partagé (lib/images/compression.ts),
 * envoyées par lots sous le plafond des Server Actions, puis présentées au
 * formulaire de choix de collection comme des photos déjà uploadées.
 */
function EnvoiVersCollection({
  id,
  nb,
  collections,
  video,
}: {
  id: string;
  nb: number;
  collections: Tables<"collections">[];
  video: { url: string; thumbnailUrl: string; titre: string; type: TypeVideo } | null;
}) {
  const [etat, setEtat] = useState<Etat>({ phase: "lecture" });
  const [essai, setEssai] = useState(0);
  // Survit aux "Réessayer" (essai incrémenté), remis à zéro au tout premier
  // essai : mémorise combien de lots ont déjà été envoyés avec succès et
  // leurs URLs, pour qu'un "Réessayer" après échec partiel ne renvoie que
  // les lots restants au lieu de dupliquer ceux déjà en Storage
  // (CLICK-PATH-601).
  const lotsReussisRef = useRef(0);
  const urlsAcquisesRef = useRef<string[]>([]);

  useEffect(() => {
    let annule = false;
    let apercus: string[] = [];
    if (essai === 0) {
      lotsReussisRef.current = 0;
      urlsAcquisesRef.current = [];
    }

    (async () => {
      let fichiers: File[];
      try {
        fichiers = await lireFichiersEnAttente(id, nb);
      } catch {
        if (!annule) setEtat({ phase: "erreur", message: "Les photos partagées sont introuvables. Partage-les à nouveau." });
        return;
      }
      if (annule) return;
      if (fichiers.length === 0) {
        setEtat({ phase: "pret", urls: [], avertissement: null });
        return;
      }

      apercus = fichiers.map((f) => URL.createObjectURL(f));
      setEtat({ phase: "envoi", apercus, message: "Compression…" });
      const compressees = await compresserImages(fichiers);
      const tropLourdes = fichiersTropLourds(compressees);
      const lots = repartirEnLots(compressees.filter((f) => !tropLourdes.includes(f)));

      const urls: string[] = [...urlsAcquisesRef.current];
      for (const [i, lot] of lots.entries()) {
        if (annule) return;
        if (i < lotsReussisRef.current) continue; // déjà envoyé lors d'un essai précédent
        setEtat({
          phase: "envoi",
          apercus,
          message: lots.length > 1 ? `Envoi ${i + 1}/${lots.length}…` : "Envoi…",
        });
        const formData = new FormData();
        for (const f of lot) formData.append("photos", f);
        const resultat = await runAction(() => televerserPhotosPartagees(formData), { silencieux: true });
        if (!resultat.ok) {
          if (!annule) setEtat({ phase: "erreur", message: resultat.error });
          return;
        }
        urls.push(...resultat.data);
        urlsAcquisesRef.current = urls;
        lotsReussisRef.current = i + 1;
      }

      await oublierFichiersEnAttente(id, nb).catch(() => {});
      if (annule) return;
      setEtat({
        phase: "pret",
        urls,
        avertissement:
          tropLourdes.length > 0
            ? `${tropLourdes.length} photo${tropLourdes.length > 1 ? "s" : ""} trop lourde${tropLourdes.length > 1 ? "s" : ""} même compressée${tropLourdes.length > 1 ? "s" : ""}, non envoyée${tropLourdes.length > 1 ? "s" : ""}.`
            : null,
      });
    })();

    return () => {
      annule = true;
      apercus.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [id, nb, essai]);

  if (etat.phase === "erreur") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className={errorText}>{etat.message}</p>
        <button type="button" onClick={() => setEssai((n) => n + 1)} className={secondaryButton}>
          Réessayer
        </button>
      </div>
    );
  }

  if (etat.phase !== "pret") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(etat.phase === "envoi" ? etat.apercus : Array.from({ length: nb }, () => "")).map((src, i) =>
            src ? (
              // Aperçu local (object URL) : next/image n'apporte rien ici.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" width={96} height={96} className="h-24 w-24 shrink-0 rounded-2xl object-cover opacity-70" />
            ) : (
              <div key={i} className="h-24 w-24 shrink-0 animate-pulse rounded-2xl bg-surface-alt" />
            )
          )}
        </div>
        <p className="text-sm text-ink-2" aria-live="polite">
          {etat.phase === "envoi" ? etat.message : "Lecture des photos…"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {etat.avertissement && (
        <p role="alert" className={errorText}>
          {etat.avertissement}
        </p>
      )}
      {etat.urls.length === 0 && !video ? (
        <p className="text-ink-2">Rien reçu.</p>
      ) : (
        <ChoisirCollectionForm collections={collections} photos={etat.urls} video={video} />
      )}
    </div>
  );
}
