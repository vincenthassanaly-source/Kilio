// Signe « moins » tracé, pendant de `PlusIcon` (components/icons) pour les
// boutons de pas (quantité, portions) : remplace le glyphe « − », qui dépend de
// la police de l'appareil et n'a ni le trait ni la taille du « + » voisin.
// Mêmes réglages que les pictogrammes partagés (24 × 24, trait 2,2, arrondi).
export function MoinsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}
