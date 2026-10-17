import { LIBELLE_STATUT, type Statut } from "@/lib/vinted/types";

// Teinte par statut : le texte porte toujours le libellé (jamais la couleur
// seule). « Publié » prend l'accent du module, « Prêt » et « Vendu » le vert
// de marque, « Brouillon » et « Retiré » restent neutres.
const CLASSES: Record<Statut, string> = {
  brouillon: "bg-surface-alt text-ink-2",
  pret: "bg-kcal-soft text-kcal",
  publie: "bg-[color-mix(in_oklch,var(--accent-vinted)_14%,transparent)] text-[var(--accent-vinted)]",
  vendu: "bg-kcal text-on-kcal",
  retire: "bg-surface-alt text-ink-3 line-through",
};

export function StatutPill({ statut }: { statut: Statut }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${CLASSES[statut]}`}>
      {LIBELLE_STATUT[statut]}
    </span>
  );
}
