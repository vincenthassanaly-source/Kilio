"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import {
  EVENEMENT_SEANCE_EN_ATTENTE,
  ajusterDureeSeanceEnAttente,
  lireSeancesRefusees,
  supprimerSeanceEnAttente,
  synchroniserSeances,
  type SeanceRefusee,
} from "@/lib/musculation/brouillon";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, input, metaText, secondaryButton, sectionTitle } from "@/lib/ui";

const ERREUR_DUREE = "Durée de séance invalide.";

/**
 * Séances terminées que le serveur a refusées et qui attendent sur le téléphone.
 * Sans ce bandeau, une séance refusée restait bloquée à vie : aucun écran ne la
 * montrait. On propose d'en corriger la durée (cas d'une séance restée ouverte
 * plus de 24 h) ou de la supprimer. Ne rend rien quand il n'y en a pas.
 */
export function SeancesBloquees() {
  const queryClient = useQueryClient();
  const [seances, setSeances] = useState<SeanceRefusee[]>([]);
  const [aAjuster, setAAjuster] = useState<SeanceRefusee | null>(null);
  const [aSupprimer, setASupprimer] = useState<SeanceRefusee | null>(null);
  const [dureeMin, setDureeMin] = useState("60");

  const relire = useCallback(() => {
    void lireSeancesRefusees().then(setSeances);
  }, []);

  useEffect(() => {
    relire();
    window.addEventListener(EVENEMENT_SEANCE_EN_ATTENTE, relire);
    return () => window.removeEventListener(EVENEMENT_SEANCE_EN_ATTENTE, relire);
  }, [relire]);

  async function enregistrerAvecDuree() {
    if (!aAjuster) return;
    const minutes = Number(dureeMin);
    if (!(await ajusterDureeSeanceEnAttente(aAjuster.id, minutes))) {
      showErrorToast("Indique une durée entière entre 1 et 1440 minutes.");
      return;
    }
    setAAjuster(null);
    try {
      const resultat = await synchroniserSeances();
      if (resultat.envoyees > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.seances });
        queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
        queryClient.invalidateQueries({ queryKey: ["musculation-historique"] });
        showToast("Séance enregistrée");
      } else if (resultat.refus.length > 0) {
        showErrorToast(`${resultat.refus[0]} La séance reste sur ton téléphone.`);
      } else {
        showToast("Séance gardée sur ton téléphone : envoi dès que le réseau revient.", 4500);
      }
    } catch {
      showToast("Séance gardée sur ton téléphone : envoi dès que possible.", 4500);
    }
    relire();
  }

  async function supprimer() {
    if (!aSupprimer) return;
    await supprimerSeanceEnAttente(aSupprimer.id);
    setASupprimer(null);
    relire();
  }

  if (seances.length === 0) return null;

  return (
    <section className={`${card} flex flex-col gap-3`} aria-label="Séances à corriger">
      <h2 className={sectionTitle}>
        {seances.length > 1 ? "Séances non enregistrées" : "Séance non enregistrée"}
      </h2>
      {seances.map((seance) => (
        <div key={seance.id} className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-body font-medium text-ink break-words">{seance.nom}</span>
            <span className={metaText}>
              Démarrée le {new Date(seance.debutA).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} · {seance.erreur}
            </span>
            <span className={metaText}>Elle est gardée sur ton téléphone.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {seance.erreur === ERREUR_DUREE && (
              <button
                type="button"
                className={`${secondaryButton} h-11 !py-0 text-label`}
                onClick={() => {
                  setDureeMin("60");
                  setAAjuster(seance);
                }}
              >
                Indiquer la durée
              </button>
            )}
            <button
              type="button"
              className={`${dangerButton} h-11 !py-0`}
              onClick={() => setASupprimer(seance)}
            >
              Supprimer la séance
            </button>
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={aAjuster !== null}
        titre="Durée de la séance"
        confirmer="Enregistrer avec cette durée"
        destructif={false}
        onClose={() => setAAjuster(null)}
        onConfirm={() => void enregistrerAvecDuree()}
      >
        <p>Cette séance a été ouverte plus de 24 h. Indique sa durée réelle pour pouvoir l&apos;enregistrer.</p>
        <label className="flex flex-col gap-1.5 text-label font-semibold text-ink">
          Durée réelle (minutes)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            step={1}
            value={dureeMin}
            onChange={(e) => setDureeMin(e.target.value)}
            className={`${input} h-11 font-normal tabular-nums`}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        titre="Supprimer cette séance ?"
        confirmer="Supprimer la séance"
        onClose={() => setASupprimer(null)}
        onConfirm={() => void supprimer()}
      >
        <p>
          « {aSupprimer?.nom} » n&apos;a jamais été enregistrée : elle sera supprimée du téléphone et perdue
          définitivement.
        </p>
      </ConfirmDialog>
    </section>
  );
}
