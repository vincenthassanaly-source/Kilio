// Pictogrammes SVG partagés, à la place des emoji et glyphes texte (✓ ✕ ★ 🔥)
// qui dépendent de la police de l'appareil et sont lus tels quels par les
// lecteurs d'écran. Décoratifs (`aria-hidden`) : le sens passe par le texte
// voisin ou un libellé `sr-only`. Couleur = `currentColor`, taille en px.

type IconeProps = { size?: number; className?: string };

function Svg({
  size = 14,
  className,
  remplie = false,
  children,
}: IconeProps & { remplie?: boolean; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={remplie ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function CrossIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function FlameIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

export function StarIcon({ filled = false, ...props }: IconeProps & { filled?: boolean }) {
  return (
    <Svg {...props} remplie={filled}>
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.3l-5.8 3.1 1.1-6.45-4.7-4.6 6.5-.95z" />
    </Svg>
  );
}

export function PlusIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

const CHEVRONS = {
  gauche: "m15 6-6 6 6 6",
  droite: "m9 6 6 6-6 6",
  bas: "m6 9 6 6 6-6",
} as const;

/** Chevron tracé (flèches de période, déplier) : remplace les glyphes ‹ › ▾ et les SVG recopiés. */
export function ChevronIcon({ sens, ...props }: IconeProps & { sens: keyof typeof CHEVRONS }) {
  return (
    <Svg {...props}>
      <path d={CHEVRONS[sens]} />
    </Svg>
  );
}

export function AlerteIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 9v4M12 16.5h.01" />
      <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
    </Svg>
  );
}
