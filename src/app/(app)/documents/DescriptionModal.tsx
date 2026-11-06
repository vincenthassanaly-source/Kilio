"use client";

import { useEffect, useState } from "react";
import { obtenirDescriptionDocument, type DescriptionAffichee } from "@/app/actions/documents-description";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import { errorText, secondaryButton } from "@/lib/ui";

type Etat =
  | { phase: "chargement"; regeneration: boolean }
  | { phase: "ok"; description: DescriptionAffichee }
  | { phase: "erreur"; message: string };

function Squelette() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-3.5 w-full rounded bg-surface-alt motion-safe:animate-pulse" />
        <div className="h-3.5 w-4/5 rounded bg-surface-alt motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <div className="h-3 w-3/4 rounded bg-surface-alt motion-safe:animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-surface-alt motion-safe:animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-surface-alt motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Description d'un document écrite par Gemini : une courte phrase, puis les
 * éléments principaux en puces. Lue depuis la base si elle existe déjà, sinon
 * calculée à l'ouverture (quelques secondes). « Régénérer » force une
 * nouvelle lecture des fichiers.
 */
export function DescriptionModal({
  documentId,
  nom,
  onClose,
}: {
  documentId: string;
  nom: string;
  onClose: () => void;
}) {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement", regeneration: false });

  function lire(regenerer: boolean): Promise<Etat> {
    return runAction(() => obtenirDescriptionDocument(documentId, regenerer), {
      silencieux: true,
      erreur: "La description n'a pas pu être obtenue. Réessaie.",
    }).then((resultat): Etat =>
      resultat.ok ? { phase: "ok", description: resultat.data } : { phase: "erreur", message: resultat.error }
    );
  }

  useEffect(() => {
    // Annulation propre à CETTE exécution de l'effet (StrictMode en
    // développement : voir TitrageModal).
    let annule = false;
    void lire(false).then((suivant) => {
      if (!annule) setEtat(suivant);
    });
    return () => {
      annule = true;
    };
    // Lancé une seule fois à l'ouverture de la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function regenerer() {
    setEtat({ phase: "chargement", regeneration: true });
    void lire(true).then(setEtat);
  }

  const enCours = etat.phase === "chargement";

  return (
    <Modal title="Description" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="truncate text-sm font-medium text-ink-2">{nom}</p>

        <div aria-live="polite" aria-busy={enCours}>
          {etat.phase === "chargement" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink">
                {etat.regeneration ? "Gemini relit ton document…" : "Gemini lit ton document…"}
              </p>
              <Squelette />
            </div>
          )}

          {etat.phase === "ok" && (
            <div className="flex flex-col gap-3">
              {etat.description.resume && (
                <p className="text-body leading-relaxed text-ink">{etat.description.resume}</p>
              )}
              {etat.description.points.length > 0 && (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-ink-3">
                  {etat.description.points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              )}
              {etat.description.partiel && (
                <p className="text-xs text-ink-2">
                  Description basée sur les premiers fichiers du document seulement.
                </p>
              )}
              <p className="text-xs text-ink-3">Résumé généré par IA : vérifie sur le document si c&apos;est important.</p>
            </div>
          )}

          {etat.phase === "erreur" && (
            <p role="alert" className={errorText}>
              {etat.message}
            </p>
          )}
        </div>

        {!enCours && (
          <button type="button" onClick={regenerer} className={secondaryButton}>
            {etat.phase === "erreur" ? "Réessayer" : "Régénérer"}
          </button>
        )}
      </div>
    </Modal>
  );
}
