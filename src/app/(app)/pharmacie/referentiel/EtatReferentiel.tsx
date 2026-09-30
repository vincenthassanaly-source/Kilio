"use client";

import type { ReactNode } from "react";
import { errorText } from "@/lib/ui";
import { useReferentielPharmacie } from "@/lib/pharmacie/useReferentielPharmacie";
import type { PharmaRefSnapshot } from "@/lib/pharmacie/referentiel";
import { PharmacieSkeleton } from "../EtatSnapshot";

// Coquille commune aux écrans du référentiel : chargement, erreur, puis rendu
// avec l'instantané (jamais de rendu partiel).
export function AvecReferentiel({ children }: { children: (snapshot: PharmaRefSnapshot) => ReactNode }) {
  const { data, isLoading, isError } = useReferentielPharmacie();

  if (isLoading) return <PharmacieSkeleton />;
  if (isError || !data) {
    return <p className={errorText}>Impossible de charger le référentiel. Réessaie une fois en ligne.</p>;
  }
  return <>{children(data)}</>;
}

/** Bloc de texte titré d'une fiche (mécanisme, contre-indications, interactions, conseils…). */
export function BlocInfo({ titre, texte }: { titre: string; texte: string | null | undefined }) {
  if (!texte) return null;
  return (
    <section className="flex flex-col gap-1" aria-label={titre}>
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{titre}</h2>
      <p className="whitespace-pre-line text-[14.5px] leading-[1.55] text-ink">{texte}</p>
    </section>
  );
}
