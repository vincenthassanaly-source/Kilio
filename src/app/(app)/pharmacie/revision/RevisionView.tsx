"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { noterCarte } from "@/app/actions/pharmacie";
import { TransitionLink } from "@/components/TransitionLink";
import { dismissToast, showActionToast, showErrorToast } from "@/components/toast/toast-store";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import { card, linkButton, primaryButton, screenTitle, secondaryButton } from "@/lib/ui";
import { formaterDelai } from "@/lib/pharmacie/format";
import { etatSm2, noterEnTete, seanceInitiale, type EtatSeance } from "@/lib/pharmacie/seanceRevision";
import { cartesARevoir } from "@/lib/pharmacie/selecteurs";
import { NOTES_REVISION, prochainEtatCarte, type NoteRevision } from "@/lib/pharmacie/srs";
import { modifierSnapshot } from "@/lib/pharmacie/useSnapshotPharmacie";
import type { PharmaNotion, PharmaSnapshot } from "@/lib/pharmacie/types";
import { AvecSnapshot } from "../EtatSnapshot";
import { ContenuColore } from "../ContenuColore";
import { NotionEditeur } from "../[matiereId]/[chapitreId]/NotionEditeur";
import { BackLink } from "@/components/BackLink";

// Taille d'une séance : assez pour être utile, assez court pour se faire en
// pause. Les cartes « À revoir » repassent en fin de séance.
const TAILLE_SEANCE = 20;

// Délai pendant lequel « Annuler » reste possible : la note n'est envoyée au
// serveur qu'à son expiration (ou dès la carte suivante, ou en quittant
// l'écran). Rien à défaire côté serveur, en ligne comme hors ligne.
const DELAI_ANNULATION_MS = 6000;

const LIBELLES: Record<NoteRevision, string> = {
  "a-revoir": "À revoir",
  difficile: "Difficile",
  bien: "Bien",
  facile: "Facile",
};

// « À revoir » se distingue de Difficile et Facile : la carte revient dans la séance.
const boutonARevoir =
  "rounded-2xl border border-alert/40 bg-[color-mix(in_oklch,var(--accent-alert)_8%,var(--surface))] font-semibold text-alert transition-[color,background-color,border-color,opacity,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

function classeBouton(note: NoteRevision): string {
  if (note === "bien") return primaryButton;
  if (note === "a-revoir") return boutonARevoir;
  return secondaryButton;
}

function classeDelai(note: NoteRevision): string {
  if (note === "bien") return "opacity-80";
  if (note === "a-revoir") return "text-alert";
  return "text-ink-2";
}

export function RevisionView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/pharmacie">Pharmacie</BackLink>
        <h1 className={screenTitle}>Révision</h1>
      </div>
      <AvecSnapshot>{(snapshot) => <Seance snapshot={snapshot} />}</AvecSnapshot>
    </div>
  );
}

type NoteEnAttente = {
  carteId: string;
  note: NoteRevision;
  quand: string;
  timer: ReturnType<typeof setTimeout>;
  toastId: number;
};

async function envoyerNote(carteId: string, note: NoteRevision, quand: string) {
  try {
    await noterCarte(carteId, note, quand);
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueAction("pharmacie", "noterCarte", [carteId, note, quand]);
    } else {
      showErrorToast("La note n'a pas pu être enregistrée.");
    }
  }
}

function Seance({ snapshot }: { snapshot: PharmaSnapshot }) {
  const queryClient = useQueryClient();
  // File figée au montage : noter une carte modifie l'instantané (et donc la
  // liste « à réviser ») sans réordonner la séance en cours.
  const [etat, setEtat] = useState<EtatSeance>(() =>
    seanceInitiale(
      cartesARevoir(snapshot.cartes, new Date())
        .slice(0, TAILLE_SEANCE)
        .map((c) => c.id)
    )
  );
  const [total] = useState(etat.file.length);
  const [revele, setRevele] = useState(false);
  const [enEdition, setEnEdition] = useState<PharmaNotion | null>(null);
  const enAttente = useRef<NoteEnAttente | null>(null);

  const cartes = useMemo(() => new Map(snapshot.cartes.map((c) => [c.id, c])), [snapshot.cartes]);
  const carte = etat.file.length > 0 ? cartes.get(etat.file[0]) : undefined;

  // Envoie tout de suite la note encore annulable (carte suivante notée, écran
  // quitté, onglet masqué) : elle n'est jamais perdue.
  const envoyerEnAttente = useCallback(() => {
    const p = enAttente.current;
    if (!p) return;
    enAttente.current = null;
    clearTimeout(p.timer);
    dismissToast(p.toastId);
    void envoyerNote(p.carteId, p.note, p.quand);
  }, []);

  useEffect(() => {
    const auMasquage = () => {
      if (document.visibilityState === "hidden") envoyerEnAttente();
    };
    document.addEventListener("visibilitychange", auMasquage);
    window.addEventListener("pagehide", envoyerEnAttente);
    return () => {
      document.removeEventListener("visibilitychange", auMasquage);
      window.removeEventListener("pagehide", envoyerEnAttente);
      envoyerEnAttente();
    };
  }, [envoyerEnAttente]);

  if (total === 0) {
    return (
      <div className={`${card} flex flex-col gap-1`} role="status">
        <p className="text-body font-bold text-ink">Rien à réviser</p>
        <p className="text-label text-ink-2">Toutes tes cartes sont à jour. Reviens plus tard.</p>
      </div>
    );
  }

  if (!carte) {
    return (
      <div className={`${card} flex flex-col gap-4`} role="status">
        <div>
          <p className="kl-in font-display text-heading font-bold text-ink">Séance terminée, bien joué.</p>
          <p className="text-label text-ink-2">
            {etat.fait} carte{etat.fait > 1 ? "s" : ""} revue{etat.fait > 1 ? "s" : ""}.
          </p>
        </div>
        <ul className="grid grid-cols-4 gap-2 text-center">
          {NOTES_REVISION.map((note) => (
            <li key={note} className="rounded-2xl bg-surface-alt px-1 py-2">
              <p className="font-display text-heading-sm font-bold tabular-nums text-ink">{etat.bilan[note]}</p>
              <p className="text-micro font-semibold text-ink-2">{LIBELLES[note]}</p>
            </li>
          ))}
        </ul>
        <TransitionLink href="/pharmacie" className={`${primaryButton} text-center`}>
          Retour à la Pharmacie
        </TransitionLink>
      </div>
    );
  }

  const carteCourante = carte;
  const notion = carteCourante.notion_id
    ? snapshot.notions.find((n) => n.id === carteCourante.notion_id)
    : undefined;
  const progression = Math.round((etat.fait / total) * 100);

  function noter(note: NoteRevision) {
    envoyerEnAttente();
    const maintenant = new Date();
    const quand = maintenant.toISOString();
    const suivant = prochainEtatCarte(carteCourante, note, maintenant);
    const etatAvant = etat;
    const sm2Avant = etatSm2(carteCourante);
    const carteId = carteCourante.id;

    // Optimiste : la séance avance tout de suite, l'écriture part à la fin du
    // délai d'annulation (ou dans la file hors ligne si le réseau manque).
    setRevele(false);
    setEtat(noterEnTete(etatAvant, note));
    modifierSnapshot(queryClient, (s) => ({
      ...s,
      cartes: s.cartes.map((c) => (c.id === carteId ? { ...c, ...suivant } : c)),
    }));

    const toastId = showActionToast(`Carte notée « ${LIBELLES[note]} »`, {
      ariaLabel: `Annuler la note « ${LIBELLES[note]} »`,
      dureeMs: DELAI_ANNULATION_MS,
      onAction: () => {
        const p = enAttente.current;
        if (!p || p.toastId !== toastId) return;
        enAttente.current = null;
        clearTimeout(p.timer);
        // Retour à la carte précédente, réponse affichée : état SM-2 et file restaurés.
        setEtat(etatAvant);
        setRevele(true);
        modifierSnapshot(queryClient, (s) => ({
          ...s,
          cartes: s.cartes.map((c) => (c.id === carteId ? { ...c, ...sm2Avant } : c)),
        }));
      },
    });
    const timer = setTimeout(() => {
      if (enAttente.current?.toastId !== toastId) return;
      enAttente.current = null;
      void envoyerNote(carteId, note, quand);
    }, DELAI_ANNULATION_MS);
    enAttente.current = { carteId, note, quand, timer, toastId };
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Carte de révision">
      <div className="flex items-center gap-3">
        <span
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-alt"
          role="progressbar"
          aria-label="Progression de la séance"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={etat.fait}
          aria-valuetext={`${etat.fait} sur ${total}`}
        >
          <span
            className="block h-full rounded-full bg-pharmacie transition-[width] duration-200"
            style={{ width: `${progression}%` }}
          />
        </span>
        <span className="shrink-0 text-small font-semibold tabular-nums text-ink-3" aria-hidden="true">
          {etat.fait} / {total}
        </span>
      </div>

      <div className={`${card} flex min-h-[220px] flex-col justify-center gap-4 rounded-hero p-6`}>
        <ContenuColore
          contenu={carteCourante.question}
          className="whitespace-pre-line text-heading-sm font-semibold leading-snug text-ink text-balance"
        />
        <div aria-live="polite">
          {revele && (
            <div className="border-t border-line pt-4">
              <ContenuColore
                contenu={carteCourante.reponse}
                className="whitespace-pre-line text-body leading-[1.55] text-ink"
              />
            </div>
          )}
        </div>
        {notion && (
          <button
            type="button"
            onClick={() => setEnEdition(notion)}
            className={`${linkButton} self-start text-small`}
            aria-label={`Modifier la notion ${notion.titre}`}
          >
            Modifier la notion
          </button>
        )}
      </div>

      {revele ? (
        <ul className="grid grid-cols-4 gap-2">
          {NOTES_REVISION.map((note) => (
            <li key={note}>
              <button
                type="button"
                onClick={() => noter(note)}
                className={`${classeBouton(note)} flex min-h-14 w-full flex-col items-center justify-center px-1 py-2 text-small leading-tight`}
              >
                <span>{LIBELLES[note]}</span>
                <span className={`text-micro font-medium ${classeDelai(note)}`}>
                  {formaterDelai(prochainEtatCarte(carteCourante, note, new Date()))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" onClick={() => setRevele(true)} className={`${primaryButton} min-h-12 w-full`}>
          Voir la réponse
        </button>
      )}

      <AnimatePresence>
        {enEdition && (
          <NotionEditeur
            key={enEdition.id}
            notion={enEdition}
            nbCartes={snapshot.cartes.filter((c) => c.notion_id === enEdition.id).length}
            onClose={() => setEnEdition(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
