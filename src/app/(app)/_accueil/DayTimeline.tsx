"use client";

import { useMemo, useRef, useState } from "react";
import type { Evenement } from "@/app/actions/evenements";
import type { TacheAvecRelations } from "@/app/actions/taches";
import { layoutChevauchements } from "@/lib/agenda/compute";
import { prochainElement } from "@/lib/aujourdhui/compute";
import type { CreneauDuJour } from "@/lib/agenda/planning-travail";
import {
  enMinutes,
  libelleDuree,
  type Plage,
} from "@/lib/programme/disponibilites";
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

type Positions = ReturnType<typeof layoutChevauchements>;

/** Grille horaire : montée seulement déroulée, pour caler le défilement sur l'heure courante à l'ouverture. */
function GrilleJournee({
  taches,
  evenements,
  evenementsJournee,
  creneaux,
  libres,
  positions,
  onSelectEvenement,
  onSelectTache,
}: {
  taches: TacheAvecRelations[];
  evenements: Evenement[];
  evenementsJournee: Evenement[];
  creneaux: CreneauDuJour[];
  libres: Plage[];
  positions: Positions;
  onSelectEvenement: (evenement: Evenement) => void;
  onSelectTache: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useInitialScroll(
    scrollRef,
    computeInitialScrollMinutes({ showCurrentTime: true, creneaux }),
    ZOOM,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {evenementsJournee.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-line/60 px-3 py-2">
          {evenementsJournee.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelectEvenement(e)}
              aria-label={`Événement journée entière ${e.titre}. Modifier`}
              className="relative min-h-9 max-w-[260px] truncate rounded-lg bg-agenda px-3 py-1.5 text-xs font-semibold text-on-agenda after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              {e.titre}
            </button>
          ))}
        </div>
      )}
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Grille horaire du jour"
        // 36vh (et non 52vh) : l'échelle reste réelle, la fenêtre montre ~5 h
        // de la journée, calée sur l'heure courante, et la grille défile
        // dedans. Une fenêtre plus haute repoussait « Tâches » hors du premier écran.
        className="max-h-[36vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        data-swipe-ignore
      >
        <div className="flex">
          <TimeGutter zoom={ZOOM} creneaux={creneaux} />
          <div className="relative flex-1" style={{ height: gridHeight(ZOOM) }}>
            <HourLines zoom={ZOOM} />
            <WorkHoursBand creneaux={creneaux} zoom={ZOOM} />
            {libres.map((plage) => {
              const style = getTacheBlockStyle(
                { heure: plage.debut, heure_fin: plage.fin },
                ZOOM,
              );
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
                    <span className="absolute left-2 top-1 text-micro font-medium text-ink-3">
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
              <TacheBlock
                key={t.id}
                tache={t}
                zoom={ZOOM}
                position={positions.get(t.id)}
                onSelect={onSelectTache}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Frise de la journée à l'échelle réelle : horaires de travail, événements,
 * tâches horodatées, repère « maintenant » et trous libres (reçus en props,
 * jamais devinés à l'affichage).
 */
export function DayTimeline({
  taches,
  evenements,
  evenementsJournee = [],
  creneaux,
  libres,
  maintenant,
  onSelectEvenement,
  onSelectTache,
}: {
  // Tâches du jour non faites avec heure.
  taches: TacheAvecRelations[];
  evenements: Evenement[];
  // Événements « journée entière » : bandeau au-dessus de la grille.
  evenementsJournee?: Evenement[];
  creneaux: CreneauDuJour[];
  // Trous libres et heure courante : calculés par l'écran, partagés avec la
  // planification des tâches (`plagesLibresDuJour`, testé).
  libres: Plage[];
  maintenant: string;
  onSelectEvenement: (evenement: Evenement) => void;
  onSelectTache: (id: string) => void;
}) {
  const [deployee, setDeployee] = useState(false);

  const positions = useMemo(
    () =>
      layoutChevauchements([
        ...taches.map((t) => ({
          id: t.id,
          heure: t.heure,
          heure_fin: t.heure_fin,
        })),
        ...evenements.map((e) => ({
          id: e.id,
          heure: e.heure,
          heure_fin: e.heure_fin,
        })),
      ]),
    [taches, evenements],
  );

  const resume = useMemo(() => {
    // La fenêtre de la frise ne montre que quelques heures : le sous-titre dit
    // donc le prochain élément, événement OU tâche horodatée, même hors fenêtre.
    const prochain = prochainElement([...evenements, ...taches], maintenant);
    if (prochain) return `Prochain : ${prochain.heure} ${prochain.titre}`;
    const premierTrou = libres[0];
    if (premierTrou) {
      return `Libre ${premierTrou.debut}–${premierTrou.fin} (${libelleDuree(enMinutes(premierTrou.fin) - enMinutes(premierTrou.debut))})`;
    }
    return null;
  }, [evenements, taches, libres, maintenant]);

  // Plus rien dans ce qui reste de la journée : la frise ne montrerait que du vide.
  const rienAVenir = useMemo(
    () =>
      evenementsJournee.length === 0 &&
      ![...evenements, ...taches].some(
        (e) => e.heure && (e.heure_fin ?? e.heure).slice(0, 5) >= maintenant,
      ),
    [evenements, taches, evenementsJournee, maintenant],
  );
  const replie = rienAVenir && !deployee;

  return (
    <section
      aria-labelledby="aujourdhui-frise"
      className="flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="aujourdhui-frise"
            className="text-body font-semibold tracking-[-0.01em] text-ink"
          >
            Journée
          </h2>
          {resume && <p className="truncate text-small text-ink-2">{resume}</p>}
        </div>
      </div>

      {replie ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="min-w-0 text-label text-ink-2">
            {libres[0]
              ? `Plus rien de prévu aujourd'hui · libre jusqu'à ${libres[libres.length - 1]?.fin ?? libres[0].fin}`
              : "Plus rien de prévu aujourd'hui."}
          </p>
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setDeployee(true)}
            className="relative shrink-0 text-small font-semibold text-kcal after:absolute after:-inset-x-2 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
          >
            Voir la frise
          </button>
        </div>
      ) : (
        <GrilleJournee
          taches={taches}
          evenements={evenements}
          evenementsJournee={evenementsJournee}
          creneaux={creneaux}
          libres={libres}
          positions={positions}
          onSelectEvenement={onSelectEvenement}
          onSelectTache={onSelectTache}
        />
      )}
    </section>
  );
}
