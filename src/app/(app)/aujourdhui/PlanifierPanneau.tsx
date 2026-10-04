"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { planifierTache, restaurerPlanification, type TacheAvecRelations } from "@/app/actions/taches";
import { showActionToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { DUREE_PLANIFICATION_PAR_DEFAUT, proposerCreneaux } from "@/lib/aujourdhui/compute";
import { queryKeys } from "@/lib/query/keys";
import type { Plage } from "@/lib/programme/disponibilites";
import { libelleDuree } from "@/lib/taches/compute";

// Durées proposées dans le panneau : de quoi couvrir une tâche courante sans
// ouvrir un formulaire.
const DUREES_PANNEAU = [15, 30, 45, 60, 90, 120] as const;

const chip =
  "relative min-h-9 rounded-full border px-3 text-[12.5px] font-semibold tabular-nums transition-colors active:scale-[0.97] disabled:opacity-50 after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

/**
 * Panneau « Planifier » d'une tâche du jour : la durée, puis les créneaux libres
 * qui la contiennent. Un tap sur un créneau place la tâche (date du jour, heure
 * de début, fin = début + durée) ; « Annuler » rétablit l'état d'avant.
 */
export function PlanifierPanneau({
  tache,
  today,
  libres,
  onClose,
}: {
  tache: TacheAvecRelations;
  today: string;
  libres: Plage[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [duree, setDuree] = useState<number>(tache.duree_minutes ?? DUREE_PLANIFICATION_PAR_DEFAUT);
  const [enCours, setEnCours] = useState(false);

  // Durée de la tâche hors de la liste proposée : conservée comme choix.
  const durees = useMemo(
    () => ([...DUREES_PANNEAU].includes(duree as (typeof DUREES_PANNEAU)[number]) ? [...DUREES_PANNEAU] : [...DUREES_PANNEAU, duree].sort((a, b) => a - b)),
    [duree]
  );
  const creneaux = useMemo(() => proposerCreneaux(libres, duree), [libres, duree]);

  async function planifier(creneau: Plage) {
    if (enCours) return;
    setEnCours(true);
    // État d'avant, relevé au tap, pour « Annuler ».
    const avant = {
      echeance: tache.echeance,
      heure: tache.heure,
      heure_fin: tache.heure_fin,
      toute_la_journee: tache.toute_la_journee,
      duree_minutes: tache.duree_minutes ?? null,
    };
    // La durée n'est enregistrée que si la tâche n'en avait pas : on ne
    // remplace jamais une estimation saisie.
    const ecrireDuree = tache.duree_minutes == null;
    const resultat = await runAction(() => planifierTache(tache.id, today, creneau.debut, duree, ecrireDuree));
    setEnCours(false);
    if (!resultat.ok) return;

    await queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    onClose();
    const texte = `« ${tache.titre} » planifiée à ${creneau.debut}`;
    showActionToast(texte, {
      ariaLabel: `Annuler : ${texte}`,
      onAction: () => {
        void runAction(() => restaurerPlanification(tache.id, avant), { erreur: "Impossible d'annuler. Réessaie." }).then(
          (r) => {
            if (r.ok) void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
          }
        );
      },
    });
  }

  return (
    <div
      role="group"
      aria-label={`Planifier « ${tache.titre} »`}
      className="mt-2 flex flex-col gap-3 rounded-xl bg-surface-alt p-3"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink-2">Durée</span>
        <div className="flex flex-wrap gap-1.5">
          {durees.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === duree}
              onClick={() => setDuree(d)}
              className={`${chip} ${d === duree ? "border-kcal bg-kcal-soft text-ink" : "border-line bg-surface text-ink-2"}`}
            >
              {libelleDuree(d)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink-2">Créneaux libres</span>
        {creneaux.length === 0 ? (
          <p className="text-[13px] text-ink-2">
            Aucun trou libre de {libelleDuree(duree)} aujourd&apos;hui. Essaie une durée plus courte.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {creneaux.map((c) => (
              <button
                key={c.debut}
                type="button"
                disabled={enCours}
                onClick={() => planifier(c)}
                aria-label={`Planifier de ${c.debut} à ${c.fin}`}
                className={`${chip} border-line bg-surface text-ink hover:border-kcal/60`}
              >
                {c.debut} – {c.fin}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="relative self-start text-[13px] font-semibold text-ink-2 after:absolute after:-inset-x-2 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
      >
        Fermer
      </button>
    </div>
  );
}
