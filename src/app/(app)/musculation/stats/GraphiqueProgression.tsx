"use client";

import { useId, useMemo, useState } from "react";
import { graduations, positionsX } from "@/lib/musculation/graphique";
import { formaterPoids } from "@/lib/musculation/seance";
import { ghostButton, metaText } from "@/lib/ui";

export type PointGraphique = { date: string; valeur: number };

// Géométrie en unités de viewBox : le SVG s'adapte à la largeur, les proportions restent.
const L = 360;
const H = 200;
const MARGE = { haut: 20, droite: 18, bas: 28, gauche: 42 };
const COULEUR = "var(--accent-musculation)";

const formatDateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const formatDateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function enDate(date: string): Date {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

/**
 * Courbe d'une valeur au fil des séances (une série, donc ni légende ni
 * deuxième axe : le titre de la carte dit ce qui est tracé). Repère vertical et
 * infobulle au survol et au clavier ; le tableau donne les mêmes valeurs sans
 * passer par le graphique.
 */
export function GraphiqueProgression({ points, unite, libelle }: { points: PointGraphique[]; unite: string; libelle: string }) {
  const idTableau = useId();
  const [actif, setActif] = useState<number | null>(null);
  const [tableau, setTableau] = useState(false);

  const { echelle, xs, ys } = useMemo(() => {
    const e = graduations(points.map((p) => p.valeur));
    const largeur = L - MARGE.gauche - MARGE.droite;
    const hauteur = H - MARGE.haut - MARGE.bas;
    return {
      echelle: e,
      xs: positionsX(points.map((p) => p.date)).map((x) => MARGE.gauche + x * largeur),
      ys: points.map((p) => MARGE.haut + (1 - (p.valeur - e.min) / (e.max - e.min)) * hauteur),
    };
  }, [points]);

  if (points.length === 0) return <p className={metaText}>Pas encore de donnée pour cette mesure.</p>;

  const yDe = (v: number) => MARGE.haut + (1 - (v - echelle.min) / (echelle.max - echelle.min)) * (H - MARGE.haut - MARGE.bas);
  const ligne = points.map((_, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const base = H - MARGE.bas;
  const aire = `${ligne} L${xs.at(-1)!.toFixed(1)} ${base} L${xs[0].toFixed(1)} ${base} Z`;

  function plusProche(clientX: number, rect: DOMRect) {
    const x = ((clientX - rect.left) / rect.width) * L;
    let meilleur = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[meilleur] - x)) meilleur = i;
    setActif(meilleur);
  }

  const p = actif === null ? null : points[actif];
  const gauche = actif === null ? 0 : (xs[actif] / L) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${L} ${H}`}
          className="h-auto w-full touch-pan-y select-none"
          role="img"
          aria-label={`${libelle} : ${points.length} séance${points.length > 1 ? "s" : ""}, de ${formaterPoids(points[0].valeur)} à ${formaterPoids(points.at(-1)!.valeur)} ${unite}`}
        >
          {echelle.ticks.map((t) => (
            <g key={t}>
              <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={yDe(t)} y2={yDe(t)} strokeWidth={1} style={{ stroke: "var(--line)" }} />
              <text x={MARGE.gauche - 8} y={yDe(t) + 4} textAnchor="end" fontSize={11} style={{ fill: "var(--ink-3)" }}>
                {formaterPoids(t)}
              </text>
            </g>
          ))}
          <text x={xs[0]} y={H - 8} textAnchor={points.length > 1 ? "start" : "middle"} fontSize={11} style={{ fill: "var(--ink-3)" }}>
            {formatDateCourte.format(enDate(points[0].date))}
          </text>
          {points.length > 1 && (
            <text x={xs.at(-1)} y={H - 8} textAnchor="end" fontSize={11} style={{ fill: "var(--ink-3)" }}>
              {formatDateCourte.format(enDate(points.at(-1)!.date))}
            </text>
          )}

          {points.length > 1 && (
            <>
              <path d={aire} style={{ fill: COULEUR }} opacity={0.1} />
              <path d={ligne} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: COULEUR }} />
            </>
          )}

          {actif !== null && (
            <line x1={xs[actif]} x2={xs[actif]} y1={MARGE.haut} y2={base} strokeWidth={1} style={{ stroke: "var(--ink-3)" }} />
          )}

          {points.map((pt, i) => (
            <circle
              key={`${pt.date}-${i}`}
              cx={xs[i]}
              cy={ys[i]}
              r={actif === i ? 5 : 4}
              strokeWidth={2}
              style={{ fill: COULEUR, stroke: "var(--surface)" }}
            />
          ))}

          {/* Valeur finale, étiquetée seule : les autres se lisent sur l'axe, l'infobulle et le tableau. */}
          {actif === null && (
            <text
              x={Math.min(xs.at(-1)!, L - MARGE.droite - 4)}
              y={ys.at(-1)! - 10}
              textAnchor="end"
              fontSize={12}
              fontWeight={600}
              style={{ fill: "var(--ink)" }}
            >
              {formaterPoids(points.at(-1)!.valeur)}
            </text>
          )}

          {/* Zones de survol et de focus plus grandes que les points (24 px minimum). */}
          <rect
            x={MARGE.gauche}
            y={MARGE.haut}
            width={L - MARGE.gauche - MARGE.droite}
            height={H - MARGE.haut - MARGE.bas}
            fill="transparent"
            onPointerMove={(e) => plusProche(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerDown={(e) => plusProche(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerLeave={() => setActif(null)}
          />
          {points.map((pt, i) => (
            <circle
              key={`focus-${pt.date}-${i}`}
              cx={xs[i]}
              cy={ys[i]}
              r={12}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${formatDateLongue.format(enDate(pt.date))} : ${formaterPoids(pt.valeur)} ${unite}`}
              onFocus={() => setActif(i)}
              onBlur={() => setActif(null)}
              className="outline-none focus-visible:stroke-[var(--ink)] focus-visible:[stroke-width:2]"
            />
          ))}
        </svg>

        {p && actif !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl border border-line bg-surface px-3 py-2 shadow-card"
            style={{ left: `${gauche}%`, transform: `translateX(${gauche > 55 ? "-105%" : "5%"})` }}
            role="status"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: COULEUR }} />
              <span className="text-[15px] font-semibold tabular-nums text-ink">
                {formaterPoids(p.valeur)} {unite}
              </span>
            </div>
            <span className="text-[12.5px] text-ink-2">{formatDateLongue.format(enDate(p.date))}</span>
          </div>
        )}
      </div>

      <button type="button" className={`${ghostButton} self-start`} aria-expanded={tableau} aria-controls={idTableau} onClick={() => setTableau((t) => !t)}>
        {tableau ? "Masquer le tableau" : "Voir le tableau"}
      </button>
      {tableau && (
        <table id={idTableau} className="w-full text-left text-[14px] tabular-nums">
          <caption className="sr-only">{libelle}</caption>
          <thead>
            <tr className="text-[12.5px] text-ink-2">
              <th scope="col" className="py-1 font-medium">
                Date
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {unite}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((pt, i) => (
              <tr key={`${pt.date}-${i}`} className="border-t border-line">
                <td className="py-1.5 text-ink-2">{formatDateLongue.format(enDate(pt.date))}</td>
                <td className="py-1.5 text-right font-semibold text-ink">{formaterPoids(pt.valeur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
