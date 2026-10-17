"use client";

import { useId, useState } from "react";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { descriptionFinale } from "@/lib/vinted/kit";
import type { ChampsAnnonce, ReglagesVinted } from "@/lib/vinted/types";
import { card, ghostButton, secondaryButton, sectionTitle } from "@/lib/ui";

async function copier(texte: string, libelle: string) {
  try {
    await navigator.clipboard.writeText(texte);
    showToast(`${libelle} copié`, 1800);
  } catch {
    showErrorToast("Copie impossible : sélectionne le texte à la main.");
  }
}

function LigneKit({ libelle, valeur, aCopier }: { libelle: string; valeur: string; aCopier?: string }) {
  const vide = !valeur.trim();
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-medium text-ink-3">{libelle}</span>
        <span className={`truncate text-[15px] ${vide ? "text-ink-3" : "text-ink"}`}>{vide ? "Non renseigné" : valeur}</span>
      </div>
      <button
        type="button"
        className={ghostButton}
        disabled={vide}
        onClick={() => void copier(aCopier ?? valeur, libelle)}
        aria-label={`Copier ${libelle.toLowerCase()}`}
      >
        Copier
      </button>
    </li>
  );
}

/**
 * Enregistre les photos dans la galerie du téléphone (feuille de partage) :
 * l'appli Vinted ne sait les récupérer que de là. Sans partage de fichiers
 * (ordinateur), repli sur un téléchargement une par une.
 */
async function partagerPhotos(urls: string[], titre: string) {
  const fichiers = await Promise.all(
    urls.map(async (url, i) => {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error("Téléchargement impossible.");
      const blob = await reponse.blob();
      return new File([blob], `vinted-${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" });
    })
  );

  if (navigator.canShare?.({ files: fichiers })) {
    try {
      await navigator.share({ files: fichiers, title: titre });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      throw err;
    }
    return;
  }

  for (const fichier of fichiers) {
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(fichier);
    lien.download = fichier.name;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }
}

export function KitPublication({
  champs,
  reglages,
  urlsPhotos,
  prixTexte,
}: {
  champs: ChampsAnnonce;
  reglages: ReglagesVinted;
  urlsPhotos: string[];
  prixTexte: string;
}) {
  const uid = useId();
  const [partageEnCours, setPartageEnCours] = useState(false);
  const description = descriptionFinale(champs, reglages);
  const colis = champs.colis.trim() || reglages.colis_defaut;

  async function onPartager() {
    setPartageEnCours(true);
    try {
      await partagerPhotos(urlsPhotos, champs.titre || "Photos Vinted");
    } catch {
      showErrorToast("Les photos n'ont pas pu être exportées. Réessaie.");
    } finally {
      setPartageEnCours(false);
    }
  }

  return (
    <section className={`${card} flex flex-col gap-2`} aria-labelledby={`${uid}-titre`}>
      <h2 id={`${uid}-titre`} className={sectionTitle}>
        Kit de publication
      </h2>
      <p className="text-xs text-ink-3">
        Dans l&apos;appli Vinted : ajoute d&apos;abord les photos, puis copie chaque champ.
      </p>

      <button
        type="button"
        className={`${secondaryButton} min-h-11`}
        disabled={urlsPhotos.length === 0 || partageEnCours}
        onClick={() => void onPartager()}
      >
        {partageEnCours ? "Préparation…" : `Enregistrer les ${urlsPhotos.length} photos dans la galerie`}
      </button>

      <ul className="divide-y divide-line">
        <LigneKit libelle="Titre" valeur={champs.titre} />
        <LigneKit libelle="Description" valeur={description.replace(/\s+/g, " ")} aCopier={description} />
        <LigneKit libelle="Catégorie" valeur={champs.categorie} />
        <LigneKit libelle="Marque" valeur={champs.marque} />
        <LigneKit libelle="Taille" valeur={champs.taille} />
        <LigneKit libelle="État" valeur={champs.etat} />
        <LigneKit libelle="Couleur" valeur={champs.couleur} />
        <LigneKit libelle="Matière" valeur={champs.matiere} />
        <LigneKit libelle="Prix" valeur={prixTexte ? `${prixTexte} €` : ""} aCopier={prixTexte.replace(".", ",")} />
        <LigneKit libelle="Colis" valeur={colis} />
      </ul>
    </section>
  );
}
