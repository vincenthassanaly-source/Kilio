"use client";

import { useState, useTransition } from "react";
import { updateReglagesVidage } from "@/app/actions/vidage";
import { Switch } from "@/components/Switch";
import { runAction } from "@/lib/actions/runAction";
import { errorText, input } from "@/lib/ui";
import type { Tables } from "@/lib/supabase/types";

function VidageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-vidage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

type Etat = { actif: boolean; heure: string };

/** Push du soir « Vider ta tête ? », envoyé seulement si la feuille du jour est encore vide. */
export function VidageRow({ reglages }: { reglages: Tables<"reglages_briefing"> }) {
  const initial: Etat = { actif: reglages.vidage_actif, heure: reglages.vidage_heure.slice(0, 5) };
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
    if (suivant.actif === enregistre.actif && suivant.heure === enregistre.heure) return;
    const precedent = enregistre;
    setError(null);
    setEtat(suivant);
    setEnregistre(suivant);
    startTransition(async () => {
      await runAction(() => updateReglagesVidage(suivant.actif, suivant.heure), {
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
            style={{ background: "color-mix(in oklch, var(--accent-vidage) 12%, transparent)" }}
          >
            <VidageIcon />
          </span>
          Vider ma tête
        </span>
        <Switch
          checked={etat.actif}
          onToggle={() => persister({ ...etat, actif: !etat.actif })}
          label="Rappel du soir pour vider ma tête"
        />
      </div>
      <p className="text-[12.5px] leading-snug text-ink-2">
        {etat.actif
          ? "Chaque soir à l'heure choisie, une notification te propose d'écrire, sauf si ta feuille du jour est déjà écrite. Nécessite les notifications ci-dessus."
          : "Désactivé : aucun rappel (la feuille reste accessible dans Plus › Vider ma tête)."}
      </p>
      {etat.actif && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="heure-vidage" className="text-[13px] text-ink-2">
            Heure du rappel
          </label>
          <input
            id="heure-vidage"
            type="time"
            value={etat.heure}
            onChange={(e) => setEtat({ ...etat, heure: e.target.value })}
            onBlur={(e) => persister({ ...etat, heure: e.target.value })}
            className={`${input} min-h-11 w-28 text-center tabular-nums`}
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
