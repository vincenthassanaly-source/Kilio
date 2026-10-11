"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { enregistrerMesure, supprimerMesure } from "@/app/actions/sante";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { confirmDelete } from "@/lib/confirm";
import { queryKeys } from "@/lib/query/keys";
import { nombreFr, type Mesure } from "@/lib/sante/compute";
import { errorText, ghostButton, input, label, primaryButton } from "@/lib/ui";

/** « 82,4 » ou « 82.4 » → 82.4 ; vide → null ; illisible → NaN (refusé par l'action). */
function lireDecimal(texte: string): number | null {
  const nettoye = texte.trim().replace(",", ".");
  return nettoye === "" ? null : Number(nettoye);
}

const libelleDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function resume(mesure: Mesure): string {
  const morceaux: string[] = [];
  if (mesure.poids_kg !== null) morceaux.push(`${nombreFr(mesure.poids_kg, 1)} kg`);
  if (mesure.tour_taille_cm !== null) morceaux.push(`${nombreFr(mesure.tour_taille_cm, 1)} cm`);
  return morceaux.join(" · ");
}

/**
 * Pesée en 10 secondes : poids et/ou tour de taille, daté d'aujourd'hui par
 * défaut. Le tour de taille est l'indicateur le plus direct de la graisse
 * abdominale ; le poids est lissé sur 7 jours dans la synthèse. `mesures` : les
 * derniers relevés (récents d'abord), affichés avec un bouton de suppression
 * sauf en mode `compact`.
 */
export function PeseeForm({ today, mesures, compact = false }: { today: string; mesures: Mesure[]; compact?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [date, setDate] = useState(today);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dernier = mesures[0];
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
    startTransition(async () => {
      const resultat = await runAction(
        () => enregistrerMesure({ date, poidsKg: lireDecimal(poids), tourTailleCm: lireDecimal(taille) }),
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

  function supprimer(mesure: Mesure) {
    if (!confirmDelete(`Supprimer le relevé du ${libelleDate(mesure.date)} ?`)) return;
    startTransition(async () => {
      const resultat = await runAction(() => supprimerMesure(mesure.date));
      if (!resultat.ok) return;
      showToast("Relevé supprimé");
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

      {!compact && dernier && (
        <ul className="flex flex-col divide-y divide-line" aria-label="Derniers relevés">
          {mesures.map((mesure) => (
            <li key={mesure.date} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[14px] font-medium capitalize text-ink">{libelleDate(mesure.date)}</p>
                <p className="text-[12.5px] tabular-nums text-ink-2">{resume(mesure)}</p>
              </div>
              <button
                type="button"
                onClick={() => supprimer(mesure)}
                disabled={pending}
                aria-label={`Supprimer le relevé du ${libelleDate(mesure.date)}`}
                className={`${ghostButton} text-alert`}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
