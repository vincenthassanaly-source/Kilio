"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { envoyerMenuAuxCourses } from "@/app/actions/menus";
import { showActionToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { primaryButton } from "@/lib/ui";

function pluriel(n: number, mot: string) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

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
    const { ajoutes, dejaPresents } = resultat.data;
    const complement = dejaPresents > 0 ? ` (${dejaPresents} déjà sur la liste)` : "";
    showActionToast(
      ajoutes > 0
        ? `${pluriel(ajoutes, "article")} ajouté${ajoutes > 1 ? "s" : ""} aux Courses${complement}`
        : `Tout est déjà sur la liste${complement}`,
      { label: "Voir", ariaLabel: "Ouvrir la liste de courses", onAction: () => router.push("/courses") }
    );
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
      <p className="text-xs text-ink-2 text-pretty">
        {nbAVenir === 0
          ? "Planifie des repas pour générer la liste."
          : `Ingrédients de ${nbAVenir} repas pas encore mangé${nbAVenir > 1 ? "s" : ""}, quantités additionnées.`}
      </p>
    </div>
  );
}
