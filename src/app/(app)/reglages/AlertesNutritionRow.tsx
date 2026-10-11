"use client";

import { useState, useTransition } from "react";
import { updateReglageAlerteKcal, updateReglagesRappelSaisie } from "@/app/actions/briefing";
import { Switch } from "@/components/Switch";
import { runAction } from "@/lib/actions/runAction";
import { errorText, input } from "@/lib/ui";
import type { Tables } from "@/lib/supabase/types";

function Pastille({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
      style={{ background: "color-mix(in oklch, var(--accent-kcal) 12%, transparent)" }}
    >
      {children}
    </span>
  );
}

const ICONE = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "var(--accent-kcal)",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const HEURE_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Alerte à l'approche de la limite kcal (85 %) et rappel de saisie du soir. */
export function AlertesNutritionRow({ reglages }: { reglages: Tables<"reglages_briefing"> }) {
  const [alerteKcal, setAlerteKcal] = useState(reglages.alerte_kcal_actif);
  const initialSaisie = { actif: reglages.rappel_saisie_actif, heure: reglages.rappel_saisie_heure.slice(0, 5) };
  const [saisie, setSaisie] = useState(initialSaisie);
  // Dernier état enregistré : référence pour le retour arrière après un échec.
  const [saisieEnregistree, setSaisieEnregistree] = useState(initialSaisie);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function basculerAlerteKcal() {
    const suivant = !alerteKcal;
    setError(null);
    setAlerteKcal(suivant);
    startTransition(async () => {
      await runAction(() => updateReglageAlerteKcal(suivant), {
        silencieux: true,
        erreur: "Le réglage n'a pas pu être enregistré. Réessaie.",
        onError: (message) => {
          setError(message);
          setAlerteKcal(!suivant);
        },
      });
    });
  }

  function persisterSaisie(suivant: typeof saisie) {
    if (!HEURE_REGEX.test(suivant.heure)) {
      setSaisie(saisieEnregistree);
      return;
    }
    if (suivant.actif === saisieEnregistree.actif && suivant.heure === saisieEnregistree.heure) return;
    const precedent = saisieEnregistree;
    setError(null);
    setSaisie(suivant);
    setSaisieEnregistree(suivant);
    startTransition(async () => {
      await runAction(() => updateReglagesRappelSaisie(suivant.actif, suivant.heure), {
        silencieux: true,
        erreur: "Le réglage n'a pas pu être enregistré. Réessaie.",
        onError: (message) => {
          setError(message);
          setSaisie(precedent);
          setSaisieEnregistree(precedent);
        },
      });
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2.5 border-t border-line py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
            <Pastille>
              <svg {...ICONE}>
                <path d="M12 3.5 22 20.5H2L12 3.5Z" />
                <path d="M12 10v4.5" />
                <circle cx="12" cy="17.5" r="0.6" fill="var(--accent-kcal)" />
              </svg>
            </Pastille>
            Alerte limite kcal
          </span>
          <Switch checked={alerteKcal} onToggle={basculerAlerteKcal} label="Alerte à l'approche de la limite kcal" />
        </div>
        <p className="text-[12.5px] leading-snug text-ink-2">
          {alerteKcal
            ? "Une notification (une par jour) quand tu atteins 85 % de ta limite kcal. Pas d'alerte un jour libre. Nécessite les notifications ci-dessus."
            : "Désactivée : aucune alerte quand tu approches de ta limite kcal."}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
            <Pastille>
              <svg {...ICONE}>
                <path d="M5 6.5h14M5 12h14M5 17.5h8" />
              </svg>
            </Pastille>
            Rappel de saisie
          </span>
          <Switch
            checked={saisie.actif}
            onToggle={() => persisterSaisie({ ...saisie, actif: !saisie.actif })}
            label="Rappel de saisie des repas"
          />
        </div>
        <p className="text-[12.5px] leading-snug text-ink-2">
          {saisie.actif
            ? "Si ton journal est vide à l'heure choisie, une notification te rappelle de saisir tes repas."
            : "Désactivé : aucun rappel quand le journal reste vide."}
        </p>
        {saisie.actif && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="heure-rappel-saisie" className="text-[13px] text-ink-2">
              Heure du rappel
            </label>
            <input
              id="heure-rappel-saisie"
              type="time"
              value={saisie.heure}
              onChange={(e) => setSaisie({ ...saisie, heure: e.target.value })}
              onBlur={(e) => persisterSaisie({ ...saisie, heure: e.target.value })}
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
    </>
  );
}
