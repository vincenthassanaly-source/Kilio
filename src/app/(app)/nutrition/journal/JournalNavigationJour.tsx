import Link from "next/link";
import type { JourJournal } from "./jour";
import { shiftDate } from "@/lib/date/iso";
import { hrefJourJournal } from "./liens";
import { linkButton, navArrowButton } from "@/lib/ui";
import { ChevronIcon } from "@/components/icons";

// Flèches de période du système (Agenda, Habitudes, Journal intime) : chevron
// tracé plutôt que les glyphes ‹ ›, qui dépendent de la police de l'appareil.
const boutonJour = `${navArrowButton} bg-surface`;

/**
 * Boutons de changement de jour. Sans `jour` (fallback de `<Suspense>`,
 * donc dans la coquille), même cadre, inactif, le temps que l'URL soit lue.
 */
export function JourNavigation({ jour }: { jour?: JourJournal }) {
  if (!jour) {
    return (
      <div className="flex gap-1.5" aria-hidden="true">
        <span className={`${boutonJour} text-ink-3`}>
          <ChevronIcon sens="gauche" size={18} />
        </span>
        <span className={`${boutonJour} text-ink-3`}>
          <ChevronIcon sens="droite" size={18} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {jour.date !== jour.aujourdhui && (
        <Link
          href={hrefJourJournal(jour.aujourdhui, jour.depuisBilan)}
          replace
          className={`${linkButton} mr-1.5`}
        >
          Aujourd&apos;hui
        </Link>
      )}
      <Link
        href={hrefJourJournal(shiftDate(jour.date, -1), jour.depuisBilan)}
        replace
        aria-label="Jour précédent"
        className={boutonJour}
      >
        <ChevronIcon sens="gauche" size={18} />
      </Link>
      <Link
        href={hrefJourJournal(shiftDate(jour.date, 1), jour.depuisBilan)}
        replace
        aria-label="Jour suivant"
        className={boutonJour}
      >
        <ChevronIcon sens="droite" size={18} />
      </Link>
    </div>
  );
}
