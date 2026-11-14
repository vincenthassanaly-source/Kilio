"use client";

import type { Evenement } from "@/app/actions/evenements";
import { formatHeureHHMM, getBlocInterval, type PositionColonne } from "@/lib/agenda/compute";
import { horizontalStyle } from "../agenda/TacheBlock";
import { getTacheBlockStyle } from "../agenda/TimeGrid";

// Un événement est un engagement horodaté, pas une tâche à cocher : plein
// aplat `agenda` (texte `on-agenda`), là où les tâches de la frise sont
// teintées ; comme elles, il porte un contour fin de 1 px (jamais de barre
// latérale), ici l'agenda assombri vers l'encre. Même géométrie que TacheBlock (chevauchements compris).
export function EvenementBlock({
  evenement,
  zoom,
  position,
  compact = false,
  sansTexte = false,
  onSelect,
}: {
  evenement: Evenement;
  zoom: number;
  position?: PositionColonne;
  // Vue Semaine : bloc compact (texte plus petit). Interactif si `onSelect`
  // est fourni ; le conteneur de la colonne n'est alors pas un <button>.
  compact?: boolean;
  // Colonne trop étroite pour un texte lisible : le bloc ne garde que sa couleur.
  sansTexte?: boolean;
  onSelect?: (evenement: Evenement) => void;
}) {
  const style = getTacheBlockStyle(evenement, zoom);
  const intervalle = getBlocInterval(evenement);
  if (!style || !intervalle) return null;

  const insetClass = position && position.nbColonnes > 1 ? "" : compact ? "inset-x-0.5" : "inset-x-1";
  const sizingClass = compact
    ? "rounded-md py-0.5 pl-1.5 pr-1 text-micro"
    : "rounded-lg py-1 pl-2.5 pr-2 text-caption shadow-sm";
  // Pas d'`overflow-hidden` sur le bouton : la troncature est portée par le
  // <span> interne, et le pseudo-élément `after:` étend la zone de tap
  // verticalement (un bloc de 15 à 30 min ferait sinon moins de 44 px).
  const className = `absolute ${insetClass} border border-[color-mix(in_oklch,var(--accent-agenda),var(--ink)_35%)] bg-agenda ${sizingClass} text-left font-semibold leading-tight text-on-agenda`;
  const zoneTap = "after:absolute after:inset-x-0 after:-inset-y-2";
  const blockStyle = { top: style.top, height: style.height, ...horizontalStyle(position) };
  const heure = evenement.heure.slice(0, 5);
  const plage = `de ${formatHeureHHMM(intervalle.start)} à ${formatHeureHHMM(intervalle.end)}`;

  if (!onSelect) {
    return (
      <div className={className} style={blockStyle}>
        <span className="block truncate">
          {heure} {evenement.titre}
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
      title={`${heure} ${evenement.titre}`}
      className={`${className} ${zoneTap} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
      style={blockStyle}
    >
      {!sansTexte && (
        <span className="block truncate" aria-hidden>
          {heure} {evenement.titre}
        </span>
      )}
    </button>
  );
}
