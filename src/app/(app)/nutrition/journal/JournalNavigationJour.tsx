import Link from "next/link";
import type { JourJournal } from "./jour";
import { shiftDate } from "@/lib/date/iso";
import { JourTypeBascule } from "./JourTypeBascule";
import { ONGLETS, ONGLETS_CADRE, ongletClasse } from "./onglets";

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

/**
 * Bascule Repos / Entraînement. Sans `jour` (fallback de `<Suspense>`), même
 * cadre, inactif ; avec, la bascule cliente qui mémorise le choix.
 */
export function JourTypeOnglets({ jour }: { jour?: JourJournal }) {
  if (jour) return <JourTypeBascule date={jour.date} jourType={jour.jourType} />;
  return (
    <div className={ONGLETS_CADRE}>
      {ONGLETS.map((onglet) => (
        <span key={onglet.value} aria-disabled="true" className={ongletClasse(false)}>
          {onglet.label}
        </span>
      ))}
    </div>
  );
}
