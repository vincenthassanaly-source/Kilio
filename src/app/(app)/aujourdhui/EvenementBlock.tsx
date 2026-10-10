"use client";

import type { Evenement } from "@/app/actions/evenements";
import { formatHeureHHMM, getBlocInterval, type PositionColonne } from "@/lib/agenda/compute";
import { horizontalStyle } from "../agenda/TacheBlock";
import { getTacheBlockStyle } from "../agenda/TimeGrid";

// Un événement est un engagement horodaté, pas une tâche à cocher : plein
// aplat `agenda` (texte `on-agenda`), là où les tâches de la frise sont
// teintées. Même géométrie que TacheBlock (chevauchements compris).
export function EvenementBlock({
  evenement,
  zoom,
  position,
  compact = false,
  onSelect,
}: {
  evenement: Evenement;
  zoom: number;
  position?: PositionColonne;
  // Vue Semaine : bloc compact, non interactif (le tap y ouvre déjà le jour
  // via le bouton parent ; un <button> imbriqué serait invalide en HTML).
  compact?: boolean;
  onSelect?: (evenement: Evenement) => void;
}) {
  const style = getTacheBlockStyle(evenement, zoom);
  const intervalle = getBlocInterval(evenement);
  if (!style || !intervalle) return null;

  const insetClass = position && position.nbColonnes > 1 ? "" : compact ? "inset-x-0.5" : "inset-x-1";
  const sizingClass = compact
    ? "rounded-md py-0.5 pl-1.5 pr-1 text-[10px]"
    : "rounded-lg py-1 pl-2.5 pr-2 text-[12px] shadow-sm";
  // Pas d'`overflow-hidden` sur le bouton : la troncature est portée par le
  // <span> interne, et le pseudo-élément `after:` étend la zone de tap
  // verticalement (un bloc de 15 à 30 min ferait sinon moins de 44 px).
  const className = `absolute ${insetClass} bg-agenda ${sizingClass} text-left font-semibold leading-tight text-on-agenda`;
  const zoneTap = "after:absolute after:inset-x-0 after:-inset-y-2";
  const blockStyle = { top: style.top, height: style.height, ...horizontalStyle(position) };
  const heure = evenement.heure.slice(0, 5);
  const plage = `de ${formatHeureHHMM(intervalle.start)} à ${formatHeureHHMM(intervalle.end)}`;

  if (!onSelect) {
    return (
      <div className={className} style={blockStyle}>
        <span className="block truncate">
          {heure} {evenement.titre}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(evenement)}
      // Le nom accessible commence par le texte visible (« 09:00 Titre ») : un
      // utilisateur de commande vocale doit pouvoir dire ce qu'il lit (WCAG 2.5.3).
      aria-label={`${heure} ${evenement.titre}, événement ${plage}. Modifier`}
      className={`${className} ${zoneTap} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
      style={blockStyle}
    >
      <span className="block truncate" aria-hidden>
        {heure} {evenement.titre}
      </span>
    </button>
  );
}
