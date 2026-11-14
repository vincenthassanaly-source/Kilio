// Pictogrammes SVG propres au module Courses (décoratifs, `aria-hidden`) :
// remplacent les glyphes texte « + » et « ▾ ». Même tracé que src/components/icons.tsx
// (24×24, trait arrondi, `currentColor`).

type IconeProps = { size?: number; className?: string };

function Svg({ size = 18, className, children }: IconeProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
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

export function PlusIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronBasIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function PanierIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20 8H6.2" />
      <circle cx="9.5" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </Svg>
  );
}
