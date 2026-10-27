"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  changerStatutIdee,
  modifierIdee,
  supprimerIdee,
  type IdeeAvecVersions,
  type VersionIdee,
} from "@/app/actions/opinions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SegmentedControl } from "@/components/SegmentedControl";
import { showToast } from "@/components/toast/toast-store";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { runAction } from "@/lib/actions/runAction";
import {
  ARGUMENTS_MAX,
  AXES,
  CONVICTIONS,
  LIBELLE_CONVICTION,
  LIBELLE_STATUT,
  LIBELLE_THEME,
  POSITION_MAX,
  SOURCE_MAX,
  THEMES,
  champsIdentiques,
  estConviction,
  estTheme,
  formaterScore,
  type Axe,
  type ChampsIdee,
  type Statut,
} from "@/lib/opinions/types";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, errorText, input, label, pillTag, primaryButton, screenTitle, secondaryButton, sectionTitle } from "@/lib/ui";
import { Champ, LigneScore } from "../ChampsFormulaire";
import { StatutPill } from "../StatutPill";
import { BackLink } from "@/components/BackLink";

function resumeScores(version: VersionIdee): string {
  const parties = AXES.flatMap((axe) => {
    const score = version.scores[axe.id];
    return score === null ? [] : [`${axe.label} ${formaterScore(score)}`];
  });
  return parties.length > 0 ? parties.join(" · ") : "Aucun axe renseigné";
}

function dateVersion(iso: string): string {
  return format(new Date(iso), "d MMMM yyyy 'à' HH'h'mm", { locale: fr });
}

function champsDe(idee: IdeeAvecVersions): ChampsIdee {
  const { position, theme, conviction, arguments_pour, arguments_contre, source, scores } = idee;
  return { position, theme, conviction, arguments_pour, arguments_contre, source, scores: { ...scores } };
}

export function IdeeEditor({ idee }: { idee: IdeeAvecVersions }) {
  const queryClient = useQueryClient();
  const navigate = useViewTransitionNavigate();
  const [initiale, setInitiale] = useState(() => champsDe(idee));
  const [saisie, setSaisie] = useState(initiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const statut = idee.statut;
  const modifie = !champsIdentiques(saisie, initiale);

  function maj<K extends keyof ChampsIdee>(cle: K, valeur: ChampsIdee[K]) {
    setSaisie((s) => ({ ...s, [cle]: valeur }));
  }

  function majScore(axe: Axe, score: number | null) {
    setSaisie((s) => ({ ...s, scores: { ...s.scores, [axe.id]: score } }));
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.opinions });
  }

  async function enregistrer(): Promise<boolean> {
    if (!saisie.position.trim()) {
      setErreur("La position est requise.");
      return false;
    }
    setErreur(null);
    const resultat = await runAction(() => modifierIdee(idee.id, saisie), { silencieux: true });
    if (!resultat.ok) {
      setErreur(resultat.error);
      return false;
    }
    setInitiale(saisie);
    invalidate();
    return true;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (await enregistrer()) showToast("Idée enregistrée", 1800);
    });
  }

  function onStatut(nouveau: Statut) {
    if (nouveau === "validee" && !saisie.theme) {
      setErreur("Choisis un thème avant de valider cette idée.");
      return;
    }
    startTransition(async () => {
      if (modifie && !(await enregistrer())) return;
      const resultat = await runAction(() => changerStatutIdee(idee.id, nouveau), { silencieux: true });
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      setErreur(null);
      invalidate();
      showToast(`Statut : ${LIBELLE_STATUT[nouveau]}`, 1800);
    });
  }

  function onSupprimer() {
    startTransition(async () => {
      const resultat = await runAction(() => supprimerIdee(idee.id), { erreur: "La suppression a échoué. Réessaie." });
      setConfirmerSuppression(false);
      if (resultat.ok) {
        invalidate();
        navigate("/opinions");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/opinions">Opinions</BackLink>
        <div className="flex items-center justify-between gap-3">
          <h1 className={screenTitle}>Idée</h1>
          <StatutPill statut={statut} />
        </div>
      </div>

      {idee.origine && (
        <section className={`${card} flex flex-col gap-1`}>
          <p className="text-xs font-semibold text-ink-3">Reprise d&apos;une proposition de parti</p>
          <p className="text-[14.5px] leading-snug text-ink">« {idee.origine.proposition} »</p>
          <p className="text-xs text-ink-2">
            {idee.origine.parti} · {idee.origine.echeance}
          </p>
        </section>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={sectionTitle}>Ma position</h2>

          <Champ
            libelle="Position en une phrase"
            aide={
              <span>
                {saisie.position.length}/{POSITION_MAX}
              </span>
            }
          >
            {(id) => (
              <textarea
                id={id}
                className={`${input} min-h-24 resize-y`}
                value={saisie.position}
                onChange={(e) => maj("position", e.target.value)}
                maxLength={POSITION_MAX}
                required
              />
            )}
          </Champ>

          <Champ libelle="Thème">
            {(id) => (
              <select
                id={id}
                className={input}
                value={saisie.theme ?? ""}
                onChange={(e) => maj("theme", estTheme(e.target.value) ? e.target.value : null)}
              >
                <option value="">Aucun thème</option>
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {LIBELLE_THEME[t]}
                  </option>
                ))}
              </select>
            )}
          </Champ>

          <div className="flex flex-col gap-1.5">
            <span className={label}>Conviction</span>
            <SegmentedControl
              options={CONVICTIONS.map((c) => ({ value: c, label: LIBELLE_CONVICTION[c] }))}
              value={saisie.conviction}
              onChange={(c) => estConviction(c) && maj("conviction", c)}
              ariaLabel="Niveau de conviction"
            />
          </div>
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={sectionTitle}>Arguments</h2>
          <Champ libelle="Pour" aide={`${saisie.arguments_pour.length}/${ARGUMENTS_MAX}`}>
            {(id) => (
              <textarea
                id={id}
                className={`${input} min-h-24 resize-y`}
                value={saisie.arguments_pour}
                onChange={(e) => maj("arguments_pour", e.target.value)}
                maxLength={ARGUMENTS_MAX}
                placeholder="Ce qui me convainc"
              />
            )}
          </Champ>
          <Champ libelle="Contre" aide={`${saisie.arguments_contre.length}/${ARGUMENTS_MAX}`}>
            {(id) => (
              <textarea
                id={id}
                className={`${input} min-h-24 resize-y`}
                value={saisie.arguments_contre}
                onChange={(e) => maj("arguments_contre", e.target.value)}
                maxLength={ARGUMENTS_MAX}
                placeholder="Les objections sérieuses"
              />
            )}
          </Champ>
          <Champ libelle="Source (facultatif)" aide="Lien, livre, vidéo, personne, chiffre…">
            {(id) => (
              <input
                id={id}
                className={input}
                value={saisie.source}
                onChange={(e) => maj("source", e.target.value)}
                maxLength={SOURCE_MAX}
                autoCapitalize="none"
              />
            )}
          </Champ>
        </section>

        <section className={`${card} flex flex-col gap-4`}>
          <div className="flex flex-col gap-1">
            <h2 className={sectionTitle}>Sur les axes</h2>
            <p className="text-xs text-ink-3">
              Ne renseigne que les axes que l&apos;idée touche : « — » veut dire non concerné, « 0 » une position
              centrale assumée.
            </p>
          </div>
          {AXES.map((axe) => (
            <LigneScore key={axe.id} axe={axe} score={saisie.scores[axe.id]} onChange={(s) => majScore(axe, s)} />
          ))}
        </section>

        {erreur && (
          <p className={errorText} role="alert">
            {erreur}
          </p>
        )}

        <button type="submit" className={primaryButton} disabled={!modifie || enCours}>
          {enCours ? "Enregistrement…" : modifie ? "Enregistrer" : "Enregistré"}
        </button>
      </form>

      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-col gap-1">
          <h2 className={sectionTitle}>Statut</h2>
          <p className="text-xs text-ink-3">
            {statut === "validee"
              ? "Cette idée compte dans ton profil."
              : "Seules les idées validées comptent dans ton profil. Valider demande un thème."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statut !== "validee" && (
            <button type="button" className={primaryButton} disabled={enCours} onClick={() => onStatut("validee")}>
              Valider
            </button>
          )}
          {statut !== "brouillon" && (
            <button type="button" className={secondaryButton} disabled={enCours} onClick={() => onStatut("brouillon")}>
              Remettre en brouillon
            </button>
          )}
          {statut !== "rejetee" && (
            <button type="button" className={secondaryButton} disabled={enCours} onClick={() => onStatut("rejetee")}>
              Rejeter
            </button>
          )}
        </div>
      </section>

      {idee.versions.length > 0 && (
        <details className={`${card} group`}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal">
            <span className={sectionTitle}>Historique de mon avis</span>
            <span className={pillTag}>
              {idee.versions.length} version{idee.versions.length > 1 ? "s" : ""}
            </span>
          </summary>
          <ol className="mt-3 flex flex-col gap-3">
            {idee.versions.map((version) => (
              <li key={version.id} className="flex flex-col gap-1 border-t border-line pt-3">
                <p className="text-xs font-semibold text-ink-3">Remplacée le {dateVersion(version.created_at)}</p>
                <p className="text-[14.5px] leading-snug text-ink">« {version.position} »</p>
                <p className="text-xs text-ink-2">
                  {version.theme ? LIBELLE_THEME[version.theme] : "Sans thème"} · {LIBELLE_CONVICTION[version.conviction]} ·{" "}
                  {resumeScores(version)}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <button
        type="button"
        className={`${dangerButton} self-start`}
        disabled={enCours}
        onClick={() => setConfirmerSuppression(true)}
      >
        Supprimer l&apos;idée
      </button>

      <ConfirmDialog
        open={confirmerSuppression}
        titre="Supprimer cette idée ?"
        confirmer="Supprimer l'idée"
        enCours={enCours}
        onConfirm={onSupprimer}
        onClose={() => setConfirmerSuppression(false)}
      >
        <p>L&apos;idée et son historique de versions seront définitivement supprimés.</p>
      </ConfirmDialog>
    </div>
  );
}
