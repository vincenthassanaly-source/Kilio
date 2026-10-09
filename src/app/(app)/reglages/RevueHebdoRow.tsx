"use client";

import { useState, useTransition } from "react";
import { updateReglagesRevue } from "@/app/actions/briefing";
import { Switch } from "@/components/Switch";
import { runAction } from "@/lib/actions/runAction";
import { errorText, input } from "@/lib/ui";
import type { Tables } from "@/lib/supabase/types";

// 0 = dimanche, comme Date#getDay et la colonne revue_jour.
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

function RevueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4.5" width="16" height="16" rx="3" />
      <path d="M8 3v3M16 3v3M4 10h16" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

type Etat = { actif: boolean; jour: number; heure: string };

export function RevueHebdoRow({ reglages }: { reglages: Tables<"reglages_briefing"> }) {
  const initial: Etat = { actif: reglages.revue_actif, jour: reglages.revue_jour, heure: reglages.revue_heure.slice(0, 5) };
  const [etat, setEtat] = useState<Etat>(initial);
  // Dernier état enregistré : référence pour le retour arrière après un échec.
  const [enregistre, setEnregistre] = useState<Etat>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function persister(suivant: Etat) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(suivant.heure)) {
      setEtat(enregistre);
      return;
    }
    if (suivant.actif === enregistre.actif && suivant.jour === enregistre.jour && suivant.heure === enregistre.heure) return;
    const precedent = enregistre;
    setError(null);
    setEtat(suivant);
    setEnregistre(suivant);
    startTransition(async () => {
      await runAction(() => updateReglagesRevue(suivant.actif, suivant.jour, suivant.heure), {
        silencieux: true,
        erreur: "Le réglage n'a pas pu être enregistré. Réessaie.",
        onError: (message) => {
          setError(message);
          setEtat(precedent);
          setEnregistre(precedent);
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
            <RevueIcon />
          </span>
          Rappel de revue hebdo
        </span>
        <Switch
          checked={etat.actif}
          onToggle={() => persister({ ...etat, actif: !etat.actif })}
          label="Rappel de la revue hebdomadaire"
        />
      </div>
      <p className="text-[12.5px] leading-snug text-ink-2">
        {etat.actif
          ? "Une fois par semaine, une notification t'invite à faire le point : bilan, retards à replanifier, 7 prochains jours. Nécessite les notifications ci-dessus."
          : "Désactivé : aucun rappel de revue (la revue reste accessible depuis Aujourd'hui)."}
      </p>
      {etat.actif && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="jour-revue" className="text-[13px] text-ink-2">
            Jour et heure
          </label>
          <div className="flex items-center gap-2">
            <select
              id="jour-revue"
              value={etat.jour}
              onChange={(e) => persister({ ...etat, jour: Number(e.target.value) })}
              className={`${input} min-h-11 shrink-0`}
            >
              {JOURS.map((nom, i) => (
                <option key={nom} value={i}>
                  {nom}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="Heure du rappel de revue"
              value={etat.heure}
              onChange={(e) => setEtat({ ...etat, heure: e.target.value })}
              onBlur={(e) => persister({ ...etat, heure: e.target.value })}
              className={`${input} min-h-11 w-28 shrink-0 text-center tabular-nums`}
            />
          </div>
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
