"use client";

import type { Tables } from "@/lib/supabase/types";
import { formatHeureHHMM, getBlocInterval, type PositionColonne } from "@/lib/agenda/compute";
import { getTacheBlockStyle } from "./TimeGrid";

// Bloc de tâche partagé entre DayView (plein format, cliquable) et WeekView
// (`compact`, non cliquable : le tap y ouvre déjà le jour via le bouton
// parent — un <button> imbriqué serait invalide en HTML).
//
// Le texte est toujours en couleur d'encre (`text-ink`, contraste ≥11:1 dans
// les deux thèmes sur ces fonds teintés à 15% — voir le script de ratios du
// rapport) : la priorité n'est plus portée par une couleur de texte à
// 3,8:1. Elle passe par une barre latérale de 3px (`border`) plus, pour
// moyenne/haute, un marqueur non chromatique (glyphe) qui reste lisible en
// cas de daltonisme ou de rendu en niveaux de gris.
const PRIORITE_STYLE: Record<
  Tables<"taches">["priorite"],
  { bg: string; border: string; marker: string | null; label: string }
> = {
  aucune: { bg: "bg-surface-alt", border: "border-l-line", marker: null, label: "priorité aucune" },
  basse: { bg: "bg-agenda/15", border: "border-l-agenda", marker: null, label: "priorité basse" },
  moyenne: { bg: "bg-carbs/15", border: "border-l-carbs", marker: "●", label: "priorité moyenne" },
  haute: { bg: "bg-alert/15", border: "border-l-alert", marker: "▲", label: "priorité haute" },
};

// Écart visuel entre deux blocs voisins lorsqu'ils se partagent la largeur
// de la grille (chevauchement, cf. layoutChevauchements) : appliqué de
// façon identique de chaque côté de chaque colonne (y compris en bord de
// grille) pour une formule simple et un espacement régulier.
const COLUMN_GAP_PX = 2;

export type TacheBlocInfo = {
  id: string;
  titre: string;
  heure: string | null;
  heure_fin: string | null;
  priorite: Tables<"taches">["priorite"];
};

export function horizontalStyle(position?: PositionColonne): React.CSSProperties | undefined {
  if (!position || position.nbColonnes <= 1) return undefined;
  const { colonne, nbColonnes } = position;
  return {
    left: `calc(${(colonne / nbColonnes) * 100}% + ${COLUMN_GAP_PX / 2}px)`,
    width: `calc(${(1 / nbColonnes) * 100}% - ${COLUMN_GAP_PX}px)`,
  };
}

export function TacheBlock({
  tache,
  zoom,
  position,
  compact = false,
  onSelect,
}: {
  tache: TacheBlocInfo;
  zoom: number;
  // Colonne assignée par layoutChevauchements en cas de chevauchement avec
  // d'autres blocs du même jour ; absent (ou nbColonnes 1) = pleine largeur,
  // rendu strictement identique à avant l'introduction du chevauchement.
  position?: PositionColonne;
  // Vue Semaine : bloc compact (texte plus petit, pas d'heure de fin dans le
  // libellé affiché). Vue Jour (défaut) : bloc pleine taille avec la plage
  // horaire complète.
  compact?: boolean;
  // Vue Jour uniquement : tap = surbrillance + scroll vers la TaskCard (cf.
  // AgendaView.onSelectTache). Absent en Semaine, voir note ci-dessus.
  onSelect?: (id: string) => void;
}) {
  const style = getTacheBlockStyle(tache, zoom);
  if (!style) return null;

  const prioriteStyle = PRIORITE_STYLE[tache.priorite];
  const insetClass = position && position.nbColonnes > 1 ? "" : compact ? "inset-x-0.5" : "inset-x-1";
  const sizingClass = compact
    ? "rounded-md py-0.5 pl-1.5 pr-1 text-[10px]"
    : "rounded-lg py-1 pl-2.5 pr-2 text-[12px] shadow-sm";
  const className = `absolute overflow-hidden border-l-[3px] ${insetClass} ${sizingClass} leading-tight font-semibold text-ink ${prioriteStyle.bg} ${prioriteStyle.border}`;
  const blockStyle: React.CSSProperties = {
    top: style.top,
    height: style.height,
    ...horizontalStyle(position),
  };

  const heureDebut = tache.heure?.slice(0, 5);
  const label = compact
    ? `${heureDebut ?? ""} ${tache.titre}`
    : tache.heure_fin
      ? `${heureDebut} – ${tache.heure_fin.slice(0, 5)} ${tache.titre}`
      : `${heureDebut} ${tache.titre}`;
  // Marqueur non chromatique (moyenne/haute uniquement) : reste perceptible
  // pour un utilisateur daltonien ou en cas de rendu en niveaux de gris, où
  // la barre latérale colorée seule ne suffirait pas à distinguer les
  // priorités entre elles.
  const displayLabel = prioriteStyle.marker ? `${prioriteStyle.marker} ${label}` : label;

  if (!onSelect) {
    return (
      <div className={className} style={blockStyle}>
        <span className="block truncate">{displayLabel}</span>
      </div>
    );
  }

  // La plage annoncée reprend toujours les bornes effectives du bloc (même
  // durée par défaut de 30 min que le rendu, cf. getBlocInterval), pour
  // qu'un lecteur d'écran annonce une fin même sans `heure_fin` saisie. La
  // priorité est annoncée en toutes lettres (le marqueur visuel est
  // `aria-hidden`, cf. ci-dessous).
  const interval = getBlocInterval(tache);
  const ariaLabel = interval
    ? `${tache.titre}, de ${formatHeureHHMM(interval.start)} à ${formatHeureHHMM(interval.end)}, ${prioriteStyle.label}`
    : `${tache.titre}, ${prioriteStyle.label}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(tache.id)}
      className={`${className} text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agenda`}
      style={blockStyle}
      aria-label={ariaLabel}
    >
      <span className="block truncate" aria-hidden>
        {displayLabel}
      </span>
    </button>
  );
}
