import { libelleParti, type PartiClasse } from "@/lib/opinions/partis";
import { metaText, pillTag } from "@/lib/ui";

const LIGNE = "flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-3.5 shadow-card";
// Sous ce seuil, la proximité repose sur une petite part de mes positions.
const COUVERTURE_PARTIELLE = 0.5;

export function ClassementProximite({ classement, aDesIdees }: { classement: readonly PartiClasse[]; aDesIdees: boolean }) {
  if (!aDesIdees) {
    return (
      <p className="text-sm text-ink-2">
        Valide quelques idées, avec un thème et des scores, pour voir quels partis te ressemblent.
      </p>
    );
  }

  const comparables = classement.filter((c) => c.proximite !== null);
  const sansDonnees = classement.filter((c) => c.proximite === null);

  return (
    <div className="flex flex-col gap-3">
      {comparables.length > 0 && (
        <ol className="flex flex-col gap-2.5">
          {comparables.map(({ parti, proximite }, index) => {
            if (!proximite) return null;
            const partielle = proximite.comparees / proximite.miennes < COUVERTURE_PARTIELLE;
            return (
              <li key={parti.id} className={LIGNE}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[15px] font-semibold text-ink">
                    <span className="mr-2 tabular-nums text-ink-3">{index + 1}.</span>
                    {libelleParti(parti)}
                  </span>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink">{proximite.pourcentage} %</span>
                </div>
                <div className="h-2 rounded-full bg-surface-alt" role="presentation">
                  <div
                    className="h-2 rounded-full bg-[var(--accent-opinions)]"
                    style={{ width: `${proximite.pourcentage}%` }}
                  />
                </div>
                <p className={`${metaText} flex flex-wrap items-center gap-x-2 gap-y-1`}>
                  <span>
                    Comparé sur {proximite.comparees} de tes {proximite.miennes} position{proximite.miennes > 1 ? "s" : ""}
                  </span>
                  {partielle && <span className={pillTag}>Couverture partielle</span>}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {sansDonnees.length > 0 && (
        <p className="text-xs text-ink-3">
          Pas assez de données pour comparer : {sansDonnees.map((c) => libelleParti(c.parti)).join(", ")}.
        </p>
      )}

      <p className="text-xs text-ink-3">
        Proximité de positions sur les thèmes et les axes que vous avez en commun, pondérée par tes priorités. Ce
        n&apos;est pas une recommandation de vote.
      </p>
    </div>
  );
}
