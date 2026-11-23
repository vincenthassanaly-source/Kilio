"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { enregistrerApercuPdf, type DocumentAvecFichiers } from "@/app/actions/documents";
import { genererApercuPdf } from "@/lib/pdf/apercuPdf";
import { TransitionLink } from "@/components/TransitionLink";
import { nameTextComplet, pillTag } from "@/lib/ui";
import { runAction } from "@/lib/actions/runAction";

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

// Carte de liste : un seul lien (aperçu + nom) vers la fiche, où vivent toutes
// les actions (description, remettre en vrac, modifier, supprimer). Pas
// d'`active:scale` : la carte entière est la cible, un survol/press en teinte suffit.
const CARTE =
  "flex items-center gap-3 rounded-row border border-line bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-alt active:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

export function DocumentCard({
  document,
}: {
  document: DocumentAvecFichiers;
  /** Conservé pour la signature de DocumentsList ; l'édition se fait dans la fiche. */
  categories?: string[];
}) {
  // Rattrapage : un PDF ajouté avant les aperçus (ou dont le rendu avait
  // échoué) reçoit le sien à l'affichage de la liste.
  const premier = document.fichiers[0] ?? null;
  const rattrapageId = premier?.fichier_type === "pdf" && !premier.apercu_url ? premier.id : null;
  const rattrapageUrl = rattrapageId ? premier!.url : null;
  useEffect(() => {
    if (rattrapageId && rattrapageUrl) void rattraperApercu(rattrapageId, rattrapageUrl);
  }, [rattrapageId, rattrapageUrl]);

  const apercu = premier;
  const vignette = apercu?.fichier_type === "image" ? apercu.url : (apercu?.apercu_url ?? null);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      <TransitionLink href={`/documents/${document.id}`} className={CARTE}>
        {apercu && (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-alt text-ink-2">
            {vignette ? (
              <Image
                src={vignette}
                alt=""
                width={56}
                height={56}
                style={apercu.fichier_type === "image" ? { viewTransitionName: `document-cover-${document.id}` } : undefined}
                className={`h-full w-full object-cover ${apercu.fichier_type === "pdf" ? "object-top" : ""}`}
              />
            ) : (
              <PdfIcon />
            )}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <span className={nameTextComplet} style={{ viewTransitionName: `document-title-${document.id}` }}>
            {document.nom}
          </span>
          {document.categorie && <span className={`${pillTag} self-start`}>{document.categorie}</span>}
        </span>
      </TransitionLink>
    </motion.li>
  );
}
