"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supprimerMesure } from "@/app/actions/sante";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { confirmDelete } from "@/lib/confirm";
import { queryKeys } from "@/lib/query/keys";
import { nombreFr, type Mesure } from "@/lib/sante/compute";
import { ghostButton } from "@/lib/ui";

const libelleDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function resume(mesure: Mesure): string {
  const morceaux: string[] = [];
  if (mesure.poids_kg !== null) morceaux.push(`${nombreFr(mesure.poids_kg, 1)} kg`);
  if (mesure.tour_taille_cm !== null) morceaux.push(`${nombreFr(mesure.tour_taille_cm, 1)} cm`);
  return morceaux.join(" · ");
}

/**
 * Derniers relevés (récents d'abord) du Bilan : date, poids, tour de taille, et
 * suppression d'un relevé erroné. Lecture seule hors suppression : la saisie
 * vit dans la carte « Pesée » d'Aujourd'hui (`PeseeForm`).
 */
export function ReleveListe({ mesures }: { mesures: Mesure[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();

  async function rafraichir() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.synthesesSemaine }),
      queryClient.invalidateQueries({ queryKey: queryKeys.mesuresRecentes }),
    ]);
    router.refresh();
  }

  async function supprimer(mesure: Mesure) {
    if (!(await confirmDelete(`Supprimer le relevé du ${libelleDate(mesure.date)} ?`))) return;
    startTransition(async () => {
      const resultat = await runAction(() => supprimerMesure(mesure.date));
      if (!resultat.ok) return;
      showToast("Relevé supprimé");
      await rafraichir();
    });
  }

  if (mesures.length === 0) return null;

  return (
    <ul className="flex flex-col divide-y divide-line" aria-label="Derniers relevés">
      {mesures.map((mesure) => (
        <li key={mesure.date} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-label font-medium capitalize text-ink">{libelleDate(mesure.date)}</p>
            <p className="text-small tabular-nums text-ink-2">{resume(mesure)}</p>
          </div>
          <button
            type="button"
            onClick={() => supprimer(mesure)}
            disabled={pending}
            aria-label={`Supprimer le relevé du ${libelleDate(mesure.date)}`}
            className={`${ghostButton} text-alert`}
          >
            Supprimer
          </button>
        </li>
      ))}
    </ul>
  );
}
