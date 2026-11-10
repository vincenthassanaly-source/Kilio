// Confirmation avant une action destructive (suppression) déclenchée par
// `dangerButton` (voir lib/ui.ts) : évite qu'un tap accidentel supprime
// définitivement une donnée sans étape intermédiaire. Le dialogue est celui de
// l'app (`ConfirmDialog`, monté une fois dans Providers par `ConfirmHost`), pas
// le `window.confirm` du navigateur : thème, bouton qui nomme l'action, focus
// piégé. `message` nomme l'élément concerné (ex. « Supprimer la note « Courses » ? »).
//
// La promesse se résout à `true` si l'utilisateur confirme, `false` sinon. Une
// demande en cours est refusée si une nouvelle arrive (jamais deux dialogues).

export type DemandeConfirmation = {
  message: string;
  confirmer: string;
  resoudre: (accord: boolean) => void;
};

type Ecouteur = (demande: DemandeConfirmation | null) => void;

let ecouteur: Ecouteur | null = null;
let enCours: DemandeConfirmation | null = null;

export function ecouterConfirmations(fn: Ecouteur): () => void {
  ecouteur = fn;
  fn(enCours);
  return () => {
    if (ecouteur === fn) ecouteur = null;
  };
}

export function confirmDelete(message = "Supprimer définitivement ?", confirmer?: string): Promise<boolean> {
  // Sans hôte monté (rendu serveur, test sans Providers) : repli sur le natif.
  if (typeof window === "undefined" || !ecouteur) {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(message) : false);
  }
  enCours?.resoudre(false);
  return new Promise<boolean>((resolve) => {
    const demande: DemandeConfirmation = {
      message,
      confirmer: confirmer ?? (/^Retirer\b/.test(message) ? "Retirer" : "Supprimer"),
      resoudre: (accord) => {
        if (enCours === demande) enCours = null;
        ecouteur?.(enCours);
        resolve(accord);
      },
    };
    enCours = demande;
    ecouteur?.(demande);
  });
}
