"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ecouterConfirmations, type DemandeConfirmation } from "@/lib/confirm";

/**
 * Hôte unique du dialogue de `confirmDelete` (lib/confirm.ts), monté dans
 * Providers : tout l'app confirme une suppression avec le même dialogue.
 */
export function ConfirmHost() {
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  useEffect(() => ecouterConfirmations(setDemande), []);

  return (
    <ConfirmDialog
      open={demande !== null}
      titre="Confirmer"
      confirmer={demande?.confirmer ?? "Supprimer"}
      onConfirm={() => demande?.resoudre(true)}
      onClose={() => demande?.resoudre(false)}
    >
      <p>{demande?.message}</p>
    </ConfirmDialog>
  );
}
