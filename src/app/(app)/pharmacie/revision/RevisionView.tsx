"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { noterCarte } from "@/app/actions/pharmacie";
import { TransitionLink } from "@/components/TransitionLink";
import { showErrorToast } from "@/components/toast/toast-store";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import { card, linkButton, primaryButton, screenTitle, secondaryButton } from "@/lib/ui";
import { formaterDelai } from "@/lib/pharmacie/format";
import { cartesARevoir } from "@/lib/pharmacie/selecteurs";
import { NOTES_REVISION, prochainEtatCarte, type NoteRevision } from "@/lib/pharmacie/srs";
import { modifierSnapshot } from "@/lib/pharmacie/useSnapshotPharmacie";
import type { PharmaSnapshot } from "@/lib/pharmacie/types";
import { AvecSnapshot } from "../EtatSnapshot";
import { ContenuColore } from "../ContenuColore";

// Taille d'une séance : assez pour être utile, assez court pour se faire en
// pause. Les cartes « À revoir » repassent en fin de séance.
const TAILLE_SEANCE = 20;

const LIBELLES: Record<NoteRevision, string> = {
  "a-revoir": "À revoir",
  difficile: "Difficile",
  bien: "Bien",
  facile: "Facile",
};

export function RevisionView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <TransitionLink href="/pharmacie" className={`${linkButton} self-start`}>
          ← Pharmacie
        </TransitionLink>
        <h1 className={screenTitle}>Révision</h1>
      </div>
      <AvecSnapshot>{(snapshot) => <Seance snapshot={snapshot} />}</AvecSnapshot>
    </div>
  );
}

type Bilan = Record<NoteRevision, number>;

function Seance({ snapshot }: { snapshot: PharmaSnapshot }) {
  const queryClient = useQueryClient();
  // File figée au montage : noter une carte modifie l'instantané (et donc la
  // liste « à réviser ») sans réordonner la séance en cours.
  const [file, setFile] = useState<string[]>(() =>
    cartesARevoir(snapshot.cartes, new Date())
      .slice(0, TAILLE_SEANCE)
      .map((c) => c.id)
  );
  const [total] = useState(file.length);
  const [revele, setRevele] = useState(false);
  const [fait, setFait] = useState(0);
  const [bilan, setBilan] = useState<Bilan>({ "a-revoir": 0, difficile: 0, bien: 0, facile: 0 });

  const cartes = useMemo(() => new Map(snapshot.cartes.map((c) => [c.id, c])), [snapshot.cartes]);
  const carte = file.length > 0 ? cartes.get(file[0]) : undefined;

  if (total === 0) {
    return (
      <div className={`${card} flex flex-col gap-1`} role="status">
        <p className="text-[15px] font-bold text-ink">Rien à réviser</p>
        <p className="text-[14px] text-ink-2">Toutes tes cartes sont à jour. Reviens plus tard.</p>
      </div>
    );
  }

  if (!carte) {
    return (
      <div className={`${card} flex flex-col gap-4`} role="status">
        <div>
          <p className="font-display text-[22px] font-bold text-ink">Séance terminée</p>
          <p className="text-[14px] text-ink-2">
            {fait} carte{fait > 1 ? "s" : ""} revue{fait > 1 ? "s" : ""}.
          </p>
        </div>
        <ul className="grid grid-cols-4 gap-2 text-center">
          {NOTES_REVISION.map((note) => (
            <li key={note} className="rounded-2xl bg-surface-alt px-1 py-2">
              <p className="font-display text-[18px] font-bold text-ink">{bilan[note]}</p>
              <p className="text-[11px] font-semibold text-ink-2">{LIBELLES[note]}</p>
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

  async function noter(note: NoteRevision) {
    const maintenant = new Date();
    const suivant = prochainEtatCarte(carteCourante, note, maintenant);

    // Optimiste : la séance avance tout de suite, l'écriture suit (ou part
    // dans la file hors ligne si le réseau manque).
    setBilan((b) => ({ ...b, [note]: b[note] + 1 }));
    setRevele(false);
    setFile((f) => (note === "a-revoir" ? [...f.slice(1), f[0]] : f.slice(1)));
    if (note !== "a-revoir") setFait((n) => n + 1);
    modifierSnapshot(queryClient, (s) => ({
      ...s,
      cartes: s.cartes.map((c) => (c.id === carteCourante.id ? { ...c, ...suivant } : c)),
    }));

    try {
      await noterCarte(carteCourante.id, note, maintenant.toISOString());
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueAction("pharmacie", "noterCarte", [carteCourante.id, note, maintenant.toISOString()]);
      } else {
        showErrorToast("La note n'a pas pu être enregistrée.");
      }
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Carte de révision">
      <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink-3">
        <span>
          {fait} / {total}
        </span>
        <span aria-live="polite">{file.length} restante{file.length > 1 ? "s" : ""}</span>
      </div>

      <div className={`${card} flex min-h-[220px] flex-col justify-center gap-4 rounded-[24px] p-6`}>
        <ContenuColore
          contenu={carteCourante.question}
          className="whitespace-pre-line text-[17px] font-semibold leading-snug text-ink text-balance"
        />
        {revele && (
          <div className="border-t border-line pt-4">
            <ContenuColore
              contenu={carteCourante.reponse}
              className="whitespace-pre-line text-[15px] leading-[1.55] text-ink"
            />
          </div>
        )}
      </div>

      {revele ? (
        <ul className="grid grid-cols-4 gap-2">
          {NOTES_REVISION.map((note) => (
            <li key={note}>
              <button
                type="button"
                onClick={() => noter(note)}
                className={`${note === "bien" ? primaryButton : secondaryButton} flex min-h-14 w-full flex-col items-center justify-center px-1 py-2 text-[13px] leading-tight`}
              >
                <span>{LIBELLES[note]}</span>
                <span className={`text-[11px] font-medium ${note === "bien" ? "opacity-80" : "text-ink-2"}`}>
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
    </section>
  );
}
