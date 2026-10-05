"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { useBackClose } from "@/hooks/useBackClose";
import {
  DELAI_ENDORMISSEMENT_MIN,
  formaterDuree,
  formaterHeure,
  heureDepuisMinutes,
  type Proposition,
} from "@/lib/reveil/cycles";
import { errorText, kcalPillTag, secondaryButton } from "@/lib/ui";

type Etat =
  | { statut: "chargement"; heureActuelle: string }
  | { statut: "ok"; heureActuelle: string; propositions: Proposition[]; recommande: number }
  | { statut: "erreur"; message: string };

type Reponse =
  | { ok: true; propositions: Proposition[]; recommande: number }
  | { ok: false; message?: string };

function AlarmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 1.5" />
      <path d="M4.5 5.5 7.5 3M19.5 5.5 16.5 3" />
    </svg>
  );
}

function heureLocale(): string {
  const maintenant = new Date();
  return heureDepuisMinutes(maintenant.getHours() * 60 + maintenant.getMinutes());
}

/** Petit bouton de l'en-tête du dashboard : ouvre une feuille avec trois
 * heures de réveil qui tombent en fin de cycle de sommeil, calculées par
 * Gemini (POST /api/reveil) à partir de l'heure de l'appareil. */
export function ReveilButton() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState<Etat>({ statut: "chargement", heureActuelle: "" });
  const controleurRef = useRef<AbortController | null>(null);

  const fermer = useCallback(() => {
    controleurRef.current?.abort();
    setOuvert(false);
  }, []);
  useBackClose(ouvert, fermer);

  const lancer = useCallback(async () => {
    controleurRef.current?.abort();
    const controleur = new AbortController();
    controleurRef.current = controleur;
    const heureActuelle = heureLocale();
    setEtat({ statut: "chargement", heureActuelle });
    try {
      const res = await fetch("/api/reveil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heureActuelle }),
        signal: controleur.signal,
      });
      const data = (await res.json()) as Reponse;
      if (!res.ok || !data.ok) {
        setEtat({ statut: "erreur", message: (!data.ok && data.message) || "Le calcul a échoué." });
        return;
      }
      setEtat({ statut: "ok", heureActuelle, propositions: data.propositions, recommande: data.recommande });
    } catch {
      if (controleur.signal.aborted) return;
      setEtat({ statut: "erreur", message: "Connexion impossible. Réessaie une fois en ligne." });
    }
  }, []);

  function ouvrir() {
    setOuvert(true);
    void lancer();
  }

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        aria-label="Calculer une heure de réveil"
        aria-haspopup="dialog"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card transition active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <AlarmIcon />
      </button>

      <AnimatePresence>
        {ouvert && (
          <Modal key="reveil" title="Réveil en fin de cycle" onClose={() => history.back()}>
            <ContenuReveil etat={etat} onRetry={() => void lancer()} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function ContenuReveil({ etat, onRetry }: { etat: Etat; onRetry: () => void }) {
  if (etat.statut === "erreur") {
    return (
      <div className="flex flex-col gap-3 pb-1" role="alert">
        <p className={errorText}>{etat.message}</p>
        <button type="button" onClick={onRetry} className={secondaryButton}>
          Réessayer
        </button>
      </div>
    );
  }

  const phrase = (
    <p className="text-sm text-ink-2 text-pretty">
      Si tu te couches à {formaterHeure(etat.heureActuelle)} et t&apos;endors en {DELAI_ENDORMISSEMENT_MIN} min, réveille-toi à l&apos;une de ces heures : tu sors d&apos;un cycle complet.
    </p>
  );

  if (etat.statut === "chargement") {
    return (
      <div className="flex flex-col gap-3 pb-1" aria-busy="true" aria-live="polite">
        {etat.heureActuelle && phrase}
        <span className="sr-only">Calcul en cours…</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[60px] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-1" aria-live="polite">
      {phrase}
      <ul className="flex flex-col gap-1.5">
        {etat.propositions.map((p) => {
          const recommande = p.cycles === etat.recommande;
          return (
            <li
              key={p.cycles}
              className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 ${recommande ? "bg-kcal-soft" : "bg-surface-alt"}`}
            >
              <span className="font-display text-[28px] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
                {formaterHeure(p.heure)}
              </span>
              <span className="flex flex-col items-end gap-1 text-right">
                {recommande && <span className={kcalPillTag}>Idéal</span>}
                <span className="text-[13px] font-medium text-ink-2 tabular-nums">
                  {p.cycles} cycles · {formaterDuree(p.dureeSommeilMin)} de sommeil
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
