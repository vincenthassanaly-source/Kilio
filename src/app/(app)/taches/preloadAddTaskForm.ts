// Précharge le chunk de AddTaskForm (chargé à la demande via next/dynamic
// dans TasksList et QuickAddFab) avant que l'utilisateur
// n'ouvre le formulaire : au premier appui sur un bouton d'ajout, ou quand
// le navigateur est inactif après l'affichage de /taches. Le premier
// affichage du formulaire n'attend alors plus le réseau.
//
// L'import() est ici un simple déclencheur : le bundler résout le même
// module que celui des dynamic() qui l'utilisent, le chunk n'est donc
// téléchargé qu'une fois.
let chargement: Promise<unknown> | null = null;

export function preloadAddTaskForm(): void {
  if (!chargement) chargement = import("./AddTaskForm").catch(() => {
    // Échec réseau : on retentera au prochain déclencheur, le dynamic()
    // gère de toute façon son propre chargement à l'ouverture.
    chargement = null;
  });
}

// À l'inactivité du navigateur, sans retarder l'affichage initial (repli sur
// un délai court pour Safari, qui n'a pas requestIdleCallback). Renvoie la
// fonction d'annulation, à utiliser comme nettoyage d'effet.
export function preloadAddTaskFormWhenIdle(): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(() => preloadAddTaskForm(), { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = window.setTimeout(preloadAddTaskForm, 1500);
  return () => window.clearTimeout(timer);
}
