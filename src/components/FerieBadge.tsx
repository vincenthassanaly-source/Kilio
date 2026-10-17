// Mention d'un jour férié : texte explicite (jamais la couleur seule) sur fond
// neutre, pour rester informatif sans concurrencer les tâches. Non interactif.
export function FerieBadge({ nom, className = "" }: { nom: string; className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full bg-surface-alt px-2.5 py-1 text-[12.5px] font-medium text-ink-2 ${className}`}
    >
      <span className="font-semibold text-ink">Jour férié</span>
      <span aria-hidden>·</span>
      <span className="truncate">{nom}</span>
    </span>
  );
}
