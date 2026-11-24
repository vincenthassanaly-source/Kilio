/**
 * Chevron de dépliage, commun aux panneaux du module (carte parti, explication,
 * priorités, historique). Piloté par `ouvert` pour un bouton, ou par
 * `group-open:` quand il est posé dans le `<summary>` d'un `<details class="group">`.
 */
export function Chevron({ ouvert, taille = 18 }: { ouvert?: boolean; taille?: number }) {
  const rotation = ouvert === undefined ? "group-open:rotate-180" : ouvert ? "rotate-180" : "";
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${rotation}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
