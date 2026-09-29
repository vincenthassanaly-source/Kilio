"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteListe, reordonnerListes } from "@/app/actions/taches";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, ghostButton, listCard, nameText } from "@/lib/ui";

// Flèches d'ordre : cible réelle de 36×44 px (même gabarit que `sousTacheBouton`
// de TasksList) au lieu du glyphe nu de 13×23 px.
const flecheOrdre =
  "flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-base text-ink-2 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";
import { confirmDelete } from "@/lib/confirm";
import { libelleNombreTaches, messageSuppressionListe } from "@/lib/taches/compute";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import { isNetworkError } from "@/lib/offline/queue";
import { AddListeForm } from "./AddListeForm";
import { runAction } from "@/lib/actions/runAction";

type CompteTaches = { total: number; faites: number };

function ListeRow({
  liste,
  index,
  total,
  compte,
}: {
  liste: Tables<"listes_taches">;
  index: number;
  total: number;
  compte: CompteTaches;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  if (editing) {
    return (
      <li className={listCard}>
        <AddListeForm liste={liste} onDone={() => setEditing(false)} />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-2 text-sm text-ink-2 underline"
        >
          Annuler
        </button>
      </li>
    );
  }

  // Supprimer une liste supprime aussi TOUTES ses tâches (faites ou non),
  // leurs sous-tâches et leurs images : la confirmation annonce le nombre
  // exact. Le compte affiché peut être périmé (page chargée avant un ajout
  // ou une suppression ailleurs) : il est transmis au serveur comme total
  // attendu ; s'il ne correspond plus, rien n'est supprimé et le serveur
  // renvoie les chiffres réels pour une nouvelle confirmation.
  function handleDelete() {
    if (!confirmDelete(messageSuppressionListe(liste.nom, compte.total, compte.faites))) return;
    setError(null);
    startTransition(async () => {
      try {
        let resultat = await deleteListe(liste.id, compte.total > 0, compte.total);

        if (resultat.confirmation) {
          const reel = resultat.confirmation;
          if (!confirmDelete(messageSuppressionListe(liste.nom, reel.total, reel.faites))) return;
          resultat = await deleteListe(liste.id, true, reel.total);
          if (resultat.confirmation) {
            setError("Le contenu de la liste vient encore de changer : rien n'a été supprimé. Réessaie.");
            return;
          }
        }

        if (resultat.error) {
          setError(resultat.error);
          return;
        }

        // /taches lit ses données via TanStack Query (30 s de fraîcheur) :
        // sans invalidation, la liste et ses tâches y resteraient affichées.
        queryClient.invalidateQueries({ queryKey: queryKeys.taches });
        queryClient.invalidateQueries({ queryKey: queryKeys.listes });
        showToast("Liste supprimée");
      } catch (err) {
        setError(
          isNetworkError(err)
            ? "Connexion impossible : la liste n'a pas été supprimée. Vérifie ta connexion et réessaie."
            : "Une erreur est survenue : la liste n'a peut-être pas été supprimée. Réessaie."
        );
      }
    });
  }

  return (
    <li className={`${listCard} gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {liste.couleur && (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: liste.couleur }}
            />
          )}
          <div className="flex min-w-0 flex-col">
            <p className={nameText}>{liste.nom}</p>
            <span className="text-xs text-ink-2">{libelleNombreTaches(compte.total)}</span>
          </div>
        </div>
        <div className="flex">
          <button
            type="button"
            disabled={isPending || index === 0}
            onClick={() => startTransition(async () => void (await runAction(() => reordonnerListes(liste.id, "haut"))))}
            className={flecheOrdre}
            aria-label="Monter"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isPending || index === total - 1}
            onClick={() => startTransition(async () => void (await runAction(() => reordonnerListes(liste.id, "bas"))))}
            className={flecheOrdre}
            aria-label="Descendre"
          >
            ↓
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
          Modifier
        </button>
        {liste.nom !== "Général" && (
          <button type="button" disabled={isPending} onClick={handleDelete} className={dangerButton}>
            Suppr.
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function ListesManager({
  listes,
  comptes,
}: {
  listes: Tables<"listes_taches">[];
  comptes: Record<string, CompteTaches>;
}) {
  if (listes.length === 0) {
    return <p className="text-ink-2">Aucune liste pour l&apos;instant.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {listes.map((liste, index) => (
        <ListeRow
          key={liste.id}
          liste={liste}
          index={index}
          total={listes.length}
          compte={comptes[liste.id] ?? { total: 0, faites: 0 }}
        />
      ))}
    </ul>
  );
}
