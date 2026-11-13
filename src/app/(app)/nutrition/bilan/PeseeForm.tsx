"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { enregistrerMesure } from "@/app/actions/sante";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { nombreFr, type Mesure } from "@/lib/sante/compute";
import { errorText, input, label, primaryButton } from "@/lib/ui";

/** « 82,4 » ou « 82.4 » → 82.4 ; vide → null ; illisible → NaN (refusé par l'action). */
function lireDecimal(texte: string): number | null {
  const nettoye = texte.trim().replace(",", ".");
  return nettoye === "" ? null : Number(nettoye);
}

const MESSAGE_POIDS_ILLISIBLE = "Poids illisible : saisis un nombre entre 30 et 300 kg, avec une virgule ou un point (ex. 82,4).";
const MESSAGE_TAILLE_ILLISIBLE = "Tour de taille illisible : saisis un nombre entre 40 et 250 cm, avec une virgule ou un point (ex. 91,5).";

/**
 * Pesée en 10 secondes : poids et/ou tour de taille, daté d'aujourd'hui par
 * défaut. Le tour de taille est l'indicateur le plus direct de la graisse
 * abdominale ; le poids est lissé sur 7 jours dans la synthèse. `mesures` : les
 * derniers relevés (récents d'abord), pour les valeurs d'exemple ; leur liste
 * et la suppression vivent dans `ReleveListe`. `compact` masque la date.
 */
export function PeseeForm({ today, mesures, compact = false }: { today: string; mesures: Mesure[]; compact?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [date, setDate] = useState(today);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dernierPoids = mesures.find((m) => m.poids_kg !== null)?.poids_kg ?? null;
  const dernierTour = mesures.find((m) => m.tour_taille_cm !== null)?.tour_taille_cm ?? null;

  async function rafraichir() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.synthesesSemaine }),
      queryClient.invalidateQueries({ queryKey: queryKeys.mesuresRecentes }),
    ]);
    router.refresh();
  }

  function enregistrer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const poidsKg = lireDecimal(poids);
    const tourTailleCm = lireDecimal(taille);
    // Texte illisible (« abc », « 82,4,1 ») : dit la plage et le format attendus
    // plutôt que le message de plage de l'action, qui ne parle pas du format.
    if (poidsKg !== null && Number.isNaN(poidsKg)) return setErreur(MESSAGE_POIDS_ILLISIBLE);
    if (tourTailleCm !== null && Number.isNaN(tourTailleCm)) return setErreur(MESSAGE_TAILLE_ILLISIBLE);
    startTransition(async () => {
      const resultat = await runAction(
        () => enregistrerMesure({ date, poidsKg, tourTailleCm }),
        { silencieux: true, onError: setErreur }
      );
      if (!resultat.ok) return;
      setPoids("");
      setTaille("");
      setDate(today);
      showToast("Relevé enregistré");
      await rafraichir();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enregistrer} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pesee-poids" className={label}>
              Poids (kg)
            </label>
            <input
              id="pesee-poids"
              inputMode="decimal"
              autoComplete="off"
              value={poids}
              onChange={(e) => setPoids(e.target.value)}
              placeholder={dernierPoids !== null ? nombreFr(dernierPoids, 1) : "82,4"}
              className={`${input} min-h-11 tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pesee-taille" className={label}>
              Tour de taille (cm)
            </label>
            <input
              id="pesee-taille"
              inputMode="decimal"
              autoComplete="off"
              value={taille}
              onChange={(e) => setTaille(e.target.value)}
              placeholder={dernierTour !== null ? nombreFr(dernierTour, 1) : "91,0"}
              className={`${input} min-h-11 tabular-nums`}
            />
          </div>
        </div>
        {!compact && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pesee-date" className={label}>
              Date du relevé
            </label>
            <input
              id="pesee-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
              className={`${input} min-h-11 w-44`}
            />
          </div>
        )}
        {erreur && (
          <p role="alert" className={errorText}>
            {erreur}
          </p>
        )}
        <button type="submit" disabled={pending || (poids.trim() === "" && taille.trim() === "")} className={`${primaryButton} self-start`}>
          Enregistrer
        </button>
      </form>

    </div>
  );
}
