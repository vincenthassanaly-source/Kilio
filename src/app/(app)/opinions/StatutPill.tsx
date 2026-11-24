import { LIBELLE_STATUT, type Statut } from "@/lib/opinions/types";

// Le texte porte toujours le libellé (jamais la couleur seule). « Validée »
// prend l'accent du module ; « Brouillon » et « Rejetée » restent neutres.
// Le texte de « Validée » mêle l'accent à 45 % d'encre : l'accent seul
// (L 0,55) ne tient pas 4,5:1 sur sa propre teinte de fond en thème clair.
// Mélange en oklab (et non oklch) : pas de rotation de teinte vers le vert de l'encre.
const CLASSES: Record<Statut, string> = {
  brouillon: "bg-surface-alt text-ink-2",
  validee:
    "bg-[color-mix(in_oklch,var(--accent-opinions)_14%,transparent)] text-[color-mix(in_oklab,var(--accent-opinions)_55%,var(--ink))]",
  rejetee: "bg-surface-alt text-ink-3 line-through",
};

export function StatutPill({ statut }: { statut: Statut }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-micro font-bold ${CLASSES[statut]}`}>
      {LIBELLE_STATUT[statut]}
    </span>
  );
}
