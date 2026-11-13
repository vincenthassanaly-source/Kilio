"use client";

import { useId } from "react";
import { usePathname } from "next/navigation";
import { TransitionLink } from "@/components/TransitionLink";
import { SegmentedPill } from "@/components/SegmentedControl";
import { SEGMENT_CADRE, segmentClasseGlissant } from "@/lib/segmented";

const TABS = [
  { href: "/nutrition/journal", label: "Carnet" },
  { href: "/nutrition/bilan", label: "Bilan" },
  { href: "/nutrition/recettes", label: "Recettes" },
  { href: "/nutrition/menus", label: "Menus" },
];

export function NutritionSubNav() {
  const pathname = usePathname();
  const pastilleId = useId();

  return (
    <nav className={SEGMENT_CADRE} aria-label="Nutrition">
      {TABS.map((tab) => {
        // `/nutrition` (onglet de la barre du bas) sert le Carnet : « Journal » y est actif.
        const active = pathname.startsWith(tab.href) || (tab.href === "/nutrition/journal" && pathname === "/nutrition");
        return (
          <TransitionLink
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={segmentClasseGlissant()}
          >
            {active && <SegmentedPill layoutId={pastilleId} />}
            <span className={`relative transition-colors ${active ? "text-on-kcal" : "text-ink-2"}`}>
              {tab.label}
            </span>
          </TransitionLink>
        );
      })}
    </nav>
  );
}
