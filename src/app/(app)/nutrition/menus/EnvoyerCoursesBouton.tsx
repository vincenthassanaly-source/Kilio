"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { annulerEnvoiMenuAuxCourses, envoyerMenuAuxCourses } from "@/app/actions/menus";
import { showActionToast, showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { primaryButton } from "@/lib/ui";
import { pluriel } from "@/lib/pharmacie/format";

/**
 * « Envoyer aux Courses » : additionne les ingrédients des repas pas encore
 * mangés de la semaine et les ajoute à la liste, sans dupliquer ce qui y est
 * déjà. Rien n'est écrit avant ce tap.
 */
export function EnvoyerCoursesBouton({ lundi, nbAVenir }: { lundi: string; nbAVenir: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [enCours, setEnCours] = useState(false);

  async function envoyer() {
    setEnCours(true);
    const resultat = await runAction(() => envoyerMenuAuxCourses(lundi));
    setEnCours(false);
    if (!resultat.ok) return;

    void queryClient.invalidateQueries({ queryKey: queryKeys.courses });
    const { ajoutes, reactives, dejaPresents, idsCrees, idsReactives } = resultat.data;
    const parties: string[] = [];
    if (ajoutes > 0) parties.push(`${pluriel(ajoutes, "article")} ajouté${ajoutes > 1 ? "s" : ""}`);
    if (reactives > 0) parties.push(`${reactives} remis à prendre`);
    const complement = dejaPresents > 0 ? ` (${dejaPresents} déjà sur la liste)` : "";
    if (parties.length === 0) {
      // Rien n'a changé sur la liste : rien à annuler, on propose d'y aller.
      showActionToast(`Tout est déjà sur la liste${complement}`, {
        label: "Voir",
        ariaLabel: "Ouvrir la liste de courses",
        onAction: () => router.push("/courses"),
      });
      return;
    }
    showActionToast(`${parties.join(", ")} aux Courses${complement}`, {
      ariaLabel: "Annuler l'envoi aux Courses",
      onAction: () => {
        void runAction(() => annulerEnvoiMenuAuxCourses(idsCrees, idsReactives)).then((r) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.courses });
          if (r.ok) showToast("Envoi aux Courses annulé");
        });
      },
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={envoyer}
        disabled={enCours || nbAVenir === 0}
        className={`${primaryButton} min-h-12 w-full`}
      >
        {enCours ? "Envoi…" : "Envoyer aux Courses"}
      </button>
      <p className="text-caption text-ink-2 text-pretty">
        {nbAVenir === 0
          ? "Planifie des repas pour générer la liste."
          : `Ingrédients de ${nbAVenir} repas pas encore mangé${nbAVenir > 1 ? "s" : ""}, quantités additionnées.`}
      </p>
    </div>
  );
}
