"use client";

import { useState } from "react";
import { showToast } from "@/components/toast/toast-store";
import { card } from "@/lib/ui";
import type { Skill } from "@/app/actions/skills";

// Fiche compacte d'un skill : nom, une phrase, 2-3 exemples de situations,
// bouton copier « /nom » — carte standard (22px, pas cardTight) car elle
// porte plusieurs informations indépendantes, pas une seule ligne de liste
// (voir brief /impeccable shape).
export function SkillCard({ skill }: { skill: Skill }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(`/${skill.nom}`);
      setCopie(true);
      showToast(`« /${skill.nom} » copié`);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      showToast("Copie impossible sur cet appareil.");
    }
  }

  return (
    <div className={`${card} flex flex-col gap-2.5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[14.5px] font-semibold text-ink">/{skill.nom}</p>
        <button
          type="button"
          onClick={copier}
          className="shrink-0 rounded-xl border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition hover:bg-surface-alt active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          {copie ? "Copié" : "Copier"}
        </button>
      </div>
      <p className="text-[13.5px] text-ink-2 text-pretty">{skill.description}</p>
      {skill.exemples.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skill.exemples.map((exemple) => (
            <span
              key={exemple}
              className="min-w-0 max-w-full rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-ink-2 text-pretty"
            >
              {exemple}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
