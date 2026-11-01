"use client";

import { prochaineSerie, type Brouillon } from "./seance";

// Notification push à la fin du repos : la seule façon d'être prévenu téléphone
// verrouillé (Android coupe le son et les minuteurs d'une page en arrière-plan).
// Le serveur garde UN rappel (voir actions/rappel-repos.ts) ; on le met à jour
// quand le repos démarre ou change, et on l'annule quand il se termine.
//
// Fiabilité : on coche une série puis on verrouille aussitôt le téléphone. Trois
// protections pour que le serveur reçoive quand même le rappel :
//  - `fetch(..., { keepalive: true })` : la requête part même si la page passe en arrière-plan ;
//  - nouvelles tentatives espacées après un échec (réseau coupé en salle) ;
//  - renvoi au retour du réseau et quand la page se cache, si le serveur n'a pas confirmé.
// La sonnerie et la vibration locales restent le filet de sécurité, sans réseau ni autorisation.

type Souhait = { cle: string; rappel: { finA: string; titre: string; corps: string } | null };

const DELAIS_RETENTE_MS = [2_000, 5_000, 10_000, 20_000];

// Ce que le serveur doit avoir, et ce qu'il a confirmé avoir. `undefined` : rien envoyé ou échec.
let souhaite: Souhait | undefined;
let confirme: string | undefined;
let enVol: string | undefined;
let tentatives = 0;
let minuterie: ReturnType<typeof setTimeout> | undefined;
let ecouteursPoses = false;

function notificationsAutorisees(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

function corpsDuRappel(b: Brouillon): string {
  const suivante = prochaineSerie(b);
  return suivante ? `${suivante.nom} · série ${suivante.rang}/${suivante.nbSeries}` : "Toutes les séries sont validées";
}

function envoyer(): void {
  const cible = souhaite;
  // Un seul envoi à la fois : sinon un ancien « programmer » pourrait arriver après un « annuler » plus récent.
  if (!cible || cible.cle === confirme || enVol !== undefined) return;
  enVol = cible.cle;
  if (minuterie) clearTimeout(minuterie);

  const requete = cible.rappel
    ? fetch("/api/rappel-repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cible.rappel),
        keepalive: true,
      })
    : fetch("/api/rappel-repos", { method: "DELETE", keepalive: true });

  void requete
    .then((reponse) => {
      // 400 : échéance dépassée ou hors limites côté serveur. Réessayer n'y changera rien (le
      // repos est fini, la sonnerie locale suffit) : on considère l'état réglé.
      if (!reponse.ok && reponse.status !== 400) throw new Error(String(reponse.status));
      confirme = cible.cle;
      tentatives = 0;
    })
    .catch(() => {
      // Échec réseau ou 5xx : on retente, avec des délais croissants.
      if (souhaite !== cible) return;
      const delai = DELAIS_RETENTE_MS[tentatives];
      tentatives += 1;
      if (delai !== undefined) minuterie = setTimeout(envoyer, delai);
    })
    .finally(() => {
      enVol = undefined;
      // Un état plus récent est arrivé pendant l'envoi : on l'envoie maintenant.
      if (souhaite !== cible) envoyer();
    });
}

function poserEcouteurs(): void {
  if (ecouteursPoses || typeof window === "undefined") return;
  ecouteursPoses = true;
  const renvoyer = () => {
    tentatives = 0;
    envoyer();
  };
  window.addEventListener("online", renvoyer);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") renvoyer();
  });
}

/** À appeler quand le brouillon change (ou se termine : `null`) ; sans effet si le repos n'a pas bougé. */
export function synchroniserRappelRepos(b: Brouillon | null): void {
  const repos = b?.repos ?? null;
  const rappel = repos && b ? { finA: repos.finA, titre: "Repos terminé", corps: corpsDuRappel(b) } : null;
  const cle = rappel ? `${rappel.finA}|${rappel.corps}` : "";
  // Un premier état « sans repos » annule quand même : après un rechargement, un rappel
  // programmé avant pourrait encore exister côté serveur (repos passé entre-temps).
  if (cle === souhaite?.cle) return;
  if (rappel && !notificationsAutorisees()) return;

  poserEcouteurs();
  souhaite = { cle, rappel };
  tentatives = 0;
  envoyer();
}
