"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import { retourHistoriqueAutorise } from "@/lib/navigation/parentRoute";
import { linkButton } from "@/lib/ui";

type NavigationApi = {
  currentEntry: { index: number } | null;
  entries: () => { url: string | null }[];
};

// Chemin de l'entrée d'historique précédente, via l'API Navigation (absente
// de Safari/Firefox anciens : on retombe alors sur le lien `href`).
function cheminPrecedent(): string | null {
  const nav = (window as unknown as { navigation?: NavigationApi }).navigation;
  const index = nav?.currentEntry?.index;
  if (!nav || index === undefined || index < 1) return null;
  const url = nav.entries()[index - 1]?.url;
  return url ? new URL(url).pathname : null;
}

/**
 * Bouton « ← Retour » des fiches du référentiel : revient à la page
 * précédente de l'historique (pathologie, classe, recherche…) quand elle est
 * dans le référentiel, sinon (lien direct, première page) suit `href`.
 */
export function RetourReferentiel({ href = "/pharmacie/referentiel" }: { href?: string }) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    const precedent = cheminPrecedent();
    if (precedent && retourHistoriqueAutorise(window.location.pathname, precedent)) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <TransitionLink href={href} onClick={handleClick} className={`${linkButton} self-start`}>
      ← Retour
    </TransitionLink>
  );
}
