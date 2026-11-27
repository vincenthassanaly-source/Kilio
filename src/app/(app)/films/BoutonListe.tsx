"use client";

import { CheckIcon, PlusIcon } from "@/components/icons";

/** Ajoute un film à la liste ou l'en retire d'un tap. Cible de 44 px ; l'état « dans ma liste »
 * se lit à la coche et au libellé accessible, pas seulement à la couleur. */
export function BoutonListe({ titre, dansListe, onToggle }: { titre: string; dansListe: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={dansListe}
      aria-label={dansListe ? `Retirer « ${titre} » de ma liste` : `Ajouter « ${titre} » à ma liste`}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-[color,background-color,border-color,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
        dansListe ? "border-transparent bg-kcal-soft text-kcal" : "border-control-border text-ink-2 hover:bg-surface-alt"
      }`}
    >
      {dansListe ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
    </button>
  );
}
