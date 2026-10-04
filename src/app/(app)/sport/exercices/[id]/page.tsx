"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getExercice } from "@/app/actions/sport";
import { queryKeys } from "@/lib/query/keys";
import { TransitionLink } from "@/components/TransitionLink";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { card, errorText, linkButton, metaText, pillTag, screenTitle, sectionTitle } from "@/lib/ui";
import { libelleCategorie, libelleEquipement, libelleMuscle, libelleNiveau } from "@/lib/sport/libelles";
import { ExerciceMedia } from "./ExerciceMedia";

// Shell client (même patron que /objectifs/[id]) : la fiche est lue via
// TanStack Query, la navigation reste instantanée.
export default function ExerciceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: exercice, isLoading, isError } = useQuery({
    queryKey: queryKeys.sportExercice(id),
    queryFn: () => getExercice(decodeURIComponent(id)),
    staleTime: 5 * 60_000,
  });

  const retour = (
    <TransitionLink href="/sport/exercices" className={`${linkButton} self-start`}>
      ‹ Exercices
    </TransitionLink>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {retour}
        <Skeleton className="aspect-[3/2] w-full rounded-[22px]" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (isError || !exercice) {
    return (
      <div className="flex flex-col gap-3">
        {retour}
        <p className={errorText}>{isError ? "Erreur de chargement de l'exercice." : "Exercice introuvable."}</p>
      </div>
    );
  }

  const niveau = libelleNiveau(exercice.niveau);
  const instructions = exercice.instructions_fr.filter((etape) => etape.trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      {retour}
      <ExerciceMedia urls={exercice.images.map((chemin) => `${exercice.urlImages}/${chemin}`)} alt={exercice.nom_fr} />

      <div className="flex flex-col gap-1">
        <h1 className={screenTitle}>{exercice.nom_fr}</h1>
        {exercice.nom_en !== exercice.nom_fr && <p className={metaText}>{exercice.nom_en}</p>}
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Caractéristiques">
        <li className={pillTag}>{libelleMuscle(exercice.muscle_principal)}</li>
        {exercice.muscles_secondaires.map((muscle) => (
          <li key={muscle} className={`${pillTag} opacity-80`}>
            {libelleMuscle(muscle)}
          </li>
        ))}
        <li className={pillTag}>{libelleEquipement(exercice.equipement)}</li>
        {niveau && <li className={pillTag}>{niveau}</li>}
        <li className={pillTag}>{libelleCategorie(exercice.categorie)}</li>
      </ul>

      {instructions.length > 0 && (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={sectionTitle}>Exécution</h2>
          <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14.5px] leading-[1.45] text-ink marker:font-semibold marker:text-ink-2">
            {instructions.map((etape, index) => (
              <li key={index}>{etape}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
