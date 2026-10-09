"use client";

import { useState, useTransition } from "react";
import { updateReglagesBriefing } from "@/app/actions/briefing";
import { Switch } from "@/components/Switch";
import { runAction } from "@/lib/actions/runAction";
import { errorText, input } from "@/lib/ui";
import type { Tables } from "@/lib/supabase/types";

function BriefingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  );
}

export function BriefingRow({ reglages }: { reglages: Tables<"reglages_briefing"> }) {
  const [actif, setActif] = useState(reglages.actif);
  const [heure, setHeure] = useState(reglages.heure.slice(0, 5));
  // Dernière heure enregistrée : référence pour ignorer un blur sans changement
  // et pour revenir en arrière après un échec.
  const [heureEnregistree, setHeureEnregistree] = useState(reglages.heure.slice(0, 5));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // L'échec revient en message lisible et le réglage reprend sa position.
  function persister(nextActif: boolean, nextHeure: string, precedentActif: boolean, precedentHeure: string) {
    setError(null);
    setHeureEnregistree(nextHeure);
    startTransition(async () => {
      await runAction(() => updateReglagesBriefing(nextActif, nextHeure), {
        silencieux: true,
        erreur: "Le réglage n'a pas pu être enregistré. Réessaie.",
        onError: (message) => {
          setError(message);
          setActif(precedentActif);
          setHeure(precedentHeure);
          setHeureEnregistree(precedentHeure);
        },
      });
    });
  }

  function toggle() {
    const suivant = !actif;
    setActif(suivant);
    persister(suivant, heureEnregistree, actif, heureEnregistree);
  }

  function validerHeure(valeur: string) {
    if (valeur === heureEnregistree) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valeur)) {
      setHeure(heureEnregistree);
      return;
    }
    persister(actif, valeur, actif, heureEnregistree);
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-line py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "color-mix(in oklch, var(--accent-kcal) 12%, transparent)" }}
          >
            <BriefingIcon />
          </span>
          Briefing du matin
        </span>
        <Switch checked={actif} onToggle={toggle} label="Briefing du matin" />
      </div>
      <p className="text-[12.5px] leading-snug text-ink-2">
        {actif
          ? "Chaque matin, une notification résume ta journée : rendez-vous, tâches du jour et retards. Rien n'est envoyé si la journée est vide. Nécessite les notifications ci-dessus."
          : "Désactivé : aucune notification le matin."}
      </p>
      {actif && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="heure-briefing" className="text-[13px] text-ink-2">
            Heure d&apos;envoi
          </label>
          <input
            id="heure-briefing"
            type="time"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
            onBlur={(e) => validerHeure(e.target.value)}
            className={`${input} min-h-11 w-28 shrink-0 text-center tabular-nums`}
          />
        </div>
      )}
      {error && (
        <p role="alert" className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}
