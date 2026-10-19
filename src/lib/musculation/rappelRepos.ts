"use client";

import { annulerRappelRepos, programmerRappelRepos } from "@/app/actions/rappel-repos";
import { prochaineSerie, type Brouillon } from "./seance";

// Notification push à la fin du repos : la seule façon d'être prévenu téléphone
// verrouillé (Android coupe le son et les minuteurs d'une page en arrière-plan).
// Le serveur garde UN rappel (voir actions/rappel-repos.ts) ; on le met à jour
// quand le repos démarre ou change, et on l'annule quand il se termine.
// Best-effort : sans réseau ou sans autorisation de notifications, la sonnerie
// et la vibration locales restent le filet de sécurité.

// Dernier état envoyé : `undefined` rien d'envoyé (ou échec, à retenter), `null` rappel annulé.
let dernier: string | null | undefined;
const PAUSE_APRES_ECHEC_MS = 15_000;
let pauseJusqua = 0;

function notificationsAutorisees(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

function corpsDuRappel(b: Brouillon): string {
  const suivante = prochaineSerie(b);
  return suivante ? `${suivante.nom} · série ${suivante.rang}/${suivante.nbSeries}` : "Toutes les séries sont validées";
}

/** À appeler quand le brouillon change (ou se termine : `null`) ; sans effet si le repos n'a pas bougé. */
export function synchroniserRappelRepos(b: Brouillon | null): void {
  const repos = b?.repos ?? null;
  const etat = repos && b ? `${repos.finA}|${corpsDuRappel(b)}` : null;
  // Un premier état « sans repos » annule quand même : après un rechargement, un rappel
  // programmé avant pourrait encore exister côté serveur (repos passé entre-temps).
  if (etat === dernier) return;
  if (etat !== null && !notificationsAutorisees()) return;
  // Après un échec (hors ligne en salle, serveur indisponible), pas de nouvelle tentative
  // à chaque saisie : le brouillon change sans cesse pendant la séance.
  if (Date.now() < pauseJusqua) return;

  const precedent = dernier;
  dernier = etat;
  const appel = repos && b ? programmerRappelRepos({ finA: repos.finA, titre: "Repos terminé", corps: corpsDuRappel(b) }) : annulerRappelRepos();
  const echec = () => {
    dernier = precedent;
    pauseJusqua = Date.now() + PAUSE_APRES_ECHEC_MS;
  };
  void appel
    .then((resultat) => {
      if (!resultat.ok) echec();
    })
    .catch(echec);
}
