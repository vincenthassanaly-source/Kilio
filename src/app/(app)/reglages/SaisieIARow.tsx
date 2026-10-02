"use client";

import { useState, useTransition } from "react";
import { updateListeSaisieIA } from "@/app/actions/reglages-saisie-ia";
import { runAction } from "@/lib/actions/runAction";
import { errorText, input } from "@/lib/ui";

const AUCUNE = "";

function SaisieIAIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}

export function SaisieIARow({
  listes,
  listeId,
}: {
  listes: { id: string; nom: string }[];
  listeId: string | null;
}) {
  // Une liste supprimée entre-temps n'est plus proposée : on l'affiche comme
  // « aucune » plutôt que de montrer un identifiant orphelin.
  const valeurInitiale = listeId && listes.some((l) => l.id === listeId) ? listeId : AUCUNE;
  const [valeur, setValeur] = useState(valeurInitiale);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function changer(suivante: string) {
    const precedente = valeur;
    setValeur(suivante);
    setError(null);
    startTransition(async () => {
      await runAction(() => updateListeSaisieIA(suivante === AUCUNE ? null : suivante), {
        silencieux: true,
        erreur: "Le réglage n'a pas pu être enregistré. Réessaie.",
        onError: (message) => {
          setError(message);
          setValeur(precedente);
        },
      });
    });
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-line py-3.5">
      <label htmlFor="liste-saisie-ia" className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in oklch, var(--accent-kcal) 12%, transparent)" }}
        >
          <SaisieIAIcon />
        </span>
        Liste des tâches de « Ajouter avec l&apos;IA »
      </label>
      <select
        id="liste-saisie-ia"
        value={valeur}
        onChange={(e) => changer(e.target.value)}
        className={`${input} text-[13px]`}
      >
        <option value={AUCUNE}>Liste « Tâches » (créée si besoin)</option>
        {listes.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nom}
          </option>
        ))}
      </select>
      <p className="text-[12.5px] leading-snug text-ink-2">
        Les tâches proposées par l&apos;IA vont dans cette liste, sauf si tu en nommes une dans ta phrase.
      </p>
      {error && (
        <p role="alert" className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}
