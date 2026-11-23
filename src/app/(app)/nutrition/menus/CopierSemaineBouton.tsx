"use client";

import { useState } from "react";
import { copierSemainePrecedente } from "@/app/actions/menus";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { secondaryButton } from "@/lib/ui";

/**
 * « Copier la semaine précédente » : reporte les repas de la semaine d'avant
 * (mêmes créneaux, mêmes quantités, tous « à manger »). Proposé seulement sur
 * une semaine vide ; le bouton reste inactif pendant l'envoi pour qu'un double
 * tap ne copie jamais deux fois.
 */
export function CopierSemaineBouton({ lundi }: { lundi: string }) {
  const [enCours, setEnCours] = useState(false);

  async function copier() {
    setEnCours(true);
    const resultat = await runAction(() => copierSemainePrecedente(lundi));
    setEnCours(false);
    if (!resultat.ok) return;
    const { copies } = resultat.data;
    // « repas » est invariable ; seul le participe s'accorde. Rien de copié :
    // on le dit plutôt que d'annoncer « 0 repas copiés ».
    showToast(
      copies === 0
        ? "Aucun repas à copier depuis la semaine précédente"
        : `${copies} repas copié${copies > 1 ? "s" : ""} de la semaine précédente`
    );
  }

  return (
    <button type="button" onClick={copier} disabled={enCours} className={`${secondaryButton} min-h-12 w-full`}>
      {enCours ? "Copie…" : "Copier la semaine précédente"}
    </button>
  );
}
