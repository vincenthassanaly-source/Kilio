"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { modifierNotion, supprimerNotion } from "@/app/actions/pharmacie";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import { showToast } from "@/components/toast/toast-store";
import { queryKeys } from "@/lib/query/keys";
import { dangerButton, errorText, input, label, primaryButton } from "@/lib/ui";
import { pluriel } from "@/lib/pharmacie/format";
import type { PharmaNotion } from "@/lib/pharmacie/types";

// Correction rapide d'une notion (l'original dicté n'est pas conservé : c'est
// le seul filet si une reformulation est ratée). L'ajout, lui, passe par le chat.
export function NotionEditeur({
  notion,
  nbCartes,
  onClose,
}: {
  notion: PharmaNotion;
  nbCartes: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [titre, setTitre] = useState(notion.titre);
  const [contenu, setContenu] = useState(notion.contenu);
  const [tags, setTags] = useState(notion.tags.join(", "));
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [enCours, startTransition] = useTransition();

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(
        () =>
          modifierNotion(notion.id, {
            titre,
            contenu,
            tags: tags.split(","),
          }),
        { silencieux: true, onError: setErreur }
      );
      if (!resultat.ok) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.pharmacie });
      showToast("Notion enregistrée");
      onClose();
    });
  }

  function supprimer() {
    startTransition(async () => {
      const resultat = await runAction(() => supprimerNotion(notion.id), { onError: () => setConfirmerSuppression(false) });
      if (!resultat.ok) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.pharmacie });
      showToast("Notion supprimée");
      onClose();
    });
  }

  return (
    <>
      <Modal title="Modifier la notion" onClose={onClose}>
        <form onSubmit={enregistrer} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Titre</span>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className={input} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Contenu</span>
            <textarea
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={6}
              className={`${input} resize-y leading-[1.5]`}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Tags (séparés par des virgules)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={input} />
          </label>
          {erreur && (
            <p role="alert" className={errorText}>
              {erreur}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setConfirmerSuppression(true)} disabled={enCours} className={dangerButton}>
              Supprimer
            </button>
            <button type="submit" disabled={enCours} className={primaryButton}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmerSuppression}
        titre="Supprimer cette notion ?"
        confirmer={nbCartes > 0 ? `Supprimer la notion et ${pluriel(nbCartes, "carte")}` : "Supprimer la notion"}
        enCours={enCours}
        onConfirm={supprimer}
        onClose={() => setConfirmerSuppression(false)}
      >
        <p>« {notion.titre} » sera supprimée définitivement, ainsi que ses cartes de révision.</p>
      </ConfirmDialog>
    </>
  );
}
