"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AddTaskForm } from "@/app/(app)/taches/AddTaskForm";
import type { Tables } from "@/lib/supabase/types";
import type { TexteTache } from "@/lib/partage/tache";
import { card, errorText, secondaryButton } from "@/lib/ui";

type Destination = "collection" | "tache";

/**
 * Écran de choix après un partage d'image : « Ajouter à une collection » ou
 * « Nouvelle tâche ». Rien n'est envoyé avant le choix : la collection monte
 * son contenu (upload éventuel + formulaire) seulement une fois choisie, la
 * tâche récupère les fichiers puis ouvre le formulaire de tâche pré-rempli.
 */
export function DestinationPartage({
  collectionContenu,
  obtenirFichiers,
  apresTache,
  listes,
  tags,
  texte,
}: {
  collectionContenu: ReactNode;
  obtenirFichiers: () => Promise<File[]>;
  apresTache?: () => void;
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  texte: TexteTache;
}) {
  const [destination, setDestination] = useState<Destination | null>(null);

  if (destination === "collection") return <>{collectionContenu}</>;
  if (destination === "tache") {
    return (
      <CreerTacheDepuisPartage
        obtenirFichiers={obtenirFichiers}
        apresTache={apresTache}
        listes={listes}
        tags={tags}
        texte={texte}
        retour={() => setDestination(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setDestination("collection")} className={`${card} text-left`}>
        <span className="font-semibold text-ink">Ajouter à une collection</span>
        <span className="block text-sm text-ink-2">Photos, inspirations, idées</span>
      </button>
      <button type="button" onClick={() => setDestination("tache")} className={`${card} text-left`}>
        <span className="font-semibold text-ink">Nouvelle tâche</span>
        <span className="block text-sm text-ink-2">L&apos;image est jointe à la tâche</span>
      </button>
    </div>
  );
}

function CreerTacheDepuisPartage({
  obtenirFichiers,
  apresTache,
  listes,
  tags,
  texte,
  retour,
}: {
  obtenirFichiers: () => Promise<File[]>;
  apresTache?: () => void;
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  texte: TexteTache;
  retour: () => void;
}) {
  const router = useRouter();
  const [fichiers, setFichiers] = useState<File[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let annule = false;
    obtenirFichiers().then(
      (f) => {
        if (!annule) setFichiers(f);
      },
      () => {
        if (!annule) setErreur("Impossible de récupérer l'image partagée. Partage-la à nouveau.");
      }
    );
    return () => {
      annule = true;
    };
    // `obtenirFichiers` est recréée à chaque rendu parent : seul `essai` relance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essai]);

  if (erreur) {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className={errorText}>{erreur}</p>
        <button
          type="button"
          onClick={() => {
            setErreur(null);
            setEssai((n) => n + 1);
          }}
          className={secondaryButton}
        >
          Réessayer
        </button>
      </div>
    );
  }
  if (!fichiers) return <p className="text-sm text-ink-2" aria-busy="true">Préparation de l&apos;image…</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className={card}>
        <AddTaskForm
          listes={listes}
          tags={tags}
          initial={{ titre: texte.titre, notes: texte.notes }}
          initialFiles={fichiers}
          onDone={() => {
            apresTache?.();
            router.push("/taches");
          }}
        />
      </div>
      <button type="button" onClick={retour} className="text-sm text-ink-2 underline self-start">
        Annuler
      </button>
    </div>
  );
}
