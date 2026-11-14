// Pictogramme SVG propre au module Courses (décoratif, `aria-hidden`). Même tracé que
// src/components/icons.tsx (24×24, trait arrondi, `currentColor`).

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

export function PanierIcon(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20 8H6.2" />
      <circle cx="9.5" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </Svg>
  );
}
