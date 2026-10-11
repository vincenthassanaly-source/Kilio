"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  if (brouillon === undefined) return null;

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
      <p className={eyebrow}>
        {catalogueVide
          ? "Le catalogue d'exercices est vide : tu pourras démarrer une séance dès qu'il sera ajouté."
          : "Ajoute tes exercices au fil de l'entraînement, le minuteur de repos se lance à chaque série."}
      </p>
      <button
        type="button"
        className={`${primaryButton} self-start`}
        onClick={demarrer}
        disabled={catalogueVide || demarrage}
      >
        Démarrer une séance
      </button>
    </section>
  );
}
