"use client";

import { useInboxCount } from "@/hooks/useInboxCount";
import { libelleNbInbox, pastilleCompteur } from "@/lib/inbox/compute";

/**
 * Pastille rouge du nombre de captures à trier. Absolue : à poser dans un
 * parent `relative`. Rien n'est rendu quand l'inbox est vide.
 *
 * Accessibilité : le chiffre seul est masqué (`aria-hidden`) et remplacé par un
 * texte contextuel (« 3 éléments à trier ») dans le nom du lien parent. Ce n'est
 * volontairement pas une zone `role="status"` : trois pastilles montées en même
 * temps seraient autant de zones live concurrentes qui annoncent un nombre nu.
 */
export function PastilleInbox({ className = "" }: { className?: string }) {
  const nb = useInboxCount();
  const pastille = pastilleCompteur(nb);
  if (!pastille) return null;
  return (
    <>
      <span
        aria-hidden
        className={`absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[11px] font-bold tabular-nums text-on-accent ${className}`}
      >
        {pastille}
      </span>
      <span className="sr-only">, {libelleNbInbox(nb)}</span>
    </>
  );
}
