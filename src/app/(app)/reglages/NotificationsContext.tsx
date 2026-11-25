"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// État des notifications générales (abonnement push), partagé entre la ligne
// « Notifications » qui le connaît et les réglages qui en dépendent (briefing,
// revue, alerte kcal, rappel de saisie, vidage). `null` : pas encore connu
// (ou aucun fournisseur autour) ; on ne grise rien tant qu'on ne sait pas.
type Etat = {
  actives: boolean | null;
  setActives: (actives: boolean) => void;
};

const NotificationsContext = createContext<Etat>({ actives: null, setActives: () => {} });

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [actives, setActives] = useState<boolean | null>(null);
  return <NotificationsContext.Provider value={{ actives, setActives }}>{children}</NotificationsContext.Provider>;
}

function useNotificationsActives(): boolean | null {
  return useContext(NotificationsContext).actives;
}

export function useSetNotificationsActives(): (actives: boolean) => void {
  return useContext(NotificationsContext).setActives;
}

/**
 * Explication affichée sous la ligne « Notifications » quand elles sont
 * éteintes : alignée sous son titre (même retrait que `ReglageDetail`) et sans
 * filet, pour se lire comme le détail de cette ligne et non comme un réglage.
 */
export function BandeauNotificationsEteintes() {
  if (useNotificationsActives() !== false) return null;
  return (
    <p role="status" className="-mt-1.5 pb-3.5 pl-[42px] text-small leading-snug text-ink-2">
      Active d&apos;abord les notifications : les rappels ci-dessous ne peuvent pas t&apos;être envoyés sans elles.
    </p>
  );
}

/** Grise (et désactive) les réglages d'une notification quand les notifications générales sont éteintes. */
export function DependsOnNotifications({ children }: { children: ReactNode }) {
  const off = useNotificationsActives() === false;
  return (
    <fieldset disabled={off} className={`m-0 min-w-0 border-0 p-0 transition-opacity ${off ? "opacity-50" : ""}`}>
      {children}
    </fieldset>
  );
}
