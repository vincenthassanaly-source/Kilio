"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { creerCreneau, modifierCreneau, supprimerCreneau, type CreneauInput } from "@/app/actions/seances";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { confirmDelete } from "@/lib/confirm";
import { queryKeys } from "@/lib/query/keys";
import { heureCourte, estTypeSeance, JOURS_LONGS, TYPES_SEANCE, type Creneau } from "@/lib/seances/compute";
import { errorText, ghostButton, input, label, primaryButton, secondaryButton } from "@/lib/ui";

// Lundi d'abord, comme la semaine affichée (jour_semaine : 0 = dimanche).
const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0] as const;
const BROUILLON_VIDE: CreneauInput = { jourSemaine: 1, heure: "18:00", type: TYPES_SEANCE[0] };

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

type Edition = { id: string | null } | null;

/**
 * Plan type de la semaine : les créneaux récurrents (jour, heure, type) dont
 * découlent les séances de la semaine et leurs rappels. Modifier ou supprimer
 * un créneau régénère ses séances à venir ; les séances déjà faites restent.
 */
export function PlanningSeancesModal({ creneaux, onClose }: { creneaux: Creneau[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState<Edition>(creneaux.length === 0 ? { id: null } : null);
  const [brouillon, setBrouillon] = useState<CreneauInput>(BROUILLON_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tries = [...creneaux].sort(
    (a, b) => ORDRE_JOURS.indexOf(a.jour_semaine as 0) - ORDRE_JOURS.indexOf(b.jour_semaine as 0) || a.heure.localeCompare(b.heure)
  );

  function ouvrir(creneau: Creneau | null) {
    setErreur(null);
    setBrouillon(
      creneau
        ? { jourSemaine: creneau.jour_semaine, heure: heureCourte(creneau.heure), type: estTypeSeance(creneau.type) ? creneau.type : TYPES_SEANCE[0] }
        : BROUILLON_VIDE
    );
    setEdition({ id: creneau?.id ?? null });
  }

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: queryKeys.seances });

  function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (!edition) return;
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(
        () => (edition.id ? modifierCreneau(edition.id, brouillon) : creerCreneau(brouillon)),
        { silencieux: true, onError: setErreur }
      );
      if (!resultat.ok) return;
      await rafraichir();
      showToast(edition.id ? "Créneau modifié" : "Créneau ajouté");
      setEdition(null);
    });
  }

  function supprimer(creneau: Creneau) {
    if (!confirmDelete(`Supprimer le créneau « ${creneau.type} » du ${JOURS_LONGS[creneau.jour_semaine]} ?`)) return;
    startTransition(async () => {
      const resultat = await runAction(() => supprimerCreneau(creneau.id));
      if (!resultat.ok) return;
      await rafraichir();
      showToast("Créneau supprimé");
    });
  }

  return (
    <Modal title="Planning des séances" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {tries.length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {tries.map((creneau) => (
              <li key={creneau.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-medium text-ink">{creneau.type}</p>
                  <p className="text-[12.5px] tabular-nums text-ink-2">
                    {majuscule(JOURS_LONGS[creneau.jour_semaine])} · {heureCourte(creneau.heure)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => ouvrir(creneau)} disabled={pending} className={ghostButton}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => supprimer(creneau)}
                    disabled={pending}
                    aria-label={`Supprimer le créneau ${creneau.type} du ${JOURS_LONGS[creneau.jour_semaine]}`}
                    className={`${ghostButton} text-alert`}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {edition ? (
          <form onSubmit={enregistrer} className="flex flex-col gap-3">
            {tries.length === 0 && (
              <p className="text-[13.5px] leading-snug text-ink-2">
                Trois séances par semaine, à heures fixes, c&apos;est un rythme qui se tient dans la durée. Tu pourras
                décaler une séance sans la perdre.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="creneau-type" className={label}>
                Séance
              </label>
              <select
                id="creneau-type"
                value={brouillon.type}
                onChange={(e) => setBrouillon({ ...brouillon, type: e.target.value })}
                className={`${input} min-h-11`}
              >
                {TYPES_SEANCE.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="creneau-jour" className={label}>
                  Jour
                </label>
                <select
                  id="creneau-jour"
                  value={brouillon.jourSemaine}
                  onChange={(e) => setBrouillon({ ...brouillon, jourSemaine: Number(e.target.value) })}
                  className={`${input} min-h-11`}
                >
                  {ORDRE_JOURS.map((jour) => (
                    <option key={jour} value={jour}>
                      {majuscule(JOURS_LONGS[jour])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="creneau-heure" className={label}>
                  Heure
                </label>
                <input
                  id="creneau-heure"
                  type="time"
                  value={brouillon.heure}
                  onChange={(e) => setBrouillon({ ...brouillon, heure: e.target.value })}
                  className={`${input} min-h-11 w-28 text-center tabular-nums`}
                  required
                />
              </div>
            </div>
            {erreur && (
              <p role="alert" className={errorText}>
                {erreur}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={`${primaryButton} flex-1`}>
                {edition.id ? "Enregistrer" : "Ajouter le créneau"}
              </button>
              {tries.length > 0 && (
                <button type="button" onClick={() => setEdition(null)} disabled={pending} className={secondaryButton}>
                  Annuler
                </button>
              )}
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => ouvrir(null)} disabled={pending} className={secondaryButton}>
            Ajouter un créneau
          </button>
        )}
      </div>
    </Modal>
  );
}
