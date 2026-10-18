"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  creerParti,
  creerProgramme,
  creerProposition,
  modifierParti,
  modifierProgramme,
  modifierProposition,
} from "@/app/actions/opinions-partis";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import {
  ECHEANCE_MAX,
  NOM_PARTI_MAX,
  SIGLE_MAX,
  type PartiComplet,
  type ProgrammeParti,
  type PropositionParti,
} from "@/lib/opinions/partis";
import { AXES, LIBELLE_THEME, POSITION_MAX, THEMES, estTheme, scoresVides, type Axe, type Scores, type Theme } from "@/lib/opinions/types";
import { dangerButton, errorText, input, primaryButton } from "@/lib/ui";
import { Champ, LigneScore } from "./ChampsFormulaire";

type Props = { onClose: () => void; onSaved: () => void };

// Corps commun : l'erreur reste dans la feuille (près du bouton) et le bouton
// annonce l'enregistrement en cours.
function useEnregistrement(onSaved: () => void, message: string) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function enregistrer(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const resultat = await runAction(
        async () => {
          const r = await action();
          return r.ok ? { ok: true as const, data: undefined } : { ok: false as const, error: r.error ?? "L'enregistrement a échoué." };
        },
        { silencieux: true }
      );
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      showToast(message, 1800);
      onSaved();
    });
  }

  return { erreur, enCours, enregistrer };
}

function Pied({ erreur, enCours }: { erreur: string | null; enCours: boolean }) {
  return (
    <>
      {erreur && (
        <p className={errorText} role="alert">
          {erreur}
        </p>
      )}
      <button type="submit" className={primaryButton} disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </>
  );
}

// --- Parti -------------------------------------------------------------------------

export function PartiFormModal({ parti, onClose, onSaved }: { parti?: Pick<PartiComplet, "id" | "nom" | "sigle"> } & Props) {
  const [nom, setNom] = useState(parti?.nom ?? "");
  const [sigle, setSigle] = useState(parti?.sigle ?? "");
  const { erreur, enCours, enregistrer } = useEnregistrement(onSaved, parti ? "Parti modifié" : "Parti ajouté");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    enregistrer(() => (parti ? modifierParti(parti.id, nom, sigle) : creerParti(nom, sigle)));
  }

  return (
    <Modal title={parti ? "Modifier le parti" : "Ajouter un parti"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Champ libelle="Nom">
          {(id) => (
            <input id={id} className={input} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={NOM_PARTI_MAX} required autoComplete="off" />
          )}
        </Champ>
        <Champ libelle="Sigle (facultatif)" aide="Court : il s'affiche sur les marqueurs de comparaison.">
          {(id) => (
            <input id={id} className={input} value={sigle} onChange={(e) => setSigle(e.target.value)} maxLength={SIGLE_MAX} autoComplete="off" autoCapitalize="characters" />
          )}
        </Champ>
        <Pied erreur={erreur} enCours={enCours} />
      </form>
    </Modal>
  );
}

// --- Programme -----------------------------------------------------------------------

const ECHEANCES_SUGGEREES = ["Présidentielle 2027", "Législatives 2024", "Européennes 2024", "Présidentielle 2022"];

export function ProgrammeFormModal({
  partiId,
  programme,
  onClose,
  onSaved,
}: { partiId: string; programme?: Pick<ProgrammeParti, "id" | "echeance" | "date_programme"> } & Props) {
  const [echeance, setEcheance] = useState(programme?.echeance ?? "");
  const [date, setDate] = useState(programme?.date_programme ?? "");
  const { erreur, enCours, enregistrer } = useEnregistrement(onSaved, programme ? "Programme modifié" : "Programme ajouté");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const dateOuNull = date || null;
    enregistrer(() =>
      programme ? modifierProgramme(programme.id, echeance, dateOuNull) : creerProgramme(partiId, echeance, dateOuNull)
    );
  }

  return (
    <Modal title={programme ? "Modifier le programme" : "Nouveau programme"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Champ libelle="Échéance">
          {(id) => (
            <>
              <input
                id={id}
                className={input}
                list={`${id}-echeances`}
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                maxLength={ECHEANCE_MAX}
                placeholder="Présidentielle 2027"
                required
                autoComplete="off"
              />
              <datalist id={`${id}-echeances`}>
                {ECHEANCES_SUGGEREES.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </>
          )}
        </Champ>
        <Champ libelle="Date de publication (facultatif)" aide="Sert à choisir le programme le plus récent d'un parti.">
          {(id) => <input id={id} type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Champ>
        <Pied erreur={erreur} enCours={enCours} />
      </form>
    </Modal>
  );
}

// --- Proposition ---------------------------------------------------------------------

export function PropositionFormModal({
  programmeId,
  proposition,
  onClose,
  onSaved,
  onSupprimer,
}: { programmeId: string; proposition: PropositionParti | null; onSupprimer?: () => void } & Props) {
  const [position, setPosition] = useState(proposition?.position ?? "");
  const [theme, setTheme] = useState<Theme | "">(proposition?.theme ?? "");
  const [scores, setScores] = useState<Scores>(proposition?.scores ?? scoresVides());
  const { erreur, enCours, enregistrer } = useEnregistrement(onSaved, proposition ? "Proposition modifiée" : "Proposition ajoutée");

  function majScore(axe: Axe, score: number | null) {
    setScores((s) => ({ ...s, [axe.id]: score }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const champs = { position, theme: theme === "" ? null : theme, scores };
    enregistrer(() => (proposition ? modifierProposition(proposition.id, champs) : creerProposition(programmeId, champs)));
  }

  return (
    <Modal title={proposition ? "Modifier la proposition" : "Ajouter une proposition"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Champ libelle="Proposition" aide={`${position.length}/${POSITION_MAX}. Reformule ce que dit le programme, sans ton avis.`}>
          {(id) => (
            <textarea
              id={id}
              className={`${input} min-h-24 resize-y`}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              maxLength={POSITION_MAX}
              required
            />
          )}
        </Champ>
        <Champ libelle="Thème">
          {(id) => (
            <select id={id} className={input} value={theme} onChange={(e) => setTheme(estTheme(e.target.value) ? e.target.value : "")} required>
              <option value="">Choisir un thème</option>
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {LIBELLE_THEME[t]}
                </option>
              ))}
            </select>
          )}
        </Champ>
        <p className="text-xs text-ink-3">
          Note uniquement ce que dit le texte, avec les mêmes pôles pour tous les partis. « — » : axe non concerné.
        </p>
        {AXES.map((axe) => (
          <LigneScore key={axe.id} axe={axe} score={scores[axe.id]} onChange={(s) => majScore(axe, s)} />
        ))}
        <Pied erreur={erreur} enCours={enCours} />
        {onSupprimer && (
          <button type="button" className={`${dangerButton} self-start`} onClick={onSupprimer} disabled={enCours}>
            Supprimer la proposition
          </button>
        )}
      </form>
    </Modal>
  );
}
