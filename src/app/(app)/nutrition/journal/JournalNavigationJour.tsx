import Link from "next/link";
import type { JourJournal } from "./jour";
import { shiftDate } from "@/lib/date/iso";

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
        href={`/nutrition/journal?date=${shiftDate(jour.date, -1)}`}
        replace
        aria-label="Jour précédent"
        className={`${boutonJour} text-ink`}
      >
        ‹
      </Link>
      <Link
        href={`/nutrition/journal?date=${shiftDate(jour.date, 1)}`}
        replace
        aria-label="Jour suivant"
        className={`${boutonJour} text-ink`}
      >
        ›
      </Link>
    </div>
  );
}
