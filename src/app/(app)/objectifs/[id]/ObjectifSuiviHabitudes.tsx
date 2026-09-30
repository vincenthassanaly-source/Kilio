import type { ObjectifDetail } from "@/app/actions/objectifs";
import type { Tables } from "@/lib/supabase/types";
import { TransitionLink } from "@/components/TransitionLink";
import { card, linkButton, metaText, nameText } from "@/lib/ui";

function pourcent(taux: number) {
  return `${Math.round(taux * 100)} %`;
}

// Progression = taux de réussite des habitudes rattachées entre la création
// de l'objectif et l'échéance (ou aujourd'hui). Aucune saisie ici : tout
// vient des check faits dans le module Habitudes.
export function ObjectifSuiviHabitudes({
  objectif,
  habitudes,
  progression,
}: {
  objectif: Tables<"objectifs">;
  habitudes: ObjectifDetail["habitudes"];
  progression: number;
}) {
  return (
    <div className={`${card} flex flex-col gap-4`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className={nameText}>Taux de réussite</p>
          <p className="text-lg font-semibold tabular-nums text-ink">{pourcent(progression)}</p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progression * 100)}
          aria-label="Taux de réussite de l'objectif"
          className="h-2 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full"
            style={{ width: pourcent(progression), background: "var(--accent-objectifs)" }}
          />
        </div>
        <p className={metaText}>
          {objectif.date_echeance ? "Jusqu'à l'échéance" : "Depuis la création"}, sur les check attendus.
        </p>
      </div>

      {habitudes.length === 0 ? (
        <p className="text-sm text-ink-2">Aucune habitude rattachée. Modifie l&apos;objectif pour en ajouter.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {habitudes.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 text-[15px] text-ink">
              <span>
                {h.icone && <span className="mr-1.5">{h.icone}</span>}
                {h.nom}
                {h.frequence_hebdo != null && (
                  <span className="text-ink-2"> · {h.frequence_hebdo}×/sem.</span>
                )}
                {!h.actif && <span className="text-ink-2"> · archivée</span>}
              </span>
              <span className="tabular-nums text-ink-2">{pourcent(h.taux)}</span>
            </li>
          ))}
        </ul>
      )}

      <TransitionLink href="/habitudes" className={linkButton}>
        Faire mon check du jour ›
      </TransitionLink>
    </div>
  );
}
