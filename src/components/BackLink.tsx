"use client";

import type { MouseEvent, ReactNode } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import { linkButton } from "@/lib/ui";

/** Lien de retour unique des écrans de détail : chevron SVG (décoratif) + nom
 * de la destination, zone de tap étendue à 44 px par `linkButton`, transition
 * de page directionnelle. Remplace les `‹ X` / `← X` écrits à la main, qui
 * variaient d'un écran à l'autre. Le nom accessible est « Retour vers X » ;
 * `sansPrefixe` pour un libellé qui contient déjà l'idée de retour. */
export function BackLink({
  href,
  children,
  onClick,
  sansPrefixe = false,
}: {
  href: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  sansPrefixe?: boolean;
}) {
  return (
    <TransitionLink href={href} onClick={onClick} className={`${linkButton} inline-flex items-center gap-1 self-start`}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      <span>
        {!sansPrefixe && (
          <>
            <span className="sr-only">Retour vers</span>{" "}
          </>
        )}
        {children}
      </span>
    </TransitionLink>
  );
}
