"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { showToast } from "@/components/toast/toast-store";
import { EtincelleIcon } from "@/components/EtincelleIcon";
import { queryKeys } from "@/lib/query/keys";
import { secondaryButton } from "@/lib/ui";
import type { ModeAssistantRevue } from "./AssistantRevueModal";

const AssistantRevueModal = dynamic(() => import("./AssistantRevueModal").then((m) => m.AssistantRevueModal), {
  ssr: false,
});

const ACTIONS: { mode: ModeAssistantRevue; libelle: string; detail: string }[] = [
  { mode: "semaine", libelle: "Analyser ma semaine", detail: "Tâches, habitudes, santé et notes croisées" },
  { mode: "bilan", libelle: "Résumer les 7 derniers jours", detail: "Ce qui s'est passé, en quelques phrases" },
  { mode: "avenir", libelle: "Résumer les 7 prochains jours", detail: "Ce qui t'attend, en quelques phrases" },
  { mode: "replanifier", libelle: "Replanifier les retards", detail: "Propose de nouvelles dates, tu valides" },
];

/**
 * Point d'entrée unique de l'assistant IA de la Revue : une carte qui déplie la
 * liste des actions (analyse, deux résumés, replanification), au lieu de quatre
 * boutons répartis dans l'écran. « Replanifier » n'est proposé que s'il y a des
 * tâches en retard. Après une replanification, les tâches en cache sont
 * rechargées (la Revue, l'Agenda et Aujourd'hui partagent la même clé).
 */
export function MenuAssistantRevue({ peutReplanifier }: { peutReplanifier: boolean }) {
  const [deplie, setDeplie] = useState(false);
  const [mode, setMode] = useState<ModeAssistantRevue | null>(null);
  const idListe = useId();
  const queryClient = useQueryClient();

  const actions = ACTIONS.filter((a) => a.mode !== "replanifier" || peutReplanifier);

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Bouton secondaire après les étapes : la revue se lit d'abord, l'IA vient en complément. */}
        <button
          type="button"
          onClick={() => setDeplie((d) => !d)}
          aria-expanded={deplie}
          aria-controls={idListe}
          className={`${secondaryButton} flex min-h-11 w-full items-center justify-between gap-3 text-left`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-kcal">
              <EtincelleIcon size={18} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body font-semibold text-ink">Assistant IA</span>
              <span className="text-small font-medium text-ink-2">Analyse, résumés et replanification</span>
            </span>
          </span>
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-ink-3 transition-transform duration-150 ease-[var(--ease-out)] ${deplie ? "rotate-90" : ""}`}>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {deplie && (
          <ul id={idListe} className="flex flex-col gap-2">
            {actions.map((action) => (
              <li key={action.mode}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setDeplie(false);
                    setMode(action.mode);
                  }}
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
                >
                  <span className="text-body font-medium text-ink">{action.libelle}</span>
                  <span className="text-label text-ink-2">{action.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {mode !== null && (
          <AssistantRevueModal
            key="assistant-revue"
            mode={mode}
            onClose={() => setMode(null)}
            onApplied={(nb) => {
              setMode(null);
              void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
              showToast(nb <= 1 ? "1 tâche replanifiée" : `${nb} tâches replanifiées`);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
