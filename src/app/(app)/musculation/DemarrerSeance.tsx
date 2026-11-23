"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showErrorToast } from "@/components/toast/toast-store";
import { demarrerSeanceVide } from "@/lib/musculation/demarrer";
import { compterSeries } from "@/lib/musculation/seance";
import { useBrouillonEnCours } from "@/lib/musculation/useBrouillonEnCours";
import { card, eyebrow, primaryButton, sectionTitle } from "@/lib/ui";

/**
 * Entrée du module : reprendre la séance en cours (stockée sur le téléphone)
 * ou en démarrer une libre. Sans exercice au catalogue, impossible de saisir
 * quoi que ce soit : le bouton explique pourquoi plutôt que de mener à un écran vide.
 */
export function DemarrerSeance({ catalogueVide }: { catalogueVide: boolean }) {
  const router = useRouter();
  const brouillon = useBrouillonEnCours();
  const [demarrage, setDemarrage] = useState(false);

  // Même hauteur que la carte : la liste des routines ne saute pas quand la lecture locale aboutit.
  if (brouillon === undefined) return <Skeleton className="h-40 w-full rounded-card" />;

  if (brouillon) {
    const { faites, total } = compterSeries(brouillon);
    return (
      <section className={`${card} flex flex-col gap-3`} aria-label="Séance en cours">
        <div className="flex flex-col gap-0.5">
          <h2 className={sectionTitle}>Séance en cours</h2>
          <p className={eyebrow}>
            {brouillon.nom} · {faites}/{total} séries
          </p>
        </div>
        <button type="button" className={`${primaryButton} self-start`} onClick={() => router.push("/musculation/seance")}>
          Reprendre
        </button>
      </section>
    );
  }

  async function demarrer() {
    setDemarrage(true);
    try {
      await demarrerSeanceVide();
      router.push("/musculation/seance");
    } catch {
      setDemarrage(false);
      showErrorToast("Impossible de démarrer la séance sur ce téléphone.");
    }
  }

  return (
    <section className={`${card} flex flex-col gap-3`} aria-label="Démarrer une séance">
      <h2 className={sectionTitle}>Séance libre</h2>
      <p id="demarrer-seance-aide" className={eyebrow}>
        {catalogueVide
          ? "Aucun exercice au catalogue pour l'instant : dès qu'il sera ajouté, tu pourras démarrer une séance, créer des routines et suivre ta progression."
          : "Ajoute tes exercices au fil de l'entraînement, le minuteur de repos se lance à chaque série."}
      </p>
      <button
        type="button"
        // Catalogue vide : bouton neutre bien contrasté plutôt qu'un vert d'action délavé.
        className={`${primaryButton} self-start ${catalogueVide ? "!bg-surface-alt !text-ink-2 disabled:!opacity-100" : ""}`}
        onClick={demarrer}
        disabled={catalogueVide || demarrage}
        aria-describedby={catalogueVide ? "demarrer-seance-aide" : undefined}
      >
        Démarrer une séance
      </button>
    </section>
  );
}
