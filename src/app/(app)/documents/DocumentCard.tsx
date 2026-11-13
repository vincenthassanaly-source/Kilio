"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Image from "next/image";
import { deleteDocument, enregistrerApercuPdf, type DocumentAvecFichiers } from "@/app/actions/documents";
import { genererApercuPdf } from "@/lib/pdf/apercuPdf";
import { ImageLightbox } from "@/components/ImageLightbox";
import { TransitionLink } from "@/components/TransitionLink";
import { card, dangerButton, ghostButton, listCard, nameTextComplet, pillTag, textButton } from "@/lib/ui";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { runAction } from "@/lib/actions/runAction";
import { BoutonDescription } from "./BoutonDescription";
import { BoutonRemettreEnVrac } from "./BoutonRemettreEnVrac";

const DocumentForm = dynamic(() => import("./DocumentForm").then((m) => m.DocumentForm), { ssr: false });

// Une tentative par fichier et par chargement de page : un PDF dont le rendu
// échoue ne relance pas de calcul à chaque re-rendu de la liste.
const apercusTentes = new Set<string>();

async function rattraperApercu(fichierId: string, url: string) {
  if (apercusTentes.has(fichierId)) return;
  apercusTentes.add(fichierId);
  const apercu = await genererApercuPdf(url);
  if (!apercu) return;
  const formData = new FormData();
  formData.append("apercu", apercu, "apercu.jpg");
  // Silencieux : l'utilisateur n'a rien demandé, un échec garde l'icône PDF.
  await runAction(() => enregistrerApercuPdf(fichierId, formData), { silencieux: true });
}

function PdfIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h9l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M9 13h6M9 16.5h4" />
    </svg>
  );
}

export function DocumentCard({
  document,
  categories,
}: {
  document: DocumentAvecFichiers;
  categories: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Rattrapage : un PDF ajouté avant les aperçus (ou dont le rendu avait
  // échoué) reçoit le sien à l'affichage de la liste.
  const premier = document.fichiers[0] ?? null;
  const rattrapageId = premier?.fichier_type === "pdf" && !premier.apercu_url ? premier.id : null;
  const rattrapageUrl = rattrapageId ? premier!.url : null;
  useEffect(() => {
    if (rattrapageId && rattrapageUrl) void rattraperApercu(rattrapageId, rattrapageUrl);
  }, [rattrapageId, rattrapageUrl]);

  if (editing) {
    return (
      <motion.li
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className={card}
      >
        <DocumentForm
          document={document}
          categories={categories}
          onDone={() => setEditing(false)}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={textButton}
        >
          Annuler
        </button>
      </motion.li>
    );
  }

  const apercu = document.fichiers[0] ?? null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={listCard}
    >
      <div className="flex items-stretch gap-3">
        {apercu && apercu.fichier_type === "image" ? (
          <button
            type="button"
            onClick={() => setLightboxSrc(apercu.url)}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line"
            aria-label="Agrandir l'aperçu"
          >
            <Image
              src={apercu.url}
              alt=""
              width={56}
              height={56}
              style={{ viewTransitionName: `document-cover-${document.id}` }}
              className="h-full w-full object-cover"
            />
          </button>
        ) : apercu ? (
          <a
            href={apercu.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-alt text-ink-2"
            aria-label="Ouvrir le PDF"
          >
            {apercu.apercu_url ? (
              <Image
                src={apercu.apercu_url}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <PdfIcon />
            )}
          </a>
        ) : null}

        <TransitionLink href={`/documents/${document.id}`} className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 self-stretch">
          <p className={nameTextComplet} style={{ viewTransitionName: `document-title-${document.id}` }}>
            {document.nom}
          </p>
          {document.categorie && <span className={`${pillTag} self-start`}>{document.categorie}</span>}
        </TransitionLink>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <BoutonDescription document={document} />
        {!document.en_vrac && <BoutonRemettreEnVrac document={document} />}
        <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
          Modifier
        </button>
        <button
          type="button"
          onClick={() =>
            // Suppression différée : la carte disparaît tout de suite, le document
            // et ses fichiers (stockage compris) ne sont supprimés qu'après le
            // délai d'« Annuler », même si on quitte l'écran entre-temps.
            // Contrat T1 : un échec Storage s'affiche en toast, pas error.tsx.
            supprimerAvecAnnulation({
              texte: `Document « ${document.nom} » supprimé`,
              ariaLabel: `Annuler la suppression du document « ${document.nom} »`,
              masque: { type: "document", id: document.id },
              supprimer: () => deleteDocument(document.id),
              erreur: `Le document « ${document.nom} » n'a pas pu être supprimé. Réessaie.`,
            })
          }
          className={dangerButton}
        >
          Supprimer
        </button>
      </div>

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt={document.nom} onClose={() => setLightboxSrc(null)} />
      )}
    </motion.li>
  );
}
