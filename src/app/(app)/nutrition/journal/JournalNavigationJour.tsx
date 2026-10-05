import Link from "next/link";
import type { JourJournal } from "./jour";
import { shiftDate } from "@/lib/date/iso";
import { hrefJourJournal } from "./jour";

const boutonJour =
  "flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-base";

/**
 * Boutons ‹ › de changement de jour. Sans `jour` (fallback de `<Suspense>`,
 * donc dans la coquille), même cadre, inactif, le temps que l'URL soit lue.
 */
export function JourNavigation({ jour }: { jour?: JourJournal }) {
  if (!jour) {
    return (
      <div className="flex gap-1.5" aria-hidden="true">
        <span className={`${boutonJour} text-ink-3`}>‹</span>
        <span className={`${boutonJour} text-ink-3`}>›</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Link
        href={hrefJourJournal(shiftDate(jour.date, -1), jour.depuisBilan)}
        replace
        aria-label="Jour précédent"
        className={`${boutonJour} text-ink`}
      >
        ‹
      </Link>
      <Link
        href={hrefJourJournal(shiftDate(jour.date, 1), jour.depuisBilan)}
        replace
        aria-label="Jour suivant"
        className={`${boutonJour} text-ink`}
      >
        ›
      </Link>
    </div>
  );
}
