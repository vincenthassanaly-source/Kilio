"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSwipeHorizontal, type SensSwipe } from "@/hooks/useSwipeHorizontal";
import { shiftDate } from "@/lib/date/iso";

type JourCourant = { date: string; jourType: string };

const JournalSwipeContext = createContext<{
  sens: SensSwipe;
  enregistrerJour: (jour: JourCourant) => void;
} | null>(null);

/**
 * Ajoute le swipe horizontal (même geste/tolérances que l'Agenda, voir
 * `useSwipeHorizontal`) au Journal Nutrition — un composant serveur dont
 * chaque changement de jour recharge via `searchParams` (`date`, `jour`).
 *
 * Englobe toute la page, coquille comprise : il ne connaît donc pas le jour
 * affiché, qui arrive en streaming. `JournalJourAnime` (rendu avec le
 * contenu du jour) le lui transmet ; tant qu'il n'est pas arrivé, un swipe
 * ne fait rien. Le sens du swipe est gardé en state ici pour piloter
 * l'animation `agenda-glisse-*`, rejouée par `JournalJourAnime` à chaque
 * nouveau jour.
 */
export function JournalSwipeWrapper({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sens, setSens] = useState<SensSwipe>("suivant");
  const jourRef = useRef<JourCourant | null>(null);
  const enregistrerJour = useCallback((jour: JourCourant) => {
    jourRef.current = jour;
  }, []);

  const swipeHandlers = useSwipeHorizontal((sensSwipe) => {
    const jour = jourRef.current;
    if (!jour) return;
    setSens(sensSwipe);
    const nouvelleDate = shiftDate(jour.date, sensSwipe === "suivant" ? 1 : -1);
    // Sans `&jour=` : le jour d'arrivée applique son propre type mémorisé.
    // replace : un changement de jour ne doit pas empiler l'historique (retour = sortir du Journal).
    router.replace(`/nutrition/journal?date=${nouvelleDate}`);
  });

  return (
    <JournalSwipeContext value={{ sens, enregistrerJour }}>
      <div data-swipe-zone {...swipeHandlers}>
        {children}
      </div>
    </JournalSwipeContext>
  );
}

/** Contenu du jour affiché : l'annonce au swipe et rejoue le glissement. */
export function JournalJourAnime({
  date,
  jourType,
  children,
}: {
  date: string;
  jourType: string;
  children: ReactNode;
}) {
  const contexte = useContext(JournalSwipeContext);
  const enregistrerJour = contexte?.enregistrerJour;

  useEffect(() => {
    enregistrerJour?.({ date, jourType });
  }, [enregistrerJour, date, jourType]);

  return (
    <div className={contexte?.sens === "precedent" ? "agenda-glisse-precedent" : "agenda-glisse-suivant"}>
      {children}
    </div>
  );
}
