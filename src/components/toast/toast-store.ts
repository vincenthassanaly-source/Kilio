// Petit pub-sub sans dépendance : sert uniquement à signaler un échec de
// mutation optimiste (rollback silencieux côté cache + toast discret côté
// UI), pas un système de notifications complet. Un seul flux global suffit
// pour une app mono-utilisateur.
// `label` : texte visible du bouton (« Annuler », « Voir »…) ; `ariaLabel` :
// libellé complet annoncé aux lecteurs d'écran, avec le contexte (« Annuler
// la suppression de « Lait » »). Sans `ariaLabel`, le `label` seul est lu.
type ToastAction = { label: string; ariaLabel?: string; onAction: () => void };
// `tone: "error"` : toast d'échec, rendu avec `role="alert"` (annonce
// immédiate) au lieu du flux poli `role="status"` du conteneur.
export type ToastMessage = { id: number; text: string; action?: ToastAction; tone?: "error" };

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

// `dureeMs` : durée d'affichage, 3,2 s par défaut ; à allonger pour un
// message long (avertissement de plus d'une ligne).
export function showToast(text: string, dureeMs = 3200, tone?: "error") {
  const id = nextId++;
  toasts = [...toasts, { id, text, tone }];
  emit();
  setTimeout(() => dismissToast(id), dureeMs);
}

// Toast d'échec d'une Server Action (voir lib/actions/runAction.ts) : un
// peu plus long qu'un toast simple, le message nommant quoi faire.
export function showErrorToast(text: string, dureeMs = 5000) {
  showToast(text, dureeMs, "error");
}

// Durée par défaut d'un toast à action : plus longue qu'un toast simple
// (3,2 s) pour laisser le temps de repérer et presser « Annuler » — 6 s,
// cohérent avec le pattern undo-toast usuel (Gmail, Android).
const DUREE_ACTION_MS = 6000;

// Toast avec une action explicite (« Annuler » après une suppression, « Voir »
// après un ajout…) : né avec le lot B Courses, généralisé par la vague 1 de
// l'audit (le libellé visible n'est plus codé en dur dans ToastHost).
// Plusieurs toasts d'action peuvent coexister : chacun a son propre `id` et
// son propre timer, comme les toasts simples.
export function showActionToast(
  text: string,
  {
    label = "Annuler",
    ariaLabel,
    onAction,
    dureeMs = DUREE_ACTION_MS,
  }: { label?: string; ariaLabel?: string; onAction: () => void; dureeMs?: number }
) {
  const id = nextId++;
  toasts = [...toasts, { id, text, action: { label, ariaLabel, onAction } }];
  emit();
  setTimeout(() => dismissToast(id), dureeMs);
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastMessage[] {
  return toasts;
}
