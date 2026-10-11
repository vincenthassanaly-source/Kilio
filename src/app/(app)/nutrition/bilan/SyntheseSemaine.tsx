import type { ReactNode } from "react";
import type { SyntheseSemaine as Synthese } from "@/app/actions/sante";
import { TransitionLink } from "@/components/TransitionLink";
import { formaterDelta, nombreFr, type EvolutionCorps } from "@/lib/sante/compute";
import { card } from "@/lib/ui";

// Synthèse de la semaine : quatre chiffres pour sentir où on en est (kcal moyens
// contre la limite, séances, poids lissé, tour de taille). Présentationnel, sans
// état : rendu côté serveur dans le Bilan, côté client dans la Revue hebdo. Ton
// neutre — on constate, on ne juge pas.

function Tuile({ libelle, valeur, detail }: { libelle: string; valeur: ReactNode; detail: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-alt px-3 py-3">
      <dt className="text-[11.5px] font-semibold text-ink-3">{libelle}</dt>
      <dd className="font-display text-[20px] font-semibold leading-tight tabular-nums text-ink">{valeur}</dd>
      <dd className="text-[12px] leading-snug text-ink-2 text-pretty">{detail}</dd>
    </div>
  );
}

function detailCorps(evolution: EvolutionCorps, unite: string, reference: string): string {
  const morceaux = [
    evolution.delta !== null ? `${formaterDelta(evolution.delta, unite)} vs semaine d'avant` : reference,
  ];
  if (evolution.ageJours > 7) morceaux.push(`relevé il y a ${evolution.ageJours} j`);
  return morceaux.join(" · ");
}

export function SyntheseSemaine({ synthese, lienBilan = false }: { synthese: Synthese; lienBilan?: boolean }) {
  const { kcal, seances, poids, taille } = synthese;

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <dl className="grid grid-cols-2 gap-2">
        <Tuile
          libelle="Kcal par jour"
          valeur={kcal ? `${nombreFr(kcal.moyenne)} kcal` : "—"}
          detail={
            kcal
              ? `limite moyenne ${nombreFr(kcal.cibleMoyenne)} · ${kcal.nbDansLimite}/${kcal.nbJours} ${kcal.nbJours > 1 ? "jours" : "jour"} dans la limite`
              : "Pas assez de jours saisis"
          }
        />
        <Tuile
          libelle="Séances"
          valeur={seances.total > 0 ? `${seances.faites}/${seances.total}` : "—"}
          detail={seances.total > 0 ? "faites cette semaine" : "Aucune séance planifiée"}
        />
        <Tuile
          libelle="Poids"
          valeur={poids ? `${nombreFr(poids.actuel, 1)} kg` : "—"}
          detail={poids ? detailCorps(poids, "kg", "moyenne sur 7 jours") : "Pas de relevé"}
        />
        <Tuile
          libelle="Tour de taille"
          valeur={taille ? `${nombreFr(taille.actuel, 1)} cm` : "—"}
          detail={taille ? detailCorps(taille, "cm", "dernier relevé") : "Pas de relevé"}
        />
      </dl>
      {lienBilan && (
        <TransitionLink href="/nutrition/bilan" className="self-start text-sm font-semibold text-kcal">
          Voir le bilan complet
        </TransitionLink>
      )}
    </div>
  );
}
