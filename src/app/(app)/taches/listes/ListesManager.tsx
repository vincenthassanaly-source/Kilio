"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteListe, reordonnerListes } from "@/app/actions/taches";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, ghostButton, listCard, nameText } from "@/lib/ui";

// Flèches d'ordre : cible réelle de 36×44 px (même gabarit que `sousTacheBouton`
// de TasksList) au lieu du glyphe nu de 13×23 px.
const flecheOrdre =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";
import { libelleNombreTaches } from "@/lib/taches/compute";
import { queryKeys } from "@/lib/query/keys";
import { AddListeForm } from "./AddListeForm";
import { IconeDescendre, IconeMonter } from "../iconesOrdre";
import { runAction } from "@/lib/actions/runAction";
import { fail, ok } from "@/lib/actions/result";
import { useMasques } from "@/lib/actions/elementsMasques";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";

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
  const queryClient = useQueryClient();

  if (editing) {
    return (
      <li className={listCard}>
        <AddListeForm liste={liste} onDone={() => setEditing(false)} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-label text-ink-2 underline">
            Annuler
          </button>
          {/* La suppression vit ici, hors de la ligne : plus de bouton rouge
              sous le pouce à côté de « Modifier ». */}
          {liste.nom !== "Général" && (
            <button type="button" onClick={handleDelete} className={dangerButton}>
              Supprimer la liste
            </button>
          )}
        </div>
      </li>
    );
  }

  function reordonner(sens: "haut" | "bas") {
    startTransition(async () => {
      await runAction(() => reordonnerListes(liste.id, sens));
      queryClient.invalidateQueries({ queryKey: queryKeys.listes });
    });
  }

  // Supprimer une liste supprime aussi TOUTES ses tâches (faites ou non), leurs
  // sous-tâches et leurs images. Suppression différée : la liste disparaît tout de
  // suite, le toast annonce le nombre de tâches emportées, « Annuler » ramène la
  // liste (et ses tâches, intactes) pendant le délai. Le compte affiché peut être
  // périmé (page chargée avant un ajout ailleurs) : il part au serveur comme total
  // attendu ; s'il ne correspond plus à l'expiration du délai, rien n'est supprimé,
  // la liste revient et un message l'explique (le serveur garde ce garde-fou).
  function handleDelete() {
    const taches = compte.total === 0 ? "" : compte.total === 1 ? " avec sa tâche" : ` avec ses ${compte.total} tâches`;
    supprimerAvecAnnulation({
      texte: `Liste « ${liste.nom} » supprimée${taches}`,
      ariaLabel: `Annuler la suppression de la liste « ${liste.nom} »`,
      masque: { type: "liste-taches", id: liste.id },
      masquer: () => setEditing(false),
      supprimer: async () => {
        const resultat = await deleteListe(liste.id, compte.total > 0, compte.total);
        if (resultat.confirmation) {
          return fail("Le contenu de la liste vient de changer : rien n'a été supprimé. Réessaie.");
        }
        return resultat.error ? fail(resultat.error) : ok();
      },
      erreur: `Impossible de supprimer la liste « ${liste.nom} ». Réessaie.`,
      // /taches lit ses données via TanStack Query (30 s de fraîcheur) :
      // sans invalidation, la liste et ses tâches y resteraient affichées.
      onSupprime: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.taches });
        queryClient.invalidateQueries({ queryKey: queryKeys.listes });
      },
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
              aria-hidden="true"
            />
          )}
          <div className="flex min-w-0 flex-col">
            <p className={nameText}>{liste.nom}</p>
            <span className="text-caption text-ink-2">{libelleNombreTaches(compte.total)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            disabled={isPending || index === 0}
            onClick={() => reordonner("haut")}
            className={flecheOrdre}
            aria-label="Monter"
          >
            <IconeMonter />
          </button>
          <button
            type="button"
            disabled={isPending || index === total - 1}
            onClick={() => reordonner("bas")}
            className={flecheOrdre}
            aria-label="Descendre"
          >
            <IconeDescendre />
          </button>
          <button type="button" onClick={() => setEditing(true)} className={`${ghostButton} ml-1`}>
            Modifier
          </button>
        </div>
      </div>
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
  // Listes en cours de suppression (toast « Annuler » encore affiché) : cachées.
  const masquees = useMasques("liste-taches");
  const visibles = listes.filter((l) => !masquees.has(l.id));
  if (visibles.length === 0) {
    return <p className="text-ink-2">Aucune liste pour l&apos;instant.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {visibles.map((liste, index) => (
        <ListeRow
          key={liste.id}
          liste={liste}
          index={index}
          total={visibles.length}
          compte={comptes[liste.id] ?? { total: 0, faites: 0 }}
        />
      ))}
    </ul>
  );
}
