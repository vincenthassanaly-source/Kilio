"use client";

import { useInboxCount } from "@/hooks/useInboxCount";
import { pastilleCompteur } from "@/lib/inbox/compute";

/**
 * Pastille rouge du nombre de captures à trier. Absolue : à poser dans un
 * parent `relative`. Rien n'est rendu quand l'inbox est vide.
 */
export function PastilleInbox({ className = "" }: { className?: string }) {
  const pastille = pastilleCompteur(useInboxCount());
  if (!pastille) return null;
  return (
    <span
      role="status"
      aria-label={`${pastille} à trier dans l'inbox`}
      className={`absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[10.5px] font-bold tabular-nums text-white ${className}`}
    >
      {pastille}
    </span>
  );
}
