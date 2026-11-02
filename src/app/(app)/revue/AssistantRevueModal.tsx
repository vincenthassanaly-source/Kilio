"use client";

import { useEffect, useId, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  appliquerReplanification,
  proposerReplanification,
  synthetiserRevue,
} from "@/app/actions/revue-assistant";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import { parseISODate } from "@/lib/date/iso";
import type { PropositionReplanification, SyntheseRevue } from "@/lib/revue/assistant";
import { errorText, ghostButton, primaryButton, secondaryButton } from "@/lib/ui";

export type ModeAssistantRevue = "bilan" | "avenir" | "replanifier";

type Etat =
  | { phase: "chargement"; regeneration: boolean }
  | { phase: "synthese"; synthese: SyntheseRevue }
  | { phase: "replanification"; propositions: PropositionReplanification[] }
  | { phase: "application"; propositions: PropositionReplanification[] }
  | { phase: "erreur"; message: string };

const TITRES: Record<ModeAssistantRevue, string> = {
  bilan: "Bilan de la semaine",
  avenir: "Résumé de la semaine",
  replanifier: "Replanifier avec l'IA",
};

const MESSAGES_CHARGEMENT: Record<ModeAssistantRevue, string> = {
  bilan: "Gemini relit ta semaine…",
  avenir: "Gemini regarde ta semaine à venir…",
  replanifier: "Gemini cherche de nouvelles dates…",
};

function Squelette() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-3.5 w-full rounded bg-surface-alt motion-safe:animate-pulse" />
        <div className="h-3.5 w-4/5 rounded bg-surface-alt motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <div className="h-3 w-3/4 rounded bg-surface-alt motion-safe:animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-surface-alt motion-safe:animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-surface-alt motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

function jourCourt(date: string): string {
  return format(parseISODate(date), "EEE d MMM", { locale: fr });
}

function ListeReplanification({
  propositions,
  occupe,
  onAppliquer,
}: {
  propositions: PropositionReplanification[];
  occupe: boolean;
  onAppliquer: (choisies: PropositionReplanification[]) => void;
}) {
  const uid = useId();
  const [ids, setIds] = useState<string[]>(propositions.map((p) => p.id));
  const choisies = propositions.filter((p) => ids.includes(p.id));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">Décoche les tâches que tu préfères laisser telles quelles.</p>
      <ul className="flex flex-col gap-1">
        {propositions.map((p) => {
          const coche = ids.includes(p.id);
          const id = `${uid}-${p.id}`;
          return (
            <li key={p.id}>
              <label
                htmlFor={id}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={coche}
                  disabled={occupe}
                  onChange={(e) =>
                    setIds((l) => (e.target.checked ? [...l, p.id] : l.filter((x) => x !== p.id)))
                  }
                  className="mt-0.5 h-5 w-5 shrink-0 accent-kcal"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-ink">{p.titre}</span>
                  <span className="text-sm tabular-nums text-ink-2">
                    <span className="line-through">{jourCourt(p.echeanceActuelle)}</span>
                    {" → "}
                    <span className="font-semibold capitalize text-ink">{jourCourt(p.nouvelle)}</span>
                  </span>
                  {p.raison && <span className="text-[13px] text-ink-3">{p.raison}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={occupe || choisies.length === 0}
        onClick={() => onAppliquer(choisies)}
        className={primaryButton}
      >
        {occupe
          ? "Application…"
          : choisies.length <= 1
            ? `Replanifier ${choisies.length} tâche`
            : `Replanifier ${choisies.length} tâches`}
      </button>
    </div>
  );
}

/**
 * Assistant IA de la Revue. Lance la demande à l'ouverture (l'utilisateur vient
 * de cliquer sur un bouton précis). Bilan et résumé sont en lecture seule ; la
 * replanification montre ses dates avant d'écrire quoi que ce soit.
 */
export function AssistantRevueModal({
  mode,
  onClose,
  onApplied,
}: {
  mode: ModeAssistantRevue;
  onClose: () => void;
  onApplied: (nb: number) => void;
}) {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement", regeneration: false });
  const [erreurApplication, setErreurApplication] = useState<string | null>(null);

  function lire(regenerer: boolean): Promise<Etat> {
    const erreur = "L'assistant n'a pas pu répondre. Réessaie.";
    if (mode === "replanifier") {
      return runAction(() => proposerReplanification(regenerer), { silencieux: true, erreur }).then(
        (r): Etat =>
          r.ok
            ? { phase: "replanification", propositions: r.data.propositions }
            : { phase: "erreur", message: r.error }
      );
    }
    return runAction(() => synthetiserRevue(mode, regenerer), { silencieux: true, erreur }).then(
      (r): Etat => (r.ok ? { phase: "synthese", synthese: r.data } : { phase: "erreur", message: r.error })
    );
  }

  useEffect(() => {
    // Annulation propre à CETTE exécution de l'effet (StrictMode en développement).
    let annule = false;
    void lire(false).then((suivant) => {
      if (!annule) setEtat(suivant);
    });
    return () => {
      annule = true;
    };
    // Lancé une seule fois à l'ouverture de la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function relancer() {
    setErreurApplication(null);
    setEtat({ phase: "chargement", regeneration: true });
    void lire(true).then(setEtat);
  }

  function appliquer(choisies: PropositionReplanification[]) {
    setErreurApplication(null);
    setEtat({ phase: "application", propositions: choisies });
    void runAction(() => appliquerReplanification(choisies.map((p) => ({ id: p.id, echeance: p.nouvelle }))), {
      silencieux: true,
      erreur: "La replanification n'a pas pu être appliquée. Réessaie.",
    }).then((r) => {
      if (r.ok) {
        onApplied(r.data.nb);
        return;
      }
      setErreurApplication(r.error);
      setEtat({ phase: "replanification", propositions: choisies });
    });
  }

  const enCours = etat.phase === "chargement" || etat.phase === "application";

  return (
    <Modal title={TITRES[mode]} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div aria-live="polite" aria-busy={enCours} className="flex flex-col gap-4">
          {etat.phase === "chargement" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink">{MESSAGES_CHARGEMENT[mode]}</p>
              <Squelette />
            </div>
          )}

          {etat.phase === "synthese" && (
            <div className="flex flex-col gap-3">
              {etat.synthese.resume && (
                <p className="text-[15px] leading-relaxed text-ink">{etat.synthese.resume}</p>
              )}
              {etat.synthese.points.length > 0 && (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-ink-3">
                  {etat.synthese.points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-ink-3">Généré par IA à partir de ton agenda et de tes tâches.</p>
            </div>
          )}

          {(etat.phase === "replanification" || etat.phase === "application") && (
            <ListeReplanification
              key={etat.propositions.map((p) => p.id).join(",")}
              propositions={etat.propositions}
              occupe={etat.phase === "application"}
              onAppliquer={appliquer}
            />
          )}

          {etat.phase === "erreur" && (
            <p role="alert" className={errorText}>
              {etat.message}
            </p>
          )}
          {erreurApplication && (
            <p role="alert" className={errorText}>
              {erreurApplication}
            </p>
          )}
        </div>

        {!enCours && (
          <div className="flex gap-2">
            <button type="button" onClick={relancer} className={`${secondaryButton} flex-1`}>
              {etat.phase === "erreur" ? "Réessayer" : "Régénérer"}
            </button>
            <button type="button" onClick={onClose} className={ghostButton}>
              Fermer
            </button>
          </div>
        )}

        {(etat.phase === "replanification" || etat.phase === "application") && (
          <p className="text-xs text-ink-3">Proposé par l&apos;IA : rien n&apos;est modifié avant que tu appliques.</p>
        )}
      </div>
    </Modal>
  );
}
