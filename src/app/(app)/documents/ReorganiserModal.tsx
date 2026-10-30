"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  annulerReorganisation,
  appliquerReorganisation,
  proposerReorganisation,
  type ResultatProposition,
} from "@/app/actions/documents-reorganisation";
import { Modal } from "@/components/Modal";
import { showActionToast, showErrorToast, showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import {
  INSTRUCTION_MAX,
  categoriesVidees,
  regrouperChangements,
  type Changement,
} from "@/lib/documents/reorganisation";
import { errorText, input, primaryButton, secondaryButton } from "@/lib/ui";

type Etape = "instruction" | "analyse" | "apercu" | "application";
type Proposition = Extract<ResultatProposition, { statut: "ok" }>;

function pluriel(n: number, mot: string) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

function EtincelleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

function FlecheIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-3">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Case à cocher dont la zone de toucher fait 44 px de haut, comme dans TriVracModal. */
function Case({
  checked,
  indeterminate = false,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (coche: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="relative flex h-11 w-5 shrink-0 cursor-pointer items-center justify-center after:absolute after:-inset-x-2 after:inset-y-0 after:content-['']">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="h-5 w-5 accent-[var(--accent-kcal)]"
      />
    </label>
  );
}

/**
 * Réorganisation des catégories par Gemini : une instruction facultative, un
 * seul appel sur les métadonnées, puis une liste de changements groupés
 * (« Fiches de paie → Travail ») que l'on décoche ou redirige un à un. Rien
 * n'est écrit avant « Appliquer » ; un message propose ensuite « Annuler ».
 */
export function ReorganiserModal({ categories, onClose }: { categories: string[]; onClose: () => void }) {
  const idInstruction = useId();
  const [etape, setEtape] = useState<Etape>("instruction");
  const [instruction, setInstruction] = useState("");
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Écarts de l'utilisateur par rapport à la proposition de Gemini.
  const [decoches, setDecoches] = useState<Set<string>>(new Set());
  const [versChoisi, setVersChoisi] = useState<Record<string, string>>({});
  const [supprimerVides, setSupprimerVides] = useState(true);
  const arret = useRef(false);

  useEffect(() => {
    arret.current = false;
    return () => {
      arret.current = true;
    };
  }, []);

  async function lancer() {
    setErreur(null);
    setEtape("analyse");
    const resultat = await runAction(() => proposerReorganisation(instruction), { silencieux: true });
    if (arret.current) return;
    if (!resultat.ok) {
      setErreur(resultat.error);
      setEtape("instruction");
      return;
    }
    if (resultat.data.statut === "echec") {
      setErreur(resultat.data.erreur);
      setEtape("instruction");
      return;
    }
    setProposition(resultat.data);
    setEtape("apercu");
  }

  const groupes = useMemo(() => regrouperChangements(proposition?.changements ?? []), [proposition]);
  const nouvelles = useMemo(
    () => [...new Set((proposition?.changements ?? []).filter((c) => c.nouvelle).map((c) => c.vers))],
    [proposition]
  );

  const retenus = useMemo(() => {
    const liste: { changement: Changement; vers: string }[] = [];
    for (const groupe of groupes) {
      const vers = versChoisi[groupe.cle] ?? groupe.vers;
      for (const changement of groupe.changements) {
        if (!decoches.has(changement.id) && changement.de !== vers) liste.push({ changement, vers });
      }
    }
    return liste;
  }, [groupes, decoches, versChoisi]);

  const videes = useMemo(
    () => categoriesVidees(retenus.map((r) => r.changement), proposition?.comptes ?? {}),
    [retenus, proposition]
  );

  function basculer(ids: string[], coche: boolean) {
    setDecoches((courants) => {
      const suivants = new Set(courants);
      for (const id of ids) {
        if (coche) suivants.delete(id);
        else suivants.add(id);
      }
      return suivants;
    });
  }

  async function appliquer() {
    setErreur(null);
    setEtape("application");
    const resultat = await runAction(
      () => appliquerReorganisation(retenus.map((r) => ({ id: r.changement.id, vers: r.vers })), supprimerVides),
      { silencieux: true }
    );
    if (!resultat.ok) {
      setErreur(resultat.error);
      setEtape("apercu");
      return;
    }
    const { appliques, echecs, raison, anciennes, creees, supprimees } = resultat.data;
    if (echecs > 0) {
      showErrorToast(
        `${pluriel(echecs, "document")} n'${echecs > 1 ? "ont" : "a"} pas pu être déplacé${echecs > 1 ? "s" : ""}${raison ? ` (${raison})` : ""}.`
      );
    }
    if (appliques > 0) {
      showActionToast(`${pluriel(appliques, "document")} reclassé${appliques > 1 ? "s" : ""}`, {
        ariaLabel: "Annuler la réorganisation",
        onAction: () => {
          void runAction(() => annulerReorganisation(anciennes, creees, supprimees), {
            erreur: "La réorganisation n'a pas pu être annulée. Réessaie.",
          }).then((annulation) => {
            if (annulation.ok) showToast("Réorganisation annulée");
          });
        },
      });
    }
    onClose();
  }

  const occupe = etape === "application";

  return (
    <Modal title="Réorganiser les documents" onClose={onClose}>
      {etape === "instruction" && (
        <div className="flex flex-col gap-4 pb-1">
          <p className="text-sm text-ink-2">
            Gemini regarde le classement de tous tes documents et propose de fusionner, renommer ou créer des
            catégories. Tu valides chaque changement : rien n&apos;est modifié avant « Appliquer ». Les documents en
            vrac ne sont pas concernés.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idInstruction} className="text-sm font-medium text-ink">
              Une préférence ? <span className="font-normal text-ink-3">(facultatif)</span>
            </label>
            <input
              id={idInstruction}
              value={instruction}
              maxLength={INSTRUCTION_MAX}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ex. : pas plus de 8 catégories"
              className={`${input} w-full`}
            />
          </div>
          {erreur && (
            <p role="alert" className={errorText}>
              {erreur}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`${secondaryButton} flex-1`}>
              Annuler
            </button>
            <button type="button" onClick={lancer} className={`${primaryButton} flex flex-[2] items-center justify-center gap-2`}>
              <EtincelleIcon />
              Proposer
            </button>
          </div>
        </div>
      )}

      {etape === "analyse" && (
        <div className="flex flex-col gap-4 pb-1" aria-busy="true">
          <p className="flex items-center gap-3 text-sm text-ink" aria-live="polite">
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 rounded-full border-2 border-line border-t-[var(--accent-kcal)] motion-safe:animate-spin"
            />
            Gemini examine ton classement…
          </p>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Arrêter
          </button>
        </div>
      )}

      {(etape === "apercu" || etape === "application") && proposition && (
        <div className="flex flex-col gap-3">
          {proposition.changements.length === 0 ? (
            <>
              <p className="text-sm text-ink" role="status">
                Ton classement est déjà cohérent : Gemini n&apos;a rien à proposer.
              </p>
              <button type="button" onClick={onClose} className={secondaryButton}>
                Fermer
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                {pluriel(proposition.changements.length, "document")} à reclasser sur {proposition.analyses}. Décoche
                un changement pour l&apos;ignorer, ou choisis une autre catégorie.
              </p>
              {proposition.tronque && (
                <p className="rounded-xl bg-surface-alt px-3 py-2 text-[13px] text-ink">
                  Seuls les {proposition.analyses} documents les plus récents ont été examinés.
                </p>
              )}
              {nouvelles.length > 0 && (
                <p className="rounded-xl bg-kcal-soft px-3 py-2 text-[13px] font-medium text-kcal">
                  Nouvelle{nouvelles.length > 1 ? "s" : ""} catégorie{nouvelles.length > 1 ? "s" : ""} :{" "}
                  {nouvelles.join(", ")}
                </p>
              )}

              <ul className="flex flex-col gap-2.5">
                {groupes.map((groupe) => {
                  const vers = versChoisi[groupe.cle] ?? groupe.vers;
                  const ids = groupe.changements.map((c) => c.id);
                  const nbCoches = ids.filter((id) => !decoches.has(id)).length;
                  const options = [...categories, ...nouvelles.filter((c) => !categories.includes(c))].filter(
                    (c) => c !== groupe.de
                  );
                  if (!options.includes(vers)) options.push(vers);
                  return (
                    <li
                      key={groupe.cle}
                      className={`flex flex-col gap-2 rounded-2xl border border-line p-3 ${nbCoches > 0 ? "bg-surface" : "bg-surface-alt/60"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Case
                          checked={nbCoches === ids.length}
                          indeterminate={nbCoches > 0 && nbCoches < ids.length}
                          disabled={occupe}
                          onChange={(coche) => basculer(ids, coche)}
                          label={`Reclasser ${pluriel(ids.length, "document")} de ${groupe.de ?? "sans catégorie"} vers ${vers}`}
                        />
                        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[15px] font-medium text-ink">
                          <span className="break-words">{groupe.de ?? "Sans catégorie"}</span>
                          <FlecheIcon />
                          <span className="break-words">{vers}</span>
                        </p>
                        <span className="shrink-0 text-xs tabular-nums text-ink-3">{pluriel(ids.length, "doc.")}</span>
                      </div>

                      <select
                        value={vers}
                        disabled={occupe || nbCoches === 0}
                        onChange={(e) => setVersChoisi((courants) => ({ ...courants, [groupe.cle]: e.target.value }))}
                        aria-label={`Catégorie de destination pour ${groupe.de ?? "les documents sans catégorie"}`}
                        className={`${input} w-full disabled:opacity-60`}
                      >
                        {options.map((c) => (
                          <option key={c} value={c}>
                            {c}
                            {nouvelles.includes(c) && !categories.includes(c) ? " (nouvelle)" : ""}
                          </option>
                        ))}
                      </select>

                      <details>
                        <summary className="flex min-h-11 cursor-pointer list-none items-center text-[13px] font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
                          Voir les documents
                        </summary>
                        <ul className="flex flex-col">
                          {groupe.changements.map((changement) => (
                            <li key={changement.id} className="flex items-center gap-3">
                              <Case
                                checked={!decoches.has(changement.id)}
                                disabled={occupe}
                                onChange={(coche) => basculer([changement.id], coche)}
                                label={`Reclasser ${changement.nom}`}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">{changement.nom}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  );
                })}
              </ul>

              {videes.length > 0 && (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3">
                  <input
                    type="checkbox"
                    checked={supprimerVides}
                    disabled={occupe}
                    onChange={(e) => setSupprimerVides(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent-kcal)]"
                  />
                  <span className="text-sm text-ink">
                    Supprimer {videes.length > 1 ? "les catégories vidées" : "la catégorie vidée"} :{" "}
                    <span className="font-semibold">{videes.join(", ")}</span>
                  </span>
                </label>
              )}

              {erreur && (
                <p role="alert" className={errorText}>
                  {erreur}
                </p>
              )}

              <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-surface px-4 pb-1 pt-3">
                <button type="button" onClick={onClose} disabled={occupe} className={`${secondaryButton} flex-1`}>
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={appliquer}
                  disabled={occupe || retenus.length === 0}
                  className={`${primaryButton} flex-[2]`}
                >
                  {occupe ? "Application…" : `Appliquer (${retenus.length})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
