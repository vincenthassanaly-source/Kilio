import { ModulesGrid } from "@/components/ModulesGrid";
import { PlusEditBar } from "./PlusEditBar";
import { screenTitle } from "@/lib/ui";

export default function PlusPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={screenTitle}>Plus</h1>
        <PlusEditBar />
      </div>
      {/* Seul indice visible que les tuiles sont réorganisables/épinglables
          (voir NavigationEditContext) : rien d'autre ne le signale
          aujourd'hui, ni ici ni dans Réglages (rapport d'audit navigation). */}
      <p className="flex items-start gap-2 rounded-2xl bg-surface-alt px-3.5 py-3 text-label leading-snug text-ink-2 text-pretty">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-ink-3">
          <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0 0V8.5a1.5 1.5 0 0 1 3 0V11m0 0v-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 14.5a1.5 1.5 0 0 1 2.4-1.8L9 15" />
        </svg>
        <span>
          <strong className="font-semibold text-ink">Appui long</strong> sur une tuile pour la réorganiser ou l&apos;épingler en barre du bas.
        </span>
      </p>
      <ModulesGrid />
    </div>
  );
}
