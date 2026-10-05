"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { modifierNotion, supprimerNotion } from "@/app/actions/pharmacie";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { useBackClose } from "@/hooks/useBackClose";
import { runAction } from "@/lib/actions/runAction";
import { showToast } from "@/components/toast/toast-store";
import { queryKeys } from "@/lib/query/keys";
import { dangerButton, errorText, input, label, primaryButton } from "@/lib/ui";
import { appliquerNiveau, contientNiveau, META_NIVEAU, NIVEAUX, type Niveau } from "@/lib/pharmacie/contenu";
import { pluriel } from "@/lib/pharmacie/format";
import type { PharmaNotion } from "@/lib/pharmacie/types";
import { ContenuColore, IconeNiveau } from "../../ContenuColore";

// Cible tactile de 44 px (min-h-11), anneau de focus au clavier comme les autres boutons.
const boutonNiveau =
  "flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

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
  const idContenu = useId();
  const zoneRef = useRef<HTMLTextAreaElement>(null);

  // Retour ferme d'abord la confirmation (entrée du dessus), puis l'éditeur.
  useBackClose(true, onClose);
  useBackClose(confirmerSuppression, () => setConfirmerSuppression(false));

  // Colore la ligne du curseur (ou toutes les lignes de la sélection) sans
  // que l'utilisateur ait à taper la syntaxe `[couleur]` à la main.
  function colorer(niveau: Niveau | null) {
    const zone = zoneRef.current;
    if (!zone) return;
    const edition = appliquerNiveau(contenu, zone.selectionStart, zone.selectionEnd, niveau);
    setContenu(edition.texte);
    requestAnimationFrame(() => {
      zone.focus();
      zone.setSelectionRange(edition.debut, edition.fin);
    });
  }

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
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idContenu} className={label}>
              Contenu
            </label>
            <div role="group" aria-label="Colorer la ligne" className="flex flex-wrap gap-1.5">
              {NIVEAUX.map((niveau) => (
                <button
                  key={niveau}
                  type="button"
                  // Garde la sélection du champ pendant le tap sur le bouton.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => colorer(niveau)}
                  aria-label={`Colorer en ${niveau}${META_NIVEAU[niveau].libelle.toLowerCase() === niveau ? "" : ` (${META_NIVEAU[niveau].libelle.toLowerCase()})`}`}
                  className={boutonNiveau}
                >
                  <IconeNiveau niveau={niveau} taille={14} />
                  {META_NIVEAU[niveau].libelle}
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => colorer(null)}
                className={`${boutonNiveau} text-ink-2`}
              >
                Sans couleur
              </button>
            </div>
            <p className="text-[12px] text-ink-3">La couleur s&apos;applique à la ligne du curseur ou aux lignes sélectionnées.</p>
            <textarea
              id={idContenu}
              ref={zoneRef}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={6}
              className={`${input} resize-y leading-[1.5]`}
              required
            />
          </div>
          {contientNiveau(contenu) && (
            <div className="flex flex-col gap-1.5">
              <span className={label}>Aperçu</span>
              <div className="rounded-2xl border border-line bg-surface-alt p-3">
                <ContenuColore contenu={contenu} />
              </div>
            </div>
          )}
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
