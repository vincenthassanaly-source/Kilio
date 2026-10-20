"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  etatVerrou,
  optionsConnexion,
  optionsInscription,
  prolongerSession,
  verifierConnexion,
  verifierInscription,
  type EtatVerrou,
} from "@/app/actions/verrou";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { eyebrow, errorText, primaryButton, screenTitle } from "@/lib/ui";

// Le module n'affiche rien (pas même un titre) tant que le serveur n'a pas ouvert la session de
// 15 minutes : l'écran ci-dessous la demande avec l'empreinte du téléphone. Le vrai verrou est
// côté serveur (chaque Server Action du module refuse sans session) ; ceci n'est que l'accès.

// Le serveur renouvelle la session à chaque action ; ce rappel couvre une lecture sans action.
const DELAI_PROLONGATION_MS = 4 * 60 * 1000;
// Vérifie régulièrement que la session tient toujours (fin des 15 minutes).
const DELAI_VERIFICATION_MS = 60 * 1000;

type Phase = { nom: "chargement" } | { nom: "erreur"; message: string } | { nom: "ferme"; etat: EtatVerrou } | { nom: "ouvert" };

function Cadenas() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Message lisible pour une erreur du navigateur pendant la lecture biométrique. */
function messagePourErreur(erreur: unknown): string {
  const nom = erreur instanceof Error ? erreur.name : "";
  if (nom === "NotAllowedError" || nom === "AbortError") return "Lecture annulée ou expirée. Réessaie.";
  if (nom === "InvalidStateError") return "Ce téléphone est déjà enregistré.";
  if (nom === "NotSupportedError" || nom === "SecurityError") return "Ce navigateur ne peut pas utiliser l'empreinte ici.";
  return "La lecture a échoué. Réessaie.";
}

/** État du verrou d'après le serveur, ou « injoignable » quand il n'a pas pu répondre (hors ligne, erreur de base). */
async function lirePhase(): Promise<Phase | { nom: "injoignable"; message: string }> {
  try {
    const resultat = await etatVerrou();
    if (!resultat.ok) return { nom: "injoignable", message: resultat.error };
    return resultat.data.ouvert ? { nom: "ouvert" } : { nom: "ferme", etat: resultat.data };
  } catch {
    return { nom: "injoignable", message: "Impossible de joindre le serveur. Vérifie ta connexion." };
  }
}

export function VerrouGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ nom: "chargement" });
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const dernierePing = useRef(0);

  // Une session déjà ouverte ou un écran de verrouillage déjà affiché ne sont pas remplacés par
  // une erreur passagère : seul le premier chargement montre l'erreur.
  const verifier = useCallback(async () => {
    const suivante = await lirePhase();
    setPhase((p) => {
      if (suivante.nom !== "injoignable") return suivante;
      return p.nom === "chargement" || p.nom === "erreur" ? { nom: "erreur", message: suivante.message } : p;
    });
  }, []);

  useEffect(() => {
    let annule = false;
    void lirePhase().then((suivante) => {
      if (annule) return;
      setPhase(suivante.nom === "injoignable" ? { nom: "erreur", message: suivante.message } : suivante);
    });
    return () => {
      annule = true;
    };
  }, []);

  // Session ouverte : renouvelée pendant l'activité, et surveillée pour reverrouiller à l'échéance.
  const ouvert = phase.nom === "ouvert";
  useEffect(() => {
    if (!ouvert) return;
    dernierePing.current = Date.now();
    const surActivite = () => {
      if (Date.now() - dernierePing.current < DELAI_PROLONGATION_MS) return;
      dernierePing.current = Date.now();
      void prolongerSession().catch(() => undefined);
    };
    const surVisibilite = () => {
      if (document.visibilityState === "visible") void verifier();
    };
    const intervalle = window.setInterval(() => void verifier(), DELAI_VERIFICATION_MS);
    window.addEventListener("pointerdown", surActivite);
    window.addEventListener("keydown", surActivite);
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      window.clearInterval(intervalle);
      window.removeEventListener("pointerdown", surActivite);
      window.removeEventListener("keydown", surActivite);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [ouvert, verifier]);

  async function deverrouiller(inscrit: boolean) {
    setMessage(null);
    if (!browserSupportsWebAuthn()) {
      setMessage("Ce navigateur ne gère pas l'empreinte. Ouvre Kilio depuis Chrome ou Safari.");
      return;
    }
    setEnCours(true);
    try {
      if (inscrit) {
        const options = await optionsConnexion();
        if (!options.ok) return setMessage(options.error);
        const reponse = await startAuthentication({ optionsJSON: options.data });
        const verifiee = await verifierConnexion(reponse);
        if (!verifiee.ok) return setMessage(verifiee.error);
      } else {
        const options = await optionsInscription();
        if (!options.ok) return setMessage(options.error);
        const reponse = await startRegistration({ optionsJSON: options.data });
        const verifiee = await verifierInscription(reponse);
        if (!verifiee.ok) return setMessage(verifiee.error);
      }
      setPhase({ nom: "ouvert" });
    } catch (erreur) {
      setMessage(messagePourErreur(erreur));
    } finally {
      setEnCours(false);
    }
  }

  if (phase.nom === "ouvert") return <>{children}</>;

  if (phase.nom === "chargement") return <Skeleton className="h-[60vh] w-full rounded-[22px]" />;

  if (phase.nom === "erreur") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className={errorText} role="alert">
          {phase.message}
        </p>
        <button type="button" className={primaryButton} onClick={() => void verifier()}>
          Réessayer
        </button>
      </div>
    );
  }

  const { configure, inscrit } = phase.etat;
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-10 text-center">
      <span className="text-ink-2">
        <Cadenas />
      </span>
      <h1 className={screenTitle}>{inscrit ? "Vider ma tête est verrouillé" : "Protège ton journal"}</h1>
      <p className={`${eyebrow} max-w-sm normal-case tracking-normal`}>
        {!configure
          ? "Le verrou n'est pas encore configuré côté serveur (variable VIDAGE_SESSION_SECRET)."
          : inscrit
            ? "Déverrouille avec ton empreinte ou ton visage. Si la lecture échoue, le code du téléphone fonctionne aussi."
            : "Enregistre l'empreinte ou le visage de ce téléphone. Seul cet appareil pourra ouvrir le module."}
      </p>
      {configure && (
        <button type="button" className={`${primaryButton} min-h-11 px-6`} disabled={enCours} onClick={() => void deverrouiller(inscrit)}>
          {enCours ? "Lecture en cours…" : inscrit ? "Déverrouiller" : "Enregistrer mon empreinte"}
        </button>
      )}
      <p className={`${errorText} min-h-5`} role="alert">
        {message}
      </p>
    </div>
  );
}
