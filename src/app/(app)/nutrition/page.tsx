import Link from "next/link";
import { card, eyebrow, screenTitle } from "@/lib/ui";

const SECTIONS = [
  {
    href: "/nutrition/journal",
    label: "Journal",
    description: "Repas du jour et objectifs",
    icon: (c: string) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="19" x2="5" y2="11" />
        <line x1="12" y1="19" x2="12" y2="5" />
        <line x1="19" y1="19" x2="19" y2="14" />
      </svg>
    ),
  },
  {
    href: "/nutrition/bilan",
    label: "Bilan",
    description: "Jours dans les clous et série",
    icon: (c: string) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/nutrition/recettes",
    label: "Recettes",
    description: "Bibliothèque de recettes",
    icon: (c: string) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6c2.4-1.6 5.6-1.6 8 0v13c-2.4-1.6-5.6-1.6-8 0V6z" />
        <path d="M20 6c-2.4-1.6-5.6-1.6-8 0v13c2.4-1.6 5.6-1.6 8 0V6z" />
      </svg>
    ),
  },
];

export default function NutritionHubPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className={eyebrow}>Nutrition</p>
        <h1 className={screenTitle} style={{ viewTransitionName: "nutrition-titre-dashboard" }}>
          Nutrition
        </h1>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className={`${card} flex flex-col gap-2.5`}>
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in oklch, var(--accent-kcal) 12%, transparent)" }}
            >
              {section.icon("var(--accent-kcal)")}
            </span>
            <div>
              <p className="font-display text-[15px] font-semibold text-ink">{section.label}</p>
              <p className="text-[12.5px] text-ink-2 text-pretty">{section.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
