"use client";

import { useState, useTransition } from "react";
import { updateReglageRappelsSeances } from "@/app/actions/briefing";
import { Switch } from "@/components/Switch";
import { runAction } from "@/lib/actions/runAction";
import { errorText } from "@/lib/ui";
import type { Tables } from "@/lib/supabase/types";

function HalterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </svg>
  );
}

export function SeancesRappelRow({ reglages }: { reglages: Tables<"reglages_briefing"> }) {
  const [actif, setActif] = useState(reglages.seances_rappel_actif);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function basculer() {
    const suivant = !actif;
    const precedent = actif;
    setError(null);
    setActif(suivant);
    startTransition(async () => {
      await runAction(() => updateReglageRappelsSeances(suivant), {
        silencieux: true,
        erreur: "Le réglage n'a pas pu être enregistré. Réessaie.",
        onError: (message) => {
          setError(message);
          setActif(precedent);
        },
      });
    });
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-line py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "color-mix(in oklch, var(--accent-kcal) 12%, transparent)" }}
          >
            <HalterIcon />
          </span>
          Rappel de séance
        </span>
        <Switch checked={actif} onToggle={basculer} label="Rappel de séance de sport" />
      </div>
      <p className="text-[12.5px] leading-snug text-ink-2">
        {actif
          ? "À l'heure de chaque séance planifiée, une notification te propose de commencer ou de décaler. Nécessite les notifications ci-dessus."
          : "Désactivé : aucun rappel de séance (les séances restent visibles dans Aujourd'hui)."}
      </p>
      {error && (
        <p role="alert" className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}
