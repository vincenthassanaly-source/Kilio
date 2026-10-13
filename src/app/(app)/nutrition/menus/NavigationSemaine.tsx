import Link from "next/link";
import { shiftDate } from "@/lib/date/iso";
import { eyebrow } from "@/lib/ui";
import { hrefSemaineMenus, lireSemaineMenus, type MenusSearchParams, type SemaineMenus } from "./semaine";

const boutonSemaine =
  "flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-base";

const FORMAT_JOUR_MOIS = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const FORMAT_JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" });

/** « 12 – 18 oct. » (ou « 26 oct. – 1 nov. » à cheval sur deux mois). */
function libelleSemaine(lundi: string): string {
  const debut = new Date(`${lundi}T00:00:00Z`);
  const fin = new Date(`${shiftDate(lundi, 6)}T00:00:00Z`);
  const memeMois = debut.getUTCMonth() === fin.getUTCMonth();
  return `${memeMois ? FORMAT_JOUR.format(debut) : FORMAT_JOUR_MOIS.format(debut)} – ${FORMAT_JOUR_MOIS.format(fin)}`;
}

/** Semaine affichée, en légende au-dessus du titre (lue dans l'URL, sous <Suspense>). */
export async function MenusSemaineLibelle({ searchParams }: { searchParams: MenusSearchParams }) {
  const { lundi } = await lireSemaineMenus(searchParams);
  return <p className={`${eyebrow} capitalize`}>Semaine du {libelleSemaine(lundi)}</p>;
}

/**
 * Boutons ‹ › de changement de semaine. Sans `semaine` (fallback de
 * `<Suspense>`, donc dans la coquille), même cadre, inactif, le temps que
 * l'URL soit lue.
 */
export function NavigationSemaine({ semaine }: { semaine?: SemaineMenus }) {
  if (!semaine) {
    return (
      <div className="flex gap-1.5" aria-hidden="true">
        <span className={`${boutonSemaine} text-ink-3`}>‹</span>
        <span className={`${boutonSemaine} text-ink-3`}>›</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Link
        href={hrefSemaineMenus(shiftDate(semaine.lundi, -7))}
        replace
        aria-label="Semaine précédente"
        className={`${boutonSemaine} text-ink`}
      >
        ‹
      </Link>
      <Link
        href={hrefSemaineMenus(shiftDate(semaine.lundi, 7))}
        replace
        aria-label="Semaine suivante"
        className={`${boutonSemaine} text-ink`}
      >
        ›
      </Link>
    </div>
  );
}

export async function MenusNavigation({ searchParams }: { searchParams: MenusSearchParams }) {
  return <NavigationSemaine semaine={await lireSemaineMenus(searchParams)} />;
}
