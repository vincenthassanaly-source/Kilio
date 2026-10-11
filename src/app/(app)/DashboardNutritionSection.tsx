"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { queryKeys } from "@/lib/query/keys";
import { card } from "@/lib/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { CardSkeleton } from "@/components/skeletons/CardSkeleton";

const MACRO_COLORS = { proteines: "var(--accent-protein)", glucides: "var(--accent-carbs)", lipides: "var(--accent-fat)" };
const MACRO_LABELS = { proteines: "P", glucides: "G", lipides: "L" };

export function DashboardNutritionSection({ today }: { today: string }) {
  const { data: resume, isLoading } = useQuery({
    queryKey: queryKeys.resumeNutrition(today),
    queryFn: () => getResumeNutritionJour(today),
  });

  if (isLoading) return <CardSkeleton />;

  // Plus de cible inventée (2100 kcal) quand aucun objectif n'existe pour
  // ce type de jour : la carte invite à en définir un (constat J-P1-5).
  const kcalGoal = resume?.kcalGoal ?? null;
  const jourLibre = resume?.jourLibre === true;
  // Jour libre : la limite est suspendue, l'anneau reste vide plutôt que de
  // afficher un dépassement qui n'en est pas un.
  const kcalPct = resume && kcalGoal && !jourLibre ? resume.consomme.kcal / kcalGoal : 0;
  const macros = resume?.macroGoals
    ? [
        { key: "proteines" as const, value: resume.consomme.proteines, goal: resume.macroGoals.proteines },
        { key: "glucides" as const, value: resume.consomme.glucides, goal: resume.macroGoals.glucides },
        { key: "lipides" as const, value: resume.consomme.lipides, goal: resume.macroGoals.lipides },
      ]
    : [];

  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link href="/nutrition/journal" className={`${card} flex items-center gap-3.5`}>
        <ProgressRing size={60} strokeWidth={6.5} pct={kcalPct} color="var(--accent-kcal)">
          <span className="font-display text-[12.5px] font-bold tabular-nums text-ink">
            {jourLibre ? "Libre" : `${Math.round(kcalPct * 100)}%`}
          </span>
        </ProgressRing>
        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          <span
            className="text-[14px] font-semibold text-ink"
            style={{ viewTransitionName: "nutrition-titre-dashboard" }}
          >
            Nutrition
          </span>
          <span className="text-[12.5px] font-medium tabular-nums text-ink-2">
            {jourLibre
              ? `${Math.round(resume?.consomme.kcal ?? 0)} kcal · jour libre`
              : kcalGoal !== null
              ? `${Math.round(resume?.consomme.kcal ?? 0)} / ${kcalGoal} kcal`
              : `${Math.round(resume?.consomme.kcal ?? 0)} kcal · objectif à définir`}
            {resume?.jourType === "entrainement" && " · Entraînement"}
          </span>
          <div className="flex gap-2">
            {macros.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col gap-0.5">
                <div className="h-1 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, m.goal > 0 ? Math.round((m.value / m.goal) * 100) : 0)}%`,
                      background: MACRO_COLORS[m.key],
                    }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-ink-3">{MACRO_LABELS[m.key]}</span>
              </div>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
