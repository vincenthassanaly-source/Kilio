"use client";

import { useMemo, useRef } from "react";
import type { Evenement } from "@/app/actions/evenements";
import type { TacheAvecRelations } from "@/app/actions/taches";
import { layoutChevauchements } from "@/lib/agenda/compute";
import type { CreneauDuJour } from "@/lib/agenda/planning-travail";
import { enMinutes, libelleDuree, type Plage } from "@/lib/programme/disponibilites";
import { ghostButton } from "@/lib/ui";
import {
  computeInitialScrollMinutes,
  getTacheBlockStyle,
  gridHeight,
  HourLines,
  NowLine,
  TimeGutter,
  useInitialScroll,
  WorkHoursBand,
} from "../agenda/TimeGrid";
import { TacheBlock } from "../agenda/TacheBlock";
import { EvenementBlock } from "./EvenementBlock";

// Échelle fixe : pas de pincement ici, la frise est un coup d'oeil, l'Agenda
// reste l'écran où l'on zoome.
const ZOOM = 1;
// Sous cette hauteur (px), un trou libre n'a plus la place d'afficher sa durée.
const HAUTEUR_MIN_LIBELLE_PX = 26;

const PLUS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Frise de la journée à l'échelle réelle : horaires de travail, événements,
 * tâches horodatées, repère « maintenant » et trous libres (reçus en props,
 * jamais devinés à l'affichage).
 */
export function DayTimeline({
  taches,
  evenements,
  creneaux,
  libres,
  maintenant,
  onAddEvenement,
  onSelectEvenement,
  onSelectTache,
}: {
  // Tâches du jour non faites avec heure.
  taches: TacheAvecRelations[];
  evenements: Evenement[];
  creneaux: CreneauDuJour[];
  // Trous libres et heure courante : calculés par l'écran, partagés avec la
  // planification des tâches (`plagesLibresDuJour`, testé).
  libres: Plage[];
  maintenant: string;
  onAddEvenement: () => void;
  onSelectEvenement: (evenement: Evenement) => void;
  onSelectTache: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useInitialScroll(scrollRef, computeInitialScrollMinutes({ showCurrentTime: true, creneaux }), ZOOM);

  const positions = useMemo(
    () =>
      layoutChevauchements([
        ...taches.map((t) => ({ id: t.id, heure: t.heure, heure_fin: t.heure_fin })),
        ...evenements.map((e) => ({ id: e.id, heure: e.heure, heure_fin: e.heure_fin })),
      ]),
    [taches, evenements]
  );

  const resume = useMemo(() => {
    const prochainEvenement = evenements.find((e) => e.heure.slice(0, 5) >= maintenant);
    if (prochainEvenement) return `Prochain : ${prochainEvenement.heure.slice(0, 5)} ${prochainEvenement.titre}`;
    const premierTrou = libres[0];
    if (premierTrou) {
      return `Libre ${premierTrou.debut}–${premierTrou.fin} (${libelleDuree(enMinutes(premierTrou.fin) - enMinutes(premierTrou.debut))})`;
    }
    return null;
  }, [evenements, libres, maintenant]);

  return (
    <section aria-labelledby="aujourdhui-frise" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="aujourdhui-frise" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Journée
          </h2>
          {resume && <p className="truncate text-[12.5px] text-ink-2">{resume}</p>}
        </div>
        <button type="button" onClick={onAddEvenement} className={`${ghostButton} flex shrink-0 items-center gap-1.5`}>
          {PLUS_ICON}
          Événement
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div ref={scrollRef} className="max-h-[52vh] overflow-auto" data-swipe-ignore>
          <div className="flex">
            <TimeGutter zoom={ZOOM} creneaux={creneaux} />
            <div className="relative flex-1" style={{ height: gridHeight(ZOOM) }}>
              <HourLines zoom={ZOOM} />
              <WorkHoursBand creneaux={creneaux} zoom={ZOOM} />
              {libres.map((plage) => {
                const style = getTacheBlockStyle({ heure: plage.debut, heure_fin: plage.fin }, ZOOM);
                if (!style) return null;
                const minutes = enMinutes(plage.fin) - enMinutes(plage.debut);
                return (
                  <div
                    key={plage.debut}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-1 rounded-lg border border-dashed border-line"
                    style={{ top: style.top, height: style.height }}
                  >
                    {style.height >= HAUTEUR_MIN_LIBELLE_PX && (
                      <span className="absolute left-2 top-1 text-[11px] font-medium text-ink-3">
                        Libre · {libelleDuree(minutes)}
                      </span>
                    )}
                  </div>
                );
              })}
              <NowLine zoom={ZOOM} />
              {evenements.map((e) => (
                <EvenementBlock
                  key={e.id}
                  evenement={e}
                  zoom={ZOOM}
                  position={positions.get(e.id)}
                  onSelect={onSelectEvenement}
                />
              ))}
              {taches.map((t) => (
                <TacheBlock key={t.id} tache={t} zoom={ZOOM} position={positions.get(t.id)} onSelect={onSelectTache} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
