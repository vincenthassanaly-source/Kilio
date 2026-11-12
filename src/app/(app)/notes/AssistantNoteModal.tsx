"use client";

import { useId, useState } from "react";
import {
  appliquerPropositionNote,
  proposerPourNote,
  type ApplicationNote,
} from "@/app/actions/notes-assistant";
import type { NoteAvecRelations } from "@/app/actions/notes";
import { EtincelleIcon } from "@/components/EtincelleIcon";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import type { ModeAssistantNote, PropositionNote } from "@/lib/notes/assistant";
import { errorText, ghostButton, primaryButton, secondaryButton } from "@/lib/ui";

type Etat =
  | { phase: "choix" }
  | { phase: "chargement"; mode: ModeAssistantNote }
  | { phase: "apercu"; proposition: PropositionNote }
  | { phase: "application"; proposition: PropositionNote }
  | { phase: "erreur"; mode: ModeAssistantNote; message: string };

const ACTIONS: { mode: ModeAssistantNote; titre: string; description: string; texteSeulement?: boolean }[] = [
  { mode: "resume", titre: "Résumer et titrer", description: "Un résumé en 2-3 lignes et un titre plus parlant." },
  {
    mode: "reformuler",
    titre: "Reformuler",
    description: "Corrige et structure le texte. Tu compares avant d'appliquer.",
    texteSeulement: true,
  },
  { mode: "tags", titre: "Classer avec des tags", description: "Propose des tags, d'abord parmi les tiens." },
];

const MESSAGES_CHARGEMENT: Record<ModeAssistantNote, string> = {
  resume: "Gemini lit ta note…",
  reformuler: "Gemini réécrit ta note…",
  tags: "Gemini cherche les bons tags…",
};

function Squelette() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="h-3.5 w-full rounded bg-surface-alt motion-safe:animate-pulse" />
      <div className="h-3.5 w-4/5 rounded bg-surface-alt motion-safe:animate-pulse" />
      <div className="h-3.5 w-2/3 rounded bg-surface-alt motion-safe:animate-pulse" />
    </div>
  );
}

function CaseAvecTexte({
  id,
  coche,
  onChange,
  children,
}: {
  id: string;
  coche: boolean;
  onChange: (coche: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
      <input
        id={id}
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-kcal"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

function ApercuResume({
  note,
  proposition,
  onAppliquer,
  occupe,
}: {
  note: NoteAvecRelations;
  proposition: Extract<PropositionNote, { mode: "resume" }>;
  onAppliquer: (application: ApplicationNote) => void;
  occupe: boolean;
}) {
  const uid = useId();
  const titreChange = proposition.titre !== "" && proposition.titre !== note.titre;
  const peutAjouterResume = note.type === "texte" && proposition.resume !== "";
  const [changerTitre, setChangerTitre] = useState(titreChange);
  const [ajouterResume, setAjouterResume] = useState(false);
  const rien = !(changerTitre && titreChange) && !(ajouterResume && peutAjouterResume);

  return (
    <div className="flex flex-col gap-4">
      {proposition.resume && (
        <section aria-label="Résumé proposé" className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-ink-2">Résumé</h3>
          <p className="text-body leading-relaxed text-ink">{proposition.resume}</p>
          {peutAjouterResume && (
            <CaseAvecTexte id={`${uid}-resume`} coche={ajouterResume} onChange={setAjouterResume}>
              <span className="text-sm text-ink">Ajouter ce résumé en tête de la note</span>
            </CaseAvecTexte>
          )}
        </section>
      )}

      {titreChange ? (
        <section aria-label="Titre proposé" className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-ink-2">Titre</h3>
          <p className="text-sm text-ink-3 line-through">{note.titre}</p>
          <CaseAvecTexte id={`${uid}-titre`} coche={changerTitre} onChange={setChangerTitre}>
            <span className="text-body font-semibold text-ink">{proposition.titre}</span>
          </CaseAvecTexte>
        </section>
      ) : (
        <p className="text-sm text-ink-2">Le titre actuel te convient déjà : Gemini n&apos;en propose pas d&apos;autre.</p>
      )}

      <button
        type="button"
        disabled={occupe || rien}
        onClick={() =>
          onAppliquer({
            mode: "resume",
            titre: changerTitre && titreChange ? proposition.titre : undefined,
            resume: ajouterResume && peutAjouterResume ? proposition.resume : undefined,
          })
        }
        className={primaryButton}
      >
        {occupe ? "Application…" : "Appliquer"}
      </button>
    </div>
  );
}

function ApercuReformulation({
  note,
  proposition,
  onAppliquer,
  occupe,
}: {
  note: NoteAvecRelations;
  proposition: Extract<PropositionNote, { mode: "reformuler" }>;
  onAppliquer: (application: ApplicationNote) => void;
  occupe: boolean;
}) {
  const identique = proposition.contenu.trim() === note.contenu.trim();
  return (
    <div className="flex flex-col gap-4">
      {identique ? (
        <p className="text-sm text-ink">Ta note est déjà claire : Gemini n&apos;y change rien.</p>
      ) : (
        <>
          <section aria-label="Texte actuel" className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium text-ink-2">Avant</h3>
            <p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-line bg-surface-alt p-3 text-sm leading-relaxed text-ink-2">
              {note.contenu}
            </p>
          </section>
          <section aria-label="Texte reformulé" className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium text-ink">Après</h3>
            <p className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-kcal/40 bg-surface p-3 text-sm leading-relaxed text-ink">
              {proposition.contenu}
            </p>
          </section>
          <button
            type="button"
            disabled={occupe}
            onClick={() => onAppliquer({ mode: "reformuler", contenu: proposition.contenu })}
            className={primaryButton}
          >
            {occupe ? "Application…" : "Remplacer le texte"}
          </button>
        </>
      )}
    </div>
  );
}

function basculer<T>(liste: T[], valeur: T): T[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
}

function ApercuTags({
  proposition,
  onAppliquer,
  occupe,
}: {
  proposition: Extract<PropositionNote, { mode: "tags" }>;
  onAppliquer: (application: ApplicationNote) => void;
  occupe: boolean;
}) {
  const [ids, setIds] = useState<string[]>(proposition.existants.map((t) => t.id));
  const [nouveaux, setNouveaux] = useState<string[]>(proposition.nouveaux);
  const rien = ids.length === 0 && nouveaux.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">Coche les tags à ajouter. Ceux déjà sur la note ne changent pas.</p>
      <div className="flex flex-wrap gap-2">
        {proposition.existants.map((tag) => {
          const actif = ids.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={actif}
              onClick={() => setIds((l) => basculer(l, tag.id))}
              className={`relative min-h-9 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors after:absolute after:-inset-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                actif ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
              }`}
            >
              #{tag.nom}
            </button>
          );
        })}
        {proposition.nouveaux.map((nom) => {
          const actif = nouveaux.includes(nom);
          return (
            <button
              key={nom}
              type="button"
              aria-pressed={actif}
              onClick={() => setNouveaux((l) => basculer(l, nom))}
              className={`relative min-h-9 rounded-full border border-dashed px-3 py-1.5 text-sm font-semibold transition-colors after:absolute after:-inset-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                actif ? "border-kcal bg-kcal text-on-kcal" : "border-line bg-surface text-ink-2"
              }`}
            >
              #{nom} <span className="ml-1 text-micro font-medium">nouveau</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={occupe || rien}
        onClick={() => onAppliquer({ mode: "tags", tagIds: ids, nouveaux })}
        className={primaryButton}
      >
        {occupe ? "Application…" : "Ajouter les tags"}
      </button>
    </div>
  );
}

/**
 * Assistant IA d'une note : l'utilisateur choisit une action, Gemini propose,
 * et rien n'est écrit avant « Appliquer ». « Régénérer » refait un appel en
 * ignorant le résultat gardé en cache côté serveur.
 */
export function AssistantNoteModal({
  note,
  onClose,
  onApplied,
}: {
  note: NoteAvecRelations;
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const [etat, setEtat] = useState<Etat>({ phase: "choix" });
  const [erreurApplication, setErreurApplication] = useState<string | null>(null);

  function lancer(mode: ModeAssistantNote, regenerer: boolean) {
    setErreurApplication(null);
    setEtat({ phase: "chargement", mode });
    void runAction(() => proposerPourNote(note.id, mode, regenerer), {
      silencieux: true,
      erreur: "L'assistant n'a pas pu répondre. Réessaie.",
    }).then((resultat) => {
      setEtat(
        resultat.ok
          ? { phase: "apercu", proposition: resultat.data }
          : { phase: "erreur", mode, message: resultat.error }
      );
    });
  }

  function appliquer(proposition: PropositionNote, application: ApplicationNote) {
    setErreurApplication(null);
    setEtat({ phase: "application", proposition });
    void runAction(() => appliquerPropositionNote(note.id, application), {
      silencieux: true,
      erreur: "La modification n'a pas pu être appliquée. Réessaie.",
    }).then((resultat) => {
      if (resultat.ok) {
        onApplied(
          application.mode === "tags"
            ? "Tags ajoutés"
            : application.mode === "reformuler"
              ? "Note reformulée"
              : "Note mise à jour"
        );
        return;
      }
      setErreurApplication(resultat.error);
      setEtat({ phase: "apercu", proposition });
    });
  }

  const enCours = etat.phase === "chargement";
  const proposition = etat.phase === "apercu" || etat.phase === "application" ? etat.proposition : null;
  const occupe = etat.phase === "application";
  const modeCourant: ModeAssistantNote | null =
    proposition?.mode ?? (etat.phase === "chargement" || etat.phase === "erreur" ? etat.mode : null);

  return (
    <Modal title="Assistant IA" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="truncate text-sm font-medium text-ink-2">{note.titre}</p>

        <div aria-live="polite" aria-busy={enCours} className="flex flex-col gap-4">
          {etat.phase === "choix" && (
            <ul className="flex flex-col gap-2">
              {ACTIONS.filter((a) => !(a.texteSeulement && note.type !== "texte")).map((a) => (
                <li key={a.mode}>
                  <button
                    type="button"
                    onClick={() => lancer(a.mode, false)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition active:scale-[0.99] hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-kcal">
                      <EtincelleIcon size={18} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body font-semibold text-ink">{a.titre}</span>
                      <span className="text-sm text-ink-2">{a.description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {etat.phase === "chargement" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink">{MESSAGES_CHARGEMENT[etat.mode]}</p>
              <Squelette />
            </div>
          )}

          {proposition?.mode === "resume" && (
            <ApercuResume note={note} proposition={proposition} onAppliquer={(a) => appliquer(proposition, a)} occupe={occupe} />
          )}
          {proposition?.mode === "reformuler" && (
            <ApercuReformulation
              note={note}
              proposition={proposition}
              onAppliquer={(a) => appliquer(proposition, a)}
              occupe={occupe}
            />
          )}
          {proposition?.mode === "tags" && (
            <ApercuTags proposition={proposition} onAppliquer={(a) => appliquer(proposition, a)} occupe={occupe} />
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

        {etat.phase !== "choix" && !enCours && !occupe && (
          <div className="flex gap-2">
            {modeCourant && (
              <button type="button" onClick={() => lancer(modeCourant, true)} className={`${secondaryButton} flex-1`}>
                {etat.phase === "erreur" ? "Réessayer" : "Régénérer"}
              </button>
            )}
            <button type="button" onClick={() => setEtat({ phase: "choix" })} className={ghostButton}>
              Autre action
            </button>
          </div>
        )}

        {proposition && !occupe && (
          <p className="text-xs text-ink-3">Proposé par l&apos;IA : rien n&apos;est modifié avant que tu appliques.</p>
        )}
      </div>
    </Modal>
  );
}
