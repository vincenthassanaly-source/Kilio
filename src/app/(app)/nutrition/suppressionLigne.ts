// Bouton « Supprimer » répété sur chaque ligne d'une liste Nutrition (repas du
// Carnet, ingrédient, étape, relevé) : même style neutre que Courses
// (CourseItemRow). La suppression y est toujours annulable par le toast, donc
// pas de cadre ni de rouge au repos : texte `ink-2`, rouge au survol, cible de
// 44 px de haut.
export const boutonSupprimerLigne =
  "flex min-h-11 shrink-0 items-center justify-center rounded-xl px-2.5 text-label font-medium text-ink-2 transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-alt hover:text-alert active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";
