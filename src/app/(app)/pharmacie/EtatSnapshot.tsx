"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { card, screenTitle } from "@/lib/ui";
import { useSnapshotPharmacie } from "@/lib/pharmacie/useSnapshotPharmacie";
import type { PharmaSnapshot } from "@/lib/pharmacie/types";
import { ErrorInline } from "@/components/ErrorInline";

/** `recherche` : l'écran n'a pas encore rendu son champ de recherche (chargement
 * de la route), le squelette en garde la place. Sous un champ déjà affiché
 * (coquilles `Avec…`), il ne le double pas. */
export function PharmacieSkeleton({ recherche = false }: { recherche?: boolean }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {recherche && <Skeleton className="h-[46px] w-full rounded-2xl" />}
      <Skeleton className="h-28 w-full rounded-hero" />
      <Skeleton className="h-20 w-full rounded-row" />
      <Skeleton className="h-20 w-full rounded-row" />
    </div>
  );
}

// Coquille commune aux écrans du module : chargement, erreur, puis rendu du
// contenu avec l'instantané (jamais de rendu partiel).
export function AvecSnapshot({ children }: { children: (snapshot: PharmaSnapshot) => ReactNode }) {
  const { data, isLoading, isError, refetch } = useSnapshotPharmacie();

  if (isLoading) return <PharmacieSkeleton />;
  if (isError || !data) {
    return <ErrorInline message="Impossible de charger la Pharmacie. Vérifie ta connexion." retry={() => refetch()} />;
  }
  return <>{children(data)}</>;
}

/** Carte d'état vide ou « introuvable ». `titre` ajoute le `<h1>` de la page
 * quand elle remplace un écran de détail (sans lui, la page n'aurait aucun titre). */
export function IntrouvableCarte({ message, titre }: { message: string; titre?: string }) {
  return (
    <>
      {titre && <h1 className={screenTitle}>{titre}</h1>}
      <div className={`${card} text-body text-ink-2`} role="status">
        {message}
      </div>
    </>
  );
}
