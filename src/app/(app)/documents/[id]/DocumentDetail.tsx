"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { deleteDocument, type DocumentAvecFichiers } from "@/app/actions/documents";
import { DocumentForm } from "../DocumentForm";
import { formatEcheance, niveauAlerte } from "../echeance";
import { formatMois } from "../champs";
import { ImageLightbox } from "@/components/ImageLightbox";
import { TransitionLink } from "@/components/TransitionLink";
import type { Tables } from "@/lib/supabase/types";
import { card, dangerButton, errorText, ghostButton, kcalPillTag, linkButton, pillTag } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";

function PdfIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h9l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M9 13h6M9 16.5h4" />
    </svg>
  );
}

export function DocumentDetail({
  document,
  etiquettes,
}: {
  document: DocumentAvecFichiers;
  etiquettes: Tables<"etiquettes">[];
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>("Photo agrandie");

  if (editing) {
    return (
      <div className={card}>
        <DocumentForm
          document={document}
          etiquettes={etiquettes}
          onDone={() => setEditing(false)}
        />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-sm text-ink-2 underline">
          Annuler
        </button>
      </div>
    );
  }

  const alerte = niveauAlerte(document.date_echeance);

  return (
    <div className="flex flex-col gap-4">
      <TransitionLink href="/documents" className={linkButton}>
        ‹ Documents
      </TransitionLink>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            style={{ viewTransitionName: `document-title-${document.id}` }}
            className="mt-1 truncate font-display text-[22px] font-semibold text-ink"
          >
            {document.nom}
          </h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {document.etiquette && <span className={kcalPillTag}>{document.etiquette.nom}</span>}
            {document.categorie && <span className={pillTag}>{document.categorie}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
            Éditer
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirmDelete(`Supprimer le document « ${document.nom} » ?`)) return;
              setError(null);
              startTransition(async () => {
                try {
                  await deleteDocument(document.id);
                } catch (e) {
                  // `deleteDocument` réussit puis appelle `redirect()`, qui lève
                  // une erreur signal devant remonter jusqu'au framework — ne
                  // pas l'avaler ici comme un échec de suppression (CLICK-PATH-701).
                  if (isRedirectError(e)) throw e;
                  setError(e instanceof Error ? e.message : "Erreur inconnue.");
                }
              });
            }}
            className={dangerButton}
          >
            Suppr.
          </button>
        </div>
      </div>

      {document.date_echeance && (
        <span
          className={
            alerte === "aucun"
              ? "text-sm text-ink-2"
              : "w-fit rounded-full bg-alert/10 px-2.5 py-1 text-sm font-semibold text-alert"
          }
        >
          Échéance : {formatEcheance(document.date_echeance)}
        </span>
      )}

      {document.periode_mois && (
        <span className="text-sm text-ink-2">Période : {formatMois(document.periode_mois)}</span>
      )}

      {document.notes && <p className="whitespace-pre-wrap text-sm text-ink">{document.notes}</p>}

      {document.fichiers.length > 0 && (
        <ul className="grid grid-cols-2 gap-2">
          {document.fichiers.map((fichier, index) => {
            const caption = fichier.role === "recto" ? "Recto" : fichier.role === "verso" ? "Verso" : null;
            return fichier.fichier_type === "image" ? (
              <li key={fichier.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setLightboxSrc(fichier.url);
                    setLightboxAlt(caption ? `${caption} — ${document.nom}` : document.nom);
                  }}
                  className="relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-surface-alt"
                  aria-label="Agrandir l'image"
                >
                  <Image
                    src={fichier.url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 45vw, 300px"
                    style={index === 0 ? { viewTransitionName: `document-cover-${document.id}` } : undefined}
                    className="object-cover"
                  />
                </button>
                {caption && <span className="text-center text-xs text-ink-3">{caption}</span>}
              </li>
            ) : (
              <li key={fichier.id} className="flex flex-col gap-1">
                <a
                  href={fichier.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border border-line text-ink-2"
                >
                  {fichier.apercu_url ? (
                    <>
                      <Image
                        src={fichier.apercu_url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 45vw, 300px"
                        className="object-cover object-top"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-background/80 py-1 text-center text-xs font-semibold text-ink">
                        Ouvrir le PDF
                      </span>
                    </>
                  ) : (
                    <>
                      <PdfIcon />
                      <span className="text-xs font-semibold">Ouvrir le PDF</span>
                    </>
                  )}
                </a>
                {caption && <span className="text-center text-xs text-ink-3">{caption}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className={errorText}>{error}</p>}

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}
