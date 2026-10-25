import type { ReactNode } from "react";
import { estComestible, libellePrecaution, type PharmaHuile } from "@/lib/pharmacie/huiles";

// Les alertes de sécurité ne reposent jamais sur la couleur seule : chaque
// pastille porte une icône et un texte (WCAG 1.4.1).
const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold";
const ok = `${base} bg-[color-mix(in_oklch,var(--accent-kcal)_14%,transparent)] text-[var(--accent-kcal)]`;
const neutre = `${base} bg-surface-alt text-ink-2`;
const alerte = `${base} bg-[color-mix(in_oklch,var(--accent-alert)_14%,transparent)] text-alert`;
const attention = `${base} bg-[color-mix(in_oklch,var(--accent-warning)_20%,transparent)] text-ink`;

function Icone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`size-3.5 shrink-0 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const TRIANGLE = "M10 2.5 18 16.5H2L10 2.5ZM10 8v4M10 14.2v.1";

export function BadgeComestible({ huile }: { huile: Pick<PharmaHuile, "voies"> }) {
  return estComestible(huile) ? (
    <span className={ok}>
      <Icone>
        <path d="m4.5 10.5 3.5 3.5 7.5-8" />
      </Icone>
      Comestible
    </span>
  ) : (
    <span className={neutre}>
      <Icone>
        <path d="m5 5 10 10M15 5 5 15" />
      </Icone>
      Non comestible
    </span>
  );
}

export function BadgeDermocaustique() {
  return (
    <span className={alerte}>
      <Icone>
        <path d={TRIANGLE} />
      </Icone>
      Dermocaustique
    </span>
  );
}

export function BadgePhotosensibilisante() {
  return (
    <span className={attention}>
      <Icone className="text-warning">
        <circle cx="10" cy="10" r="3.2" />
        <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
      </Icone>
      Photosensibilisante
    </span>
  );
}

export function BadgePrecaution({ cle }: { cle: string }) {
  return (
    <span className={attention}>
      <Icone className="text-warning">
        <path d={TRIANGLE} />
      </Icone>
      {libellePrecaution(cle)}
    </span>
  );
}

/** Version compacte des lignes de liste : comestibilité et alertes de peau, sans le détail des précautions. */
export function BadgesListe({ huile }: { huile: PharmaHuile }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Sécurité">
      <li>
        <BadgeComestible huile={huile} />
      </li>
      {huile.dermocaustique && (
        <li>
          <BadgeDermocaustique />
        </li>
      )}
      {huile.photosensibilisante && (
        <li>
          <BadgePhotosensibilisante />
        </li>
      )}
    </ul>
  );
}
