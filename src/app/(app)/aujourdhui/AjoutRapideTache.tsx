"use client";

import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createTache, getListes } from "@/app/actions/taches";
import { showToast } from "@/components/toast/toast-store";
import { queryKeys } from "@/lib/query/keys";
import { DUREE_TOAST_AVERTISSEMENT_MS } from "@/lib/taches/compute";

// Pastille « Heure » : 36 px visibles, zone de tap étendue à 44 px.
const pastille =
  "relative min-h-9 shrink-0 rounded-full border px-3 text-[12.5px] font-semibold tabular-nums transition-colors active:scale-[0.97] after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

const MESSAGE_ECHEC = "Impossible d'ajouter la tâche. Réessaie.";

/**
 * Ajout rapide d'une tâche pour aujourd'hui : un titre, Entrée, et une heure
 * facultative derrière la pastille « Heure ». La tâche va dans la première
 * liste, comme dans le formulaire complet. En cas d'échec, le texte saisi est
 * conservé pour pouvoir réessayer.
 */
export function AjoutRapideTache({
  today,
  onCreated,
}: {
  today: string;
  // Appelé une fois la tâche visible dans la liste (données rafraîchies).
  onCreated: (id: string) => void;
}) {
  const uid = useId();
  const queryClient = useQueryClient();
  const titreRef = useRef<HTMLInputElement>(null);
  const [titre, setTitre] = useState("");
  const [heure, setHeure] = useState("");
  const [heureOuverte, setHeureOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const { data: listes = [] } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enCours) return;
    const titreNet = titre.trim();
    if (!titreNet) {
      titreRef.current?.focus();
      return;
    }
    const listeId = listes[0]?.id;
    if (!listeId) {
      showToast("Crée d'abord une liste de tâches.", undefined, "error");
      return;
    }

    const formData = new FormData();
    formData.set("titre", titreNet);
    formData.set("echeance", today);
    formData.set("liste_id", listeId);
    if (heure) formData.set("heure", heure);

    setEnCours(true);
    try {
      const resultat = await createTache({ error: null }, formData);
      if (resultat.error || !resultat.id) {
        showToast(resultat.error ?? MESSAGE_ECHEC, undefined, "error");
        return;
      }
      if (resultat.avertissement) showToast(resultat.avertissement, DUREE_TOAST_AVERTISSEMENT_MS);
      setTitre("");
      setHeure("");
      setHeureOuverte(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.taches });
      onCreated(resultat.id);
    } catch {
      showToast(MESSAGE_ECHEC, undefined, "error");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" aria-label="Ajouter une tâche à aujourd'hui">
      <div className="flex items-center gap-2">
        <label htmlFor={`${uid}-titre`} className="sr-only">
          Nouvelle tâche pour aujourd&apos;hui
        </label>
        <input
          ref={titreRef}
          id={`${uid}-titre`}
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ajouter une tâche…"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={200}
          className="min-h-11 min-w-0 flex-1 rounded-2xl border border-line bg-surface-alt px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-2 focus:border-kcal/60 focus-visible:ring-2 focus-visible:ring-kcal"
        />
        <button
          type="button"
          aria-expanded={heureOuverte}
          aria-controls={`${uid}-heure`}
          onClick={() => setHeureOuverte((o) => !o)}
          className={`${pastille} ${
            heure ? "border-kcal/60 bg-kcal-soft text-ink" : "border-line bg-surface-alt text-ink"
          }`}
        >
          {heure || "Heure"}
        </button>
        <button
          type="submit"
          disabled={enCours || titre.trim() === ""}
          className="min-h-11 shrink-0 rounded-2xl bg-kcal px-4 text-[14px] font-semibold text-on-kcal transition-[opacity,transform] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          Ajouter
        </button>
      </div>

      {heureOuverte && (
        <div id={`${uid}-heure`} className="flex items-center gap-2">
          <label htmlFor={`${uid}-heure-champ`} className="text-[13px] font-medium text-ink-2">
            Heure
          </label>
          <input
            id={`${uid}-heure-champ`}
            type="time"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
            className="min-h-11 rounded-2xl border border-line bg-surface-alt px-3.5 text-base tabular-nums text-ink outline-none transition-colors focus:border-kcal/60 focus-visible:ring-2 focus-visible:ring-kcal"
          />
          {heure && (
            <button
              type="button"
              onClick={() => setHeure("")}
              className="relative min-h-9 text-[13px] font-semibold text-ink-2 after:absolute after:-inset-y-1 after:-inset-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
            >
              Retirer l&apos;heure
            </button>
          )}
        </div>
      )}
    </form>
  );
}
