"use client";

import type { ReactNode } from "react";
import { titreBlocClasse } from "@/lib/ui";
import { useReferentielPharmacie } from "@/lib/pharmacie/useReferentielPharmacie";
import type { PharmaRefSnapshot } from "@/lib/pharmacie/referentiel";
import { PharmacieSkeleton } from "../EtatSnapshot";
import { ContenuColore } from "../ContenuColore";
import { ErrorInline } from "@/components/ErrorInline";

// Coquille commune aux écrans du référentiel : chargement, erreur, puis rendu
// avec l'instantané (jamais de rendu partiel).
export function AvecReferentiel({ children }: { children: (snapshot: PharmaRefSnapshot) => ReactNode }) {
  const { data, isLoading, isError, refetch } = useReferentielPharmacie();

  if (isLoading) return <PharmacieSkeleton />;
  if (isError || !data) {
    return <ErrorInline message="Impossible de charger le référentiel. Vérifie ta connexion." retry={() => refetch()} />;
  }
  return <>{children(data)}</>;
}

/** Bloc de texte titré d'une fiche (mécanisme, contre-indications, interactions, conseils…).
 * Le titre prend la teinte `--classe` de l'ancêtre (voir `styleClasse`). */
export function BlocInfo({ titre, texte }: { titre: string; texte: string | null | undefined }) {
  if (!texte) return null;
  return (
    <section className="flex flex-col gap-1" aria-label={titre}>
      <h2 className={titreBlocClasse}>{titre}</h2>
      <ContenuColore contenu={texte} titresSections />
    </section>
  );
}
