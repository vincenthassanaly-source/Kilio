"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteInboxItem,
  getInboxItems,
  inboxVersNote,
  inboxVersTache,
  type InboxItem,
} from "@/app/actions/inbox";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { useBackClose } from "@/hooks/useBackClose";
import { runAction } from "@/lib/actions/runAction";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { decouperCapture, libelleNbInbox } from "@/lib/inbox/compute";
import { queryKeys } from "@/lib/query/keys";
import { card, ghostButton } from "@/lib/ui";
import { EvenementForm } from "../aujourdhui/EvenementForm";
import { CaptureForm } from "./CaptureForm";

const MS_PAR_JOUR = 86_400_000;

function ageLibelle(iso: string): string {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / MS_PAR_JOUR);
  if (jours <= 0) return "aujourd'hui";
  return jours === 1 ? "hier" : `il y a ${jours} j`;
}

/**
 * Inbox : les captures à trier, de la plus ancienne à la plus récente. Chaque
 * capture devient en un tap une tâche (première liste), une note ou un
 * événement (formulaire pré-rempli), ou part à la corbeille (annulable).
 */
export function InboxView({ today }: { today: string }) {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({ queryKey: queryKeys.inbox, queryFn: getInboxItems });
  const [masques, setMasques] = useState<ReadonlySet<string>>(() => new Set());
  const [enCours, setEnCours] = useState<string | null>(null);
  const [evenementPour, setEvenementPour] = useState<InboxItem | null>(null);
  const [captureOuverte, setCaptureOuverte] = useState(false);

  useBackClose(evenementPour !== null || captureOuverte, () => {
    setEvenementPour(null);
    setCaptureOuverte(false);
  });

  const visibles = useMemo(() => (items ?? []).filter((i) => !masques.has(i.id)), [items, masques]);

  function rafraichir() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
  }

  async function convertir(item: InboxItem, vers: "tache" | "note") {
    if (enCours) return;
    setEnCours(item.id);
    const resultat = await runAction(() => (vers === "tache" ? inboxVersTache(item.id) : inboxVersNote(item.id)), {
      erreur: "Impossible de trier cette capture. Réessaie.",
    });
    setEnCours(null);
    if (!resultat.ok) return;
    showToast(vers === "tache" ? "Ajoutée aux tâches" : "Ajoutée aux notes");
    rafraichir();
    void queryClient.invalidateQueries({ queryKey: vers === "tache" ? queryKeys.taches : queryKeys.notes });
  }

  function supprimer(item: InboxItem) {
    supprimerAvecAnnulation({
      texte: "Capture supprimée",
      ariaLabel: "Annuler la suppression de la capture",
      masquer: () => setMasques((m) => new Set(m).add(item.id)),
      restaurer: () =>
        setMasques((m) => {
          const suivant = new Set(m);
          suivant.delete(item.id);
          return suivant;
        }),
      supprimer: () => deleteInboxItem(item.id),
      erreur: "Impossible de supprimer cette capture. Réessaie.",
      onSupprime: rafraichir,
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-[22px]" />
        <Skeleton className="h-24 w-full rounded-[22px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+110px)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] font-medium text-ink-2">{libelleNbInbox(visibles.length)}</p>
        <button type="button" onClick={() => setCaptureOuverte(true)} className={ghostButton}>
          Capturer
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className={`${card} text-[14px] text-ink-2`}>
          Rien à trier. Utilise « Capture » dans le bouton + pour vider ta tête, puis reviens ici.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((item) => {
            const { titre, reste } = decouperCapture(item.texte);
            const occupe = enCours === item.id;
            return (
              <li key={item.id} className={`${card} flex flex-col gap-3`}>
                <div className="min-w-0">
                  <p className="whitespace-pre-line break-words text-[15px] font-medium text-ink">{titre}</p>
                  {reste && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] text-ink-2">{reste}</p>}
                  <p className="mt-1 text-[11.5px] text-ink-3">{ageLibelle(item.created_at)}</p>
                </div>
                <div role="group" aria-label={`Trier « ${titre} »`} className="flex flex-wrap gap-2">
                  <button type="button" disabled={occupe} onClick={() => convertir(item, "tache")} className={ghostButton}>
                    Tâche
                  </button>
                  <button type="button" disabled={occupe} onClick={() => setEvenementPour(item)} className={ghostButton}>
                    Événement
                  </button>
                  <button type="button" disabled={occupe} onClick={() => convertir(item, "note")} className={ghostButton}>
                    Note
                  </button>
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={() => supprimer(item)}
                    aria-label={`Supprimer « ${titre} »`}
                    className={`${ghostButton} text-alert`}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {evenementPour && (
          <Modal key="evenement" title="Nouvel événement" onClose={() => history.back()}>
            <EvenementForm
              titreInitial={decouperCapture(evenementPour.texte).titre}
              dateParDefaut={today}
              onSaved={async () => {
                const id = evenementPour.id;
                // La capture est triée : on la retire, puis on referme le formulaire.
                await runAction(() => deleteInboxItem(id), { erreur: "L'événement est créé, mais la capture n'a pas pu être retirée." });
                showToast("Événement ajouté");
                rafraichir();
                void queryClient.invalidateQueries({ queryKey: queryKeys.evenements });
                history.back();
              }}
            />
          </Modal>
        )}

        {captureOuverte && (
          <Modal key="capture" title="Capture rapide" onClose={() => history.back()}>
            <CaptureForm />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
