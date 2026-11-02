"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { showToast } from "@/components/toast/toast-store";
import { EtincelleIcon } from "@/components/EtincelleIcon";
import { queryKeys } from "@/lib/query/keys";
import { ghostButton } from "@/lib/ui";
import type { ModeAssistantRevue } from "./AssistantRevueModal";

const AssistantRevueModal = dynamic(() => import("./AssistantRevueModal").then((m) => m.AssistantRevueModal), {
  ssr: false,
});

/**
 * Petit bouton « IA » d'un bloc de la Revue : ouvre la fenêtre de l'assistant.
 * Après une replanification, les tâches en cache sont rechargées (la Revue,
 * l'Agenda et Aujourd'hui partagent la même clé).
 */
export function BoutonAssistantRevue({ mode, libelle }: { mode: ModeAssistantRevue; libelle: string }) {
  const [ouvert, setOuvert] = useState(false);
  const queryClient = useQueryClient();

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        className={`${ghostButton} flex shrink-0 items-center gap-1.5`}
      >
        <EtincelleIcon size={15} />
        {libelle}
      </button>
      <AnimatePresence>
        {ouvert && (
          <AssistantRevueModal
            key="assistant-revue"
            mode={mode}
            onClose={() => setOuvert(false)}
            onApplied={(nb) => {
              setOuvert(false);
              void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
              showToast(nb <= 1 ? "1 tâche replanifiée" : `${nb} tâches replanifiées`);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
