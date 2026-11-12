"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { useBackClose } from "@/hooks/useBackClose";
import { showToast } from "@/components/toast/toast-store";
import { queryKeys } from "@/lib/query/keys";
import { AJOUT_LABELS, type CatalogueItem, type MomentRepas } from "@/lib/nutrition/compute";

const AjoutRepasPanneau = dynamic(() => import("./AjoutRepasPanneau").then((m) => m.AjoutRepasPanneau), {
  ssr: false,
});

// Précharge le panneau (et son catalogue via React Query au montage) dès le
// premier contact, pour que la feuille s'ouvre sans latence perçue.
function prechargerPanneau() {
  void import("./AjoutRepasPanneau");
}

/** « mardi 10 novembre » depuis une date ISO (UTC, sans décalage de fuseau). */
function libelleJour(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function useAjoutRepasTermine() {
  const queryClient = useQueryClient();
  return (item: CatalogueItem, moment: MomentRepas, date?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.catalogueJournal });
    queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
    // Hors d'aujourd'hui, le toast nomme le jour : le repas n'est pas parti là
    // où l'on pourrait le croire.
    const jour = date ? ` le ${libelleJour(date)}` : "";
    showToast(`« ${item.nom} » ajouté ${AJOUT_LABELS[moment]}${jour}`);
  };
}

/**
 * Bouton « Ajouter un repas » du Journal, flottant dans la zone du pouce (à
 * l'emplacement du « + » du dashboard, au-dessus de la barre du bas), et sa
 * feuille. `variante="carte"` : même action rendue en ligne (état vide).
 */
export function AjoutRepasBouton({
  date,
  variante = "flottant",
  estAujourdhui = true,
}: {
  date: string;
  variante?: "flottant" | "carte";
  /** Faux : la feuille et le toast nomment le jour de saisie. */
  estAujourdhui?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const termine = useAjoutRepasTermine();
  useBackClose(ouvert, () => setOuvert(false));

  return (
    <>
      {variante === "flottant" ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          onPointerDown={prechargerPanneau}
          onFocus={prechargerPanneau}
          aria-haspopup="dialog"
          data-masquer-saisie
          className="fixed right-[max(1rem,calc(50%-20rem))] z-40 flex h-14 items-center gap-2 rounded-full bg-kcal pl-4 pr-5 font-semibold text-on-kcal shadow-float transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 90px)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Ajouter un repas
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          onPointerDown={prechargerPanneau}
          aria-haspopup="dialog"
          className="min-h-11 rounded-2xl bg-kcal px-4 py-2.5 font-semibold text-on-kcal transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          Ajouter un repas
        </button>
      )}

      <AnimatePresence>
        {ouvert && (
          <Modal key="ajout-repas" title={estAujourdhui ? "Ajouter un repas" : `Ajouter un repas · ${libelleJour(date)}`} onClose={() => history.back()}>
            <AjoutRepasPanneau
              date={date}
              onAjoute={(item, moment) => {
                termine(item, moment, estAujourdhui ? undefined : date);
                history.back();
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
