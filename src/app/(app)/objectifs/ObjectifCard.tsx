"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supprimerObjectif } from "@/app/actions/objectifs";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import { ObjectifForm } from "./ObjectifForm";
import type { Enums, Tables } from "@/lib/supabase/types";
import { TransitionLink } from "@/components/TransitionLink";
import { card, dangerButton, ghostButton, listCard, metaText, nameText, pillTag } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";

const TYPE_SUIVI_LABELS: Record<Enums<"type_suivi_objectif">, string> = {
  valeur: "Valeur",
  etapes: "Étapes",
  binaire: "Fait / pas fait",
  habitudes: "Habitudes",
  nutrition: "Nutrition",
};

function formatEcheance(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ObjectifCardBase({ objectif }: { objectif: Tables<"objectifs"> }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  function invalidate() {
    // Symétrique à ObjectifHeader : la page détail lit `objectif(id)`, une
    // clé disjointe de `objectifs` (liste) — l'invalider aussi ici évite
    // qu'un titre/statut édité depuis la carte reste périmé sur la page
    // détail jusqu'à 30s (CLICK-PATH-501).
    queryClient.invalidateQueries({ queryKey: queryKeys.objectifs });
    queryClient.invalidateQueries({ queryKey: queryKeys.objectif(objectif.id) });
  }

  // Suppression retirée du cache dans `onMutate`, avant l'appel serveur : la
  // Server Action se termine par un `redirect("/objectifs")` (partagé avec
  // ObjectifHeader, cf. page détail), qui interrompt l'exécution en jetant —
  // tout code placé après un simple `await supprimerObjectif(...)` ne
  // s'exécuterait donc jamais.
  const deleteMutation = useMutation({
    mutationFn: () => supprimerObjectif(objectif.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.objectifs });
      const previous = queryClient.getQueryData<Tables<"objectifs">[]>(queryKeys.objectifs);
      queryClient.setQueryData<Tables<"objectifs">[]>(queryKeys.objectifs, (old) =>
        old?.filter((o) => o.id !== objectif.id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.objectifs, context.previous);
      showToast("Impossible de supprimer l'objectif.");
    },
  });

  if (editing) {
    return (
      <motion.li
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className={card}
      >
        <ObjectifForm
          objectif={objectif}
          onDone={() => {
            setEditing(false);
            invalidate();
          }}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-2 text-sm text-ink-2 underline"
        >
          Annuler
        </button>
      </motion.li>
    );
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={listCard}
    >
      <TransitionLink href={`/objectifs/${objectif.id}`} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className={nameText} style={{ viewTransitionName: `objectif-title-${objectif.id}` }}>
            {objectif.titre}
          </p>
          <span className={pillTag}>{TYPE_SUIVI_LABELS[objectif.type_suivi]}</span>
        </div>
        {objectif.description && (
          <p className="line-clamp-2 text-[13px] text-ink-2 text-pretty">{objectif.description}</p>
        )}
        {objectif.date_echeance && (
          <span className={metaText}>Échéance : {formatEcheance(objectif.date_echeance)}</span>
        )}
      </TransitionLink>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
          Modifier
        </button>
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (!confirmDelete(`Supprimer l'objectif « ${objectif.titre} » ?`)) return;
            deleteMutation.mutate();
          }}
          className={dangerButton}
        >
          Suppr.
        </button>
      </div>
    </motion.li>
  );
}

export const ObjectifCard = memo(ObjectifCardBase);
