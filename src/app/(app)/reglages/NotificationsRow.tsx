"use client";

import { useEffect, useState } from "react";
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/subscribe";
import { Switch } from "@/components/Switch";
import { errorText } from "@/lib/ui";
import { useSetNotificationsActives } from "./NotificationsContext";
import { Pastille, ReglageDetail, ReglageEntete } from "./ReglageUi";

// Les erreurs de subscribeToPush sont techniques (clé VAPID, variables
// d'environnement…) : le détail reste en console, l'écran dit quoi faire.
function messageActivation(): string {
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return "Les notifications sont bloquées pour ce site. Autorise-les dans les réglages de ton navigateur, puis réessaie.";
  }
  return "Impossible d'activer les notifications pour le moment. Réessaie dans un instant.";
}

function NotificationsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 10a6 6 0 0 1 12 0c0 3.4 1 5 1.8 6H4.2C5 15 6 13.4 6 10z" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

export function NotificationsRow() {
  // null tant que l'état de l'abonnement (async, dépend du service worker)
  // n'est pas connu, pour éviter d'afficher un toggle "off" trompeur le
  // temps du chargement.
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [supported, setSupported] = useState(true);
  const setActives = useSetNotificationsActives();

  // Les réglages qui dépendent des notifications (briefing, revue…) lisent cet état.
  useEffect(() => {
    if (on !== null) setActives(on);
  }, [on, setActives]);

  useEffect(() => {
    let cancelled = false;

    async function checkEtatAbonnement() {
      if (!isPushSupported()) {
        if (!cancelled) {
          setSupported(false);
          setOn(false);
        }
        return;
      }

      if (Notification.permission !== "granted") {
        if (!cancelled) setOn(false);
        return;
      }

      try {
        const sub = await getExistingSubscription();
        if (!cancelled) setOn(sub !== null);
      } catch {
        if (!cancelled) setOn(false);
      }
    }

    checkEtatAbonnement();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!supported) {
      setError("Les notifications ne sont pas supportées par ce navigateur.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      if (on) {
        await unsubscribeFromPush();
        setOn(false);
      } else {
        await subscribeToPush();
        setOn(true);
      }
    } catch (err) {
      console.error("Notifications push : échec de l'activation ou de la désactivation", err);
      setError(on ? "Impossible de désactiver les notifications pour le moment. Réessaie dans un instant." : messageActivation());
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 py-3.5">
      <ReglageEntete
        icone={
          <Pastille>
            <NotificationsIcon />
          </Pastille>
        }
        titre="Notifications"
        action={
          <Switch
            checked={on ?? false}
            onToggle={toggle}
            disabled={pending || on === null}
            label="Activer les notifications"
          />
        }
      />
      {error && (
        <ReglageDetail>
          <p role="alert" className={errorText}>
            {error}
          </p>
        </ReglageDetail>
      )}
    </div>
  );
}
