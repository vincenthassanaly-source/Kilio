import { LIBELLE_STATUT, type Statut } from "@/lib/opinions/types";

// Le texte porte toujours le libellé (jamais la couleur seule). « Validée »
// prend l'accent du module ; « Brouillon » et « Rejetée » restent neutres.
const CLASSES: Record<Statut, string> = {
  brouillon: "bg-surface-alt text-ink-2",
  validee: "bg-[color-mix(in_oklch,var(--accent-opinions)_14%,transparent)] text-[var(--accent-opinions)]",
  rejetee: "bg-surface-alt text-ink-3 line-through",
};

export function StatutPill({ statut }: { statut: Statut }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${CLASSES[statut]}`}>
      {LIBELLE_STATUT[statut]}
    </span>
  );
}
