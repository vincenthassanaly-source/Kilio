"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  reprendreProposition,
  supprimerParti,
  supprimerProgramme,
  supprimerProposition,
} from "@/app/actions/opinions-partis";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showActionToast, showToast } from "@/components/toast/toast-store";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { runAction } from "@/lib/actions/runAction";
import {
  libelleParti,
  moyennesParAxe,
  programmesParRecence,
  type PartiComplet,
  type ProgrammeParti,
  type Proximite,
  type PropositionParti,
} from "@/lib/opinions/partis";
import { AXES, LIBELLE_THEME, THEMES, formaterScore } from "@/lib/opinions/types";
import { queryKeys } from "@/lib/query/keys";
import { dangerButton, ghostButton, input, label, metaText, pillTag, primaryButton, secondaryButton } from "@/lib/ui";
import { PartiFormModal, ProgrammeFormModal, PropositionFormModal } from "./PartisForms";
import { AxeBarre } from "./ProfilView";

type Formulaire = "parti" | "programme-nouveau" | "programme-modifier" | null;
type Suppression =
  | { type: "parti" }
  | { type: "programme" }
  | { type: "proposition"; proposition: PropositionParti }
  | null;

function libelleProgramme(programme: ProgrammeParti): string {
  return programme.date_programme
    ? `${programme.echeance} (${format(parseISO(programme.date_programme), "d MMM yyyy", { locale: fr })})`
    : programme.echeance;
}

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${ouvert ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PartiCard({ parti, proximite }: { parti: PartiComplet; proximite: Proximite | null }) {
  const queryClient = useQueryClient();
  const navigate = useViewTransitionNavigate();
  const idPanneau = useId();
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(null);
  // `"nouvelle"` : formulaire de création ; une proposition : modification.
  const [propositionEditee, setPropositionEditee] = useState<PropositionParti | "nouvelle" | null>(null);
  const [suppression, setSuppression] = useState<Suppression>(null);
  const [enCours, startTransition] = useTransition();

  const programmes = useMemo(() => programmesParRecence(parti.programmes), [parti.programmes]);
  const programme = programmes.find((p) => p.id === choix) ?? programmes[0] ?? null;
  const propositions = programme?.propositions ?? [];
  const parTheme = THEMES.flatMap((theme) => {
    const items = propositions.filter((p) => p.theme === theme);
    return items.length > 0 ? [{ theme, items }] : [];
  });

  function invalidatePartis() {
    queryClient.invalidateQueries({ queryKey: queryKeys.opinionsPartis });
  }

  function apresEcriture() {
    setFormulaire(null);
    setPropositionEditee(null);
    invalidatePartis();
  }

  function reprendre(proposition: PropositionParti) {
    startTransition(async () => {
      const resultat = await runAction(() => reprendreProposition(proposition.id));
      if (!resultat.ok) return;
      // Les idées ET les partis partagent la racine `opinions`.
      queryClient.invalidateQueries({ queryKey: queryKeys.opinions });
      const idee = resultat.data.id;
      showActionToast("Brouillon créé dans tes idées", {
        label: "Voir",
        ariaLabel: "Voir le brouillon créé dans tes idées",
        onAction: () => navigate(`/opinions/${idee}`),
      });
    });
  }

  function confirmerSuppression() {
    const cible = suppression;
    if (!cible) return;
    const programmeId = programme?.id ?? "";
    startTransition(async () => {
      const resultat = await runAction(
        () =>
          cible.type === "parti"
            ? supprimerParti(parti.id)
            : cible.type === "programme"
              ? supprimerProgramme(programmeId)
              : supprimerProposition(cible.proposition.id),
        { erreur: "La suppression a échoué. Réessaie." }
      );
      setSuppression(null);
      if (resultat.ok) {
        setPropositionEditee(null);
        if (cible.type === "programme") setChoix(null);
        invalidatePartis();
        showToast("Supprimé", 1800);
      }
    });
  }

  const titreSuppression =
    suppression?.type === "parti"
      ? `Supprimer ${libelleParti(parti)} ?`
      : suppression?.type === "programme"
        ? "Supprimer ce programme ?"
        : "Supprimer cette proposition ?";
  const texteSuppression =
    suppression?.type === "parti"
      ? `Le parti, ses ${parti.programmes.length} programme${parti.programmes.length > 1 ? "s" : ""} et toutes leurs propositions seront définitivement supprimés.`
      : suppression?.type === "programme"
        ? `Le programme « ${programme?.echeance ?? ""} » et ses ${propositions.length} proposition${propositions.length > 1 ? "s" : ""} seront définitivement supprimés.`
        : "La proposition sera définitivement supprimée. Les idées déjà reprises de celle-ci sont conservées.";

  const nombreTotal = parti.programmes.length;

  return (
    <section className="rounded-[22px] border border-line bg-surface shadow-card">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => setOuvert((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 rounded-[22px] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-ink">{libelleParti(parti)}</span>
          <span className={metaText}>
            {parti.sigle ? `${parti.nom} · ` : ""}
            {nombreTotal === 0
              ? "Aucun programme"
              : `${nombreTotal} programme${nombreTotal > 1 ? "s" : ""}`}
          </span>
        </span>
        {proximite && (
          <span className={`${pillTag} tabular-nums`}>{proximite.pourcentage} % proche</span>
        )}
        <Chevron ouvert={ouvert} />
      </button>

      {ouvert && (
        <div id={idPanneau} className="flex flex-col gap-4 border-t border-line p-4">
          {programme === null ? (
            <p className="text-sm text-ink-2">
              Aucun programme pour l&apos;instant. Ajoute-en un, puis demande à Claude d&apos;importer ses propositions.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPanneau}-programme`} className={label}>
                Programme
              </label>
              <select
                id={`${idPanneau}-programme`}
                className={input}
                value={programme.id}
                onChange={(e) => setChoix(e.target.value)}
              >
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {libelleProgramme(p)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-x-2 gap-y-4">
            <button type="button" className={ghostButton} onClick={() => setFormulaire("programme-nouveau")}>
              Nouveau programme
            </button>
            {programme && (
              <>
                <button type="button" className={ghostButton} onClick={() => setFormulaire("programme-modifier")}>
                  Modifier
                </button>
                <button type="button" className={dangerButton} onClick={() => setSuppression({ type: "programme" })}>
                  Supprimer
                </button>
              </>
            )}
          </div>

          {programme && propositions.length === 0 && (
            <p className="text-sm text-ink-2">
              Aucune proposition pour ce programme. Demande à Claude de l&apos;importer, ou ajoute-en à la main.
            </p>
          )}

          {propositions.length > 0 && (
            <>
              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">
                  Ses positions ({propositions.length} proposition{propositions.length > 1 ? "s" : ""})
                </h3>
                <ul className="flex flex-col gap-5">
                  {moyennesParAxe(propositions).map((profil) => (
                    <AxeBarre key={profil.axe.id} profil={profil} unite="proposition" qualificatif="" />
                  ))}
                </ul>
              </div>

              {parTheme.map(({ theme, items }) => (
                <div key={theme} className="flex flex-col gap-3">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{LIBELLE_THEME[theme]}</h3>
                  <ul className="flex flex-col gap-3">
                    {items.map((proposition) => (
                      <li key={proposition.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
                        <p className="text-[14.5px] leading-snug text-ink">{proposition.position}</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {AXES.flatMap((axe) => {
                            const score = proposition.scores[axe.id];
                            return score === null
                              ? []
                              : [
                                  <li key={axe.id} className={pillTag}>
                                    {axe.label} {formaterScore(score)}
                                  </li>,
                                ];
                          })}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={ghostButton} disabled={enCours} onClick={() => reprendre(proposition)}>
                            Reprendre dans mes idées
                          </button>
                          <button type="button" className={ghostButton} onClick={() => setPropositionEditee(proposition)}>
                            Modifier
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {programme && (
              <button type="button" className={primaryButton} onClick={() => setPropositionEditee("nouvelle")}>
                Ajouter une proposition
              </button>
            )}
            <button type="button" className={secondaryButton} onClick={() => setFormulaire("parti")}>
              Renommer le parti
            </button>
            <button type="button" className={dangerButton} onClick={() => setSuppression({ type: "parti" })}>
              Supprimer le parti
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {formulaire === "parti" && (
          <PartiFormModal key="parti" parti={parti} onClose={() => setFormulaire(null)} onSaved={apresEcriture} />
        )}
        {formulaire === "programme-nouveau" && (
          <ProgrammeFormModal key="programme-nouveau" partiId={parti.id} onClose={() => setFormulaire(null)} onSaved={apresEcriture} />
        )}
        {formulaire === "programme-modifier" && programme && (
          <ProgrammeFormModal
            key="programme-modifier"
            partiId={parti.id}
            programme={programme}
            onClose={() => setFormulaire(null)}
            onSaved={apresEcriture}
          />
        )}
        {propositionEditee !== null && programme && (
          <PropositionFormModal
            key="proposition"
            programmeId={programme.id}
            proposition={propositionEditee === "nouvelle" ? null : propositionEditee}
            onClose={() => setPropositionEditee(null)}
            onSaved={apresEcriture}
            onSupprimer={
              propositionEditee === "nouvelle"
                ? undefined
                : () => {
                    setSuppression({ type: "proposition", proposition: propositionEditee });
                    setPropositionEditee(null);
                  }
            }
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={suppression !== null}
        titre={titreSuppression}
        confirmer="Supprimer"
        enCours={enCours}
        onConfirm={confirmerSuppression}
        onClose={() => setSuppression(null)}
      >
        <p>{texteSuppression}</p>
      </ConfirmDialog>
    </section>
  );
}
