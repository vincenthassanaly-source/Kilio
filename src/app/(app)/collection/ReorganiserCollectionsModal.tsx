"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  annulerReorganisationCollections,
  appliquerReorganisationCollections,
  proposerReorganisationCollections,
  type ResultatPropositionCollections,
} from "@/app/actions/collection-reorganisation";
import { EtincelleIcon } from "@/components/EtincelleIcon";
import { Modal } from "@/components/Modal";
import { showActionToast, showErrorToast, showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import {
  collectionsVidees,
  nbChangements,
  regrouperDeplacements,
} from "@/lib/collection/reorganisation";
import { INSTRUCTION_MAX } from "@/lib/documents/reorganisation";
import { queryKeys } from "@/lib/query/keys";
import { errorText, input, primaryButton, secondaryButton } from "@/lib/ui";

type Etape = "instruction" | "analyse" | "apercu" | "application";
type Proposition = Extract<ResultatPropositionCollections, { statut: "ok" }>;

function pluriel(n: number, mot: string) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
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

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{titre}</h3>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </section>
  );
}

const carte = (actif: boolean) => `flex flex-col gap-2 rounded-2xl border border-line p-3 ${actif ? "bg-surface" : "bg-surface-alt/60"}`;

/**
 * Réorganisation des collections par Gemini : une instruction facultative, un
 * seul appel sur les titres et descriptions, puis trois listes de changements
 * (fusions, renommages, déplacements) que l'on décoche une à une. Rien n'est
 * écrit avant « Appliquer » ; un message propose ensuite « Annuler ».
 */
export function ReorganiserCollectionsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const idInstruction = useId();
  const [etape, setEtape] = useState<Etape>("instruction");
  const [instruction, setInstruction] = useState("");
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Écarts de l'utilisateur par rapport à la proposition : clés « fusion:id », « nom:id » ou id d'élément.
  const [decoches, setDecoches] = useState<Set<string>>(new Set());
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
    const resultat = await runAction(() => proposerReorganisationCollections(instruction), { silencieux: true });
    if (arret.current) return;
    if (!resultat.ok || resultat.data.statut === "echec") {
      setErreur(resultat.ok && resultat.data.statut === "echec" ? resultat.data.erreur : (resultat.error ?? ""));
      setEtape("instruction");
      return;
    }
    setProposition(resultat.data);
    setEtape("apercu");
  }

  const groupes = useMemo(() => regrouperDeplacements(proposition?.proposition.deplacements ?? []), [proposition]);
  const nouvelles = useMemo(
    () => [...new Set((proposition?.proposition.deplacements ?? []).filter((d) => d.versId === null).map((d) => d.versNom))],
    [proposition]
  );

  const retenus = useMemo(() => {
    const p = proposition?.proposition;
    return {
      deplacements: (p?.deplacements ?? []).filter((d) => !decoches.has(d.id)),
      fusions: (p?.fusions ?? []).filter((f) => !decoches.has(`fusion:${f.deId}`)),
      renommages: (p?.renommages ?? []).filter((r) => !decoches.has(`nom:${r.id}`)),
    };
  }, [proposition, decoches]);
  const nbRetenus = retenus.deplacements.length + retenus.fusions.length + retenus.renommages.length;

  const videes = useMemo(
    () =>
      collectionsVidees(
        retenus.deplacements,
        proposition?.comptes ?? {},
        proposition?.noms ?? {},
        new Set(retenus.fusions.map((f) => f.deId))
      ),
    [retenus, proposition]
  );

  function basculer(cles: string[], coche: boolean) {
    setDecoches((courants) => {
      const suivants = new Set(courants);
      for (const cle of cles) {
        if (coche) suivants.delete(cle);
        else suivants.add(cle);
      }
      return suivants;
    });
  }

  async function appliquer() {
    setErreur(null);
    setEtape("application");
    const resultat = await runAction(
      () =>
        appliquerReorganisationCollections({
          deplacements: retenus.deplacements.map((d) => ({ id: d.id, versId: d.versId, versNom: d.versNom })),
          fusions: retenus.fusions.map((f) => ({ deId: f.deId, versId: f.versId })),
          renommages: retenus.renommages.map((r) => ({ id: r.id, nom: r.vers })),
        }),
      { silencieux: true }
    );
    if (!resultat.ok) {
      setErreur(resultat.error);
      setEtape("apercu");
      return;
    }
    const { deplaces, fusionnees, renommees, echecs, raison, anciens, creees, supprimees, anciensNoms } = resultat.data;
    // « collection » (préfixe) couvre la page de chaque collection ; les listes sont à recharger aussi.
    const recharger = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections });
      queryClient.invalidateQueries({ queryKey: ["collection"] });
    };
    recharger();
    if (echecs > 0) {
      showErrorToast(`${pluriel(echecs, "changement")} n'${echecs > 1 ? "ont" : "a"} pas pu être appliqué${echecs > 1 ? "s" : ""}${raison ? ` (${raison})` : ""}.`);
    }
    const fait = [
      deplaces > 0 ? pluriel(deplaces, "élément") + (deplaces > 1 ? " déplacés" : " déplacé") : null,
      fusionnees > 0 ? pluriel(fusionnees, "fusion") : null,
      renommees > 0 ? pluriel(renommees, "renommage") : null,
    ].filter(Boolean);
    if (fait.length > 0) {
      showActionToast(fait.join(", "), {
        ariaLabel: "Annuler la réorganisation des collections",
        onAction: () => {
          void runAction(() => annulerReorganisationCollections(anciens, creees, supprimees, anciensNoms), {
            erreur: "La réorganisation n'a pas pu être annulée. Réessaie.",
          }).then((annulation) => {
            recharger();
            if (annulation.ok) showToast("Réorganisation annulée");
          });
        },
      });
    }
    onClose();
  }

  const occupe = etape === "application";

  return (
    <Modal title="Réorganiser" onClose={onClose}>
      {etape === "instruction" && (
        <div className="flex flex-col gap-4 pb-1">
          <p className="text-sm text-ink-2">
            Gemini regarde le contenu de toutes tes collections et propose de déplacer des éléments, de créer, fusionner
            ou renommer des collections. Tu valides chaque changement : rien n&apos;est modifié avant « Appliquer », et tu
            pourras annuler ensuite.
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
              placeholder="Ex. : pas plus de 6 collections"
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
            Gemini examine tes collections…
          </p>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Arrêter
          </button>
        </div>
      )}

      {(etape === "apercu" || etape === "application") && proposition && (
        <div className="flex flex-col gap-4">
          {nbChangements(proposition.proposition) === 0 ? (
            <>
              <p className="text-sm text-ink" role="status">
                Ton rangement est déjà cohérent : Gemini n&apos;a rien à proposer.
              </p>
              {proposition.nonLus > 0 && (
                <p className="rounded-xl bg-surface-alt px-3 py-2 text-[13px] text-ink">
                  {pluriel(proposition.nonLus, "élément")} sans titre ni description n&apos;{proposition.nonLus > 1 ? "ont" : "a"} pas été examiné
                  {proposition.nonLus > 1 ? "s" : ""} : utilise « Décrire » dans tes collections pour qu&apos;ils comptent.
                </p>
              )}
              <button type="button" onClick={onClose} className={secondaryButton}>
                Fermer
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                {pluriel(nbChangements(proposition.proposition), "changement")} proposé
                {nbChangements(proposition.proposition) > 1 ? "s" : ""} sur {proposition.analyses} éléments examinés.
                Décoche ce que tu ne veux pas.
              </p>
              {(proposition.tronque || proposition.nonLus > 0) && (
                <p className="rounded-xl bg-surface-alt px-3 py-2 text-[13px] text-ink">
                  {proposition.tronque ? `Seuls les ${proposition.analyses} éléments les plus récents ont été examinés. ` : ""}
                  {proposition.nonLus > 0
                    ? `${pluriel(proposition.nonLus, "élément")} sans titre ni description ${proposition.nonLus > 1 ? "ne sont" : "n'est"} pas examiné${proposition.nonLus > 1 ? "s" : ""} : utilise « Décrire » pour qu'${proposition.nonLus > 1 ? "ils" : "il"} compte${proposition.nonLus > 1 ? "nt" : ""}.`
                    : ""}
                </p>
              )}

              {proposition.proposition.fusions.length > 0 && (
                <Section titre="Fusions">
                  {proposition.proposition.fusions.map((f) => {
                    const cle = `fusion:${f.deId}`;
                    return (
                      <li key={cle} className={carte(!decoches.has(cle))}>
                        <div className="flex items-center gap-3">
                          <Case
                            checked={!decoches.has(cle)}
                            disabled={occupe}
                            onChange={(coche) => basculer([cle], coche)}
                            label={`Fusionner ${f.deNom} dans ${f.versNom}`}
                          />
                          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[15px] font-medium text-ink">
                            <span className="break-words">{f.deNom}</span>
                            <FlecheIcon />
                            <span className="break-words">{f.versNom}</span>
                          </p>
                          <span className="shrink-0 text-xs tabular-nums text-ink-3">{pluriel(f.nbElements, "élém.")}</span>
                        </div>
                        <p className="pl-8 text-[13px] text-ink-3">« {f.deNom} » disparaît, ses éléments passent dans « {f.versNom} ».</p>
                      </li>
                    );
                  })}
                </Section>
              )}

              {proposition.proposition.renommages.length > 0 && (
                <Section titre="Renommages">
                  {proposition.proposition.renommages.map((r) => {
                    const cle = `nom:${r.id}`;
                    return (
                      <li key={cle} className={carte(!decoches.has(cle))}>
                        <div className="flex items-center gap-3">
                          <Case
                            checked={!decoches.has(cle)}
                            disabled={occupe}
                            onChange={(coche) => basculer([cle], coche)}
                            label={`Renommer ${r.de} en ${r.vers}`}
                          />
                          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[15px] font-medium text-ink">
                            <span className="break-words">{r.de}</span>
                            <FlecheIcon />
                            <span className="break-words">{r.vers}</span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </Section>
              )}

              {groupes.length > 0 && (
                <Section titre="Déplacements">
                  {groupes.map((groupe) => {
                    const ids = groupe.deplacements.map((d) => d.id);
                    const nbCoches = ids.filter((id) => !decoches.has(id)).length;
                    return (
                      <li key={groupe.cle} className={carte(nbCoches > 0)}>
                        <div className="flex items-center gap-3">
                          <Case
                            checked={nbCoches === ids.length}
                            indeterminate={nbCoches > 0 && nbCoches < ids.length}
                            disabled={occupe}
                            onChange={(coche) => basculer(ids, coche)}
                            label={`Déplacer ${pluriel(ids.length, "élément")} de ${groupe.deNom} vers ${groupe.versNom}`}
                          />
                          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[15px] font-medium text-ink">
                            <span className="break-words">{groupe.deNom}</span>
                            <FlecheIcon />
                            <span className="break-words">{groupe.versNom}</span>
                            {groupe.versId === null && (
                              <span className="rounded-full bg-kcal-soft px-2 py-0.5 text-[11px] font-semibold text-kcal">nouvelle</span>
                            )}
                          </p>
                          <span className="shrink-0 text-xs tabular-nums text-ink-3">{pluriel(ids.length, "élém.")}</span>
                        </div>
                        <details>
                          <summary className="flex min-h-11 cursor-pointer list-none items-center text-[13px] font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
                            Voir les éléments
                          </summary>
                          <ul className="flex flex-col">
                            {groupe.deplacements.map((d) => (
                              <li key={d.id} className="flex items-center gap-3">
                                <Case
                                  checked={!decoches.has(d.id)}
                                  disabled={occupe}
                                  onChange={(coche) => basculer([d.id], coche)}
                                  label={`Déplacer ${d.titre}`}
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">{d.titre}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    );
                  })}
                </Section>
              )}

              {nouvelles.length > 0 && (
                <p className="rounded-xl bg-kcal-soft px-3 py-2 text-[13px] font-medium text-kcal">
                  Nouvelle{nouvelles.length > 1 ? "s" : ""} collection{nouvelles.length > 1 ? "s" : ""} : {nouvelles.join(", ")}
                </p>
              )}
              {videes.length > 0 && (
                <p className="rounded-xl bg-surface-alt px-3 py-2 text-[13px] text-ink">
                  {videes.length > 1 ? "Ces collections seront vides" : "Cette collection sera vide"} :{" "}
                  <span className="font-semibold">{videes.join(", ")}</span>. Tu pourras {videes.length > 1 ? "les" : "la"} supprimer à la main.
                </p>
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
                  disabled={occupe || nbRetenus === 0}
                  className={`${primaryButton} flex-[2]`}
                >
                  {occupe ? "Application…" : `Appliquer (${nbRetenus})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
