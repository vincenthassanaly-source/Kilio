// Pictogrammes des boutons de ligne (monter, descendre, supprimer) : tracé
// unique de 2 px, à la place des glyphes ↑ ↓ × qui dépendent de la police.
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconeMonter() {
  return (
    <svg {...base}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function IconeDescendre() {
  return (
    <svg {...base}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconeSupprimer() {
  return (
    <svg {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
