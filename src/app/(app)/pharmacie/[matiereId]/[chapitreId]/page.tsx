"use client";

import { use, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { TransitionLink } from "@/components/TransitionLink";
import { useBackClose } from "@/hooks/useBackClose";
import { card, linkButton, pillTag, screenTitle, secondaryButton } from "@/lib/ui";
import { notionsDeChapitre } from "@/lib/pharmacie/selecteurs";
import { pluriel } from "@/lib/pharmacie/format";
import type { PharmaNotion, PharmaSnapshot } from "@/lib/pharmacie/types";
import { AvecSnapshot, IntrouvableCarte } from "../../EtatSnapshot";
import { ContenuColore } from "../../ContenuColore";
import { NotionEditeur } from "./NotionEditeur";

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

  if (!matiere || !chapitre) {
    return (
      <>
        <TransitionLink href="/pharmacie" className={`${linkButton} self-start`}>
          ← Pharmacie
        </TransitionLink>
        <IntrouvableCarte message="Ce chapitre n'existe plus : il a peut-être été renommé ou fusionné." />
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
        <TransitionLink href={`/pharmacie/${matiere.id}`} className={`${linkButton} self-start`}>
          ← {matiere.nom}
        </TransitionLink>
        <div className="flex items-start justify-between gap-3">
          <h1 className={screenTitle}>{chapitre.nom}</h1>
          {notions.length > 1 && (
            <button
              type="button"
              onClick={() => setSommaireOuvert(true)}
              className={`${secondaryButton} shrink-0 px-3 py-1.5 text-[13px]`}
            >
              Sommaire
            </button>
          )}
        </div>
        <p className="text-[12.5px] text-ink-3">{pluriel(notions.length, "notion")}</p>
      </div>

      {notions.length === 0 ? (
        <IntrouvableCarte message="Aucune notion dans ce chapitre pour l'instant." />
      ) : (
        <div className={`${card} flex flex-col divide-y divide-line py-2`}>
          {notions.map((notion) => (
            <article key={notion.id} id={`notion-${notion.id}`} className="scroll-mt-20 py-4 first:pt-2 last:pb-2">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-bold text-ink text-balance">{notion.titre}</h2>
                <button
                  type="button"
                  onClick={() => setEnEdition(notion)}
                  className={`${linkButton} shrink-0 text-[13px]`}
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
                    className="flex min-h-11 w-full items-center text-left text-[14.5px] font-semibold text-ink"
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
