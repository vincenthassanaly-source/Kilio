"use client";

import { useTransition } from "react";
import { remettreEnVrac } from "./remettreEnVrac";

// Bouton icône discret (boîte de rangement) : 36 px visibles, zone de toucher
// étendue à 44 px par le pseudo-élément. Le libellé « Remettre en vrac » reste
// disponible pour les lecteurs d'écran (aria-label, avec le nom du document) et
// en info-bulle (title) : une icône seule ne se suffit pas à elle-même.
const ICONE =
  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 transition active:scale-[0.97] hover:bg-surface-alt hover:text-ink disabled:opacity-60 after:absolute after:-inset-1 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

function BoiteIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

/** Remet un document classé dans le vrac, avec un message « Annuler » (voir remettreEnVrac). */
export function BoutonRemettreEnVrac({ document }: { document: { id: string; nom: string } }) {
  const [enCours, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={enCours}
      aria-label={`Remettre « ${document.nom} » en vrac`}
      title="Remettre en vrac"
      onClick={() => {
        startTransition(async () => {
          await remettreEnVrac(document);
        });
      }}
      className={ICONE}
    >
      <BoiteIcon />
    </button>
  );
}
