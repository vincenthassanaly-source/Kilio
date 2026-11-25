"use client";

import type { Evenement } from "@/app/actions/evenements";
import { formatHeureHHMM, getBlocInterval, type PositionColonne } from "@/lib/agenda/compute";
import { horizontalStyle } from "../agenda/TacheBlock";
import { getTacheBlockStyle } from "../agenda/TimeGrid";

// Un événement est un engagement horodaté, pas une tâche à cocher : plein
// aplat `agenda` (texte `on-agenda`), là où les tâches de la frise sont
// teintées ; comme elles, il porte un contour fin de 1 px (jamais de barre
// latérale), à peine plus profond que l'aplat (15 % d'encre) : il sépare deux
// blocs voisins sans dessiner un cerne sombre en thème clair. Même géométrie
// et même écriture des heures que TacheBlock (« 09:00 – 10:00 Titre » en
// pleine taille, « 09:00 Titre » en compact), chevauchements compris.
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
    : "rounded-lg py-1 pl-2.5 pr-2 text-caption shadow-card";
  // Pas d'`overflow-hidden` sur le bouton : la troncature est portée par le
  // <span> interne, et le pseudo-élément `after:` étend la zone de tap
  // verticalement (un bloc de 15 à 30 min ferait sinon moins de 44 px).
  const className = `absolute ${insetClass} border border-[color-mix(in_oklch,var(--accent-agenda),var(--ink)_15%)] bg-agenda ${sizingClass} text-left font-semibold leading-tight text-on-agenda`;
  const zoneTap = "after:absolute after:inset-x-0 after:-inset-y-2";
  const blockStyle = { top: style.top, height: style.height, ...horizontalStyle(position) };
  const heure = evenement.heure.slice(0, 5);
  const plage = `de ${formatHeureHHMM(intervalle.start)} à ${formatHeureHHMM(intervalle.end)}`;
  const avecFin = !compact && Boolean(evenement.heure_fin);
  const texte = avecFin
    ? `${heure} – ${evenement.heure_fin!.slice(0, 5)} ${evenement.titre}`
    : `${heure} ${evenement.titre}`;

  if (!onSelect) {
    return (
      <div className={className} style={blockStyle}>
        <span className="block truncate">{texte}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(evenement)}
      // Le nom accessible commence par le texte visible : un utilisateur de
      // commande vocale doit pouvoir dire ce qu'il lit (WCAG 2.5.3). La plage
      // n'est répétée que si le texte visible ne la porte pas (bloc compact).
      aria-label={`${texte}, événement${avecFin ? "" : ` ${plage}`}. Modifier`}
      title={texte}
      className={`${className} ${zoneTap} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2`}
      style={blockStyle}
    >
      {!sansTexte && (
        <span className="block truncate" aria-hidden>
          {texte}
        </span>
      )}
    </button>
  );
}
