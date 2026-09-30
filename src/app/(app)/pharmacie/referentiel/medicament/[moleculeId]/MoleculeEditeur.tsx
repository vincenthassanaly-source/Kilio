"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { modifierMolecule } from "@/app/actions/pharmacie";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { errorText, input, label, primaryButton } from "@/lib/ui";
import type { PharmaMolecule } from "@/lib/pharmacie/referentiel";

// Correction rapide des textes d'une molécule. Les ajouts (classes, molécules,
// protocoles) passent par le chat ; ici seulement les indications et les
// particularités, qui sont les champs qu'on retouche le plus souvent.
export function MoleculeEditeur({ molecule, onClose }: { molecule: PharmaMolecule; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [indications, setIndications] = useState(molecule.indications.join("\n"));
  const [particularites, setParticularites] = useState(molecule.particularites ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(
        () => modifierMolecule(molecule.id, { indications: indications.split("\n"), particularites }),
        { silencieux: true, onError: setErreur }
      );
      if (!resultat.ok) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.pharmacieReferentiel });
      showToast("Fiche enregistrée");
      onClose();
    });
  }

  return (
    <Modal title={`Modifier ${molecule.dci}`} onClose={onClose}>
      <form onSubmit={enregistrer} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Indications (une par ligne)</span>
          <textarea
            value={indications}
            onChange={(e) => setIndications(e.target.value)}
            rows={4}
            className={`${input} resize-y leading-[1.5]`}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Particularités</span>
          <textarea
            value={particularites}
            onChange={(e) => setParticularites(e.target.value)}
            rows={5}
            className={`${input} resize-y leading-[1.5]`}
          />
        </label>
        {erreur && (
          <p role="alert" className={errorText}>
            {erreur}
          </p>
        )}
        <button type="submit" disabled={enCours} className={`${primaryButton} self-end`}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </Modal>
  );
}
