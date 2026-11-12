"use client";

import { use, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { useBackClose } from "@/hooks/useBackClose";
import { card, linkButton, pillTag, screenTitle, secondaryButton } from "@/lib/ui";
import { notionsDeChapitre } from "@/lib/pharmacie/selecteurs";
import { pluriel } from "@/lib/pharmacie/format";
import type { PharmaNotion, PharmaSnapshot } from "@/lib/pharmacie/types";
import { AvecSnapshot, IntrouvableCarte } from "../../EtatSnapshot";
import { ContenuColore } from "../../ContenuColore";
import { NotionEditeur } from "./NotionEditeur";
import { BackLink } from "@/components/BackLink";

export default function ChapitrePage({ params }: { params: Promise<{ matiereId: string; chapitreId: string }> }) {
  const { matiereId, chapitreId } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <AvecSnapshot>
        {(snapshot) => <Chapitre snapshot={snapshot} matiereId={matiereId} chapitreId={chapitreId} />}
      </AvecSnapshot>
    </div>
  );
}

function Chapitre({
  snapshot,
  matiereId,
  chapitreId,
}: {
  snapshot: PharmaSnapshot;
  matiereId: string;
  chapitreId: string;
}) {
  const [sommaireOuvert, setSommaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<PharmaNotion | null>(null);

  useBackClose(sommaireOuvert, () => setSommaireOuvert(false));

  const matiere = snapshot.matieres.find((m) => m.id === matiereId);
  const chapitre = snapshot.chapitres.find((c) => c.id === chapitreId && c.matiere_id === matiereId);
  const chapitreTrouve = Boolean(matiere && chapitre);

  // Lien profond `#notion-…` : si le chapitre a d'abord rendu le squelette, le
  // navigateur n'a pas trouvé la cible. On défile une fois les notions montées.
  useEffect(() => {
    if (!chapitreTrouve) return;
    const cible = decodeURIComponent(window.location.hash.slice(1));
    if (!cible.startsWith("notion-")) return;
    document.getElementById(cible)?.scrollIntoView({ block: "start" });
  }, [chapitreTrouve, chapitreId]);

  if (!matiere || !chapitre) {
    return (
      <>
        <BackLink href="/pharmacie">Pharmacie</BackLink>
        <IntrouvableCarte titre="Chapitre introuvable" message="Ce chapitre n'existe plus : il a peut-être été renommé ou fusionné." />
      </>
    );
  }

  const notions = notionsDeChapitre(snapshot, chapitre.id);

  function allerA(notionId: string) {
    setSommaireOuvert(false);
    // Laisse la feuille se fermer (et rendre le scroll au document) avant de défiler.
    requestAnimationFrame(() => {
      document.getElementById(`notion-${notionId}`)?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <BackLink href={`/pharmacie/${matiere.id}`}>{matiere.nom}</BackLink>
        <div className="flex items-start justify-between gap-3">
          <h1 className={screenTitle}>{chapitre.nom}</h1>
          {notions.length > 1 && (
            <button
              type="button"
              onClick={() => setSommaireOuvert(true)}
              className={`${secondaryButton} inline-flex min-h-11 shrink-0 items-center px-3 py-1.5 text-small`}
            >
              Sommaire
            </button>
          )}
        </div>
        <p className="text-small text-ink-3">{pluriel(notions.length, "notion")}</p>
      </div>

      {notions.length === 0 ? (
        <IntrouvableCarte message="Aucune notion dans ce chapitre pour l'instant." />
      ) : (
        <div className={`${card} flex flex-col divide-y divide-line py-2`}>
          {notions.map((notion) => (
            <article key={notion.id} id={`notion-${notion.id}`} className="scroll-mt-20 py-4 first:pt-2 last:pb-2">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-body font-bold text-ink text-balance">{notion.titre}</h2>
                <button
                  type="button"
                  onClick={() => setEnEdition(notion)}
                  className={`${linkButton} shrink-0 text-small`}
                  aria-label={`Modifier la notion ${notion.titre}`}
                >
                  Modifier
                </button>
              </div>
              <div className="mt-1.5">
                <ContenuColore contenu={notion.contenu} />
              </div>
              {notion.tags.length > 0 && (
                <p className="mt-2.5 flex flex-wrap gap-1.5">
                  {notion.tags.map((tag) => (
                    <span key={tag} className={pillTag}>
                      {tag}
                    </span>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {sommaireOuvert && (
          <Modal title="Sommaire" onClose={() => setSommaireOuvert(false)}>
            <ol className="flex flex-col">
              {notions.map((notion) => (
                <li key={notion.id}>
                  <button
                    type="button"
                    onClick={() => allerA(notion.id)}
                    className="flex min-h-11 w-full items-center text-left text-body font-semibold text-ink"
                  >
                    {notion.titre}
                  </button>
                </li>
              ))}
            </ol>
          </Modal>
        )}
        {enEdition && (
          <NotionEditeur
            key={enEdition.id}
            notion={enEdition}
            nbCartes={snapshot.cartes.filter((c) => c.notion_id === enEdition.id).length}
            onClose={() => setEnEdition(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
