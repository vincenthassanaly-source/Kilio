// Pastille d'action des lignes de tâche (« Planifier », « Reporter » et ses
// cibles Aujourd'hui / Demain / Lundi) : une seule grammaire pour les deux
// gestes. 36 px visibles, zone de tap étendue à 44 px ; ouverte (aria-expanded),
// elle garde le contour vert.
export const pastilleAction =
  "relative min-h-9 shrink-0 rounded-full border border-line bg-surface-alt px-3 text-small font-semibold text-ink transition-[border-color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-kcal/60 aria-expanded:border-kcal/60 active:scale-[0.97] disabled:opacity-50 after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";
