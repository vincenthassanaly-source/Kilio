"use client";

import { useQuery } from "@tanstack/react-query";
import { getExercice } from "@/app/actions/sport";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { queryKeys } from "@/lib/query/keys";
import { libelleEquipement, libelleMuscle, libelleNiveau, URL_IMAGES_SPORT } from "@/lib/sport/libelles";
import type { ExerciceBrouillon } from "@/lib/sport/seance";
import { errorText, metaText, pillTag, sectionTitle } from "@/lib/ui";
import { IllustrationExercice } from "../IllustrationExercice";

/**
 * Aperçu d'un exercice pendant la séance (feuille du bas). Même source que la
 * fiche /sport/exercices/[id] ; sans réseau et hors cache, on retombe sur
 * l'image et le nom déjà présents dans la séance.
 */
export function ApercuExercice({ exercice, onClose }: { exercice: ExerciceBrouillon; onClose: () => void }) {
  const { data, isError, fetchStatus } = useQuery({
    queryKey: queryKeys.sportExercice(exercice.exerciceId),
    queryFn: () => getExercice(exercice.exerciceId),
    staleTime: 5 * 60_000,
  });

  const horsLigne = !data && (isError || fetchStatus === "paused");
  const instructions = data?.instructions_fr.filter((etape) => etape.trim().length > 0) ?? [];
  const niveau = data ? libelleNiveau(data.niveau) : null;

  return (
    <Modal title={exercice.nom} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {data ? (
          <>
            <IllustrationExercice
              poses={data.poses}
              photos={data.images.map((chemin) => `${data.urlImages}/${chemin}`)}
              muscle={data.muscle_principal}
              alt={data.nom_fr}
            />
            <ul className="flex flex-wrap gap-2" aria-label="Caractéristiques">
              <li className={pillTag}>{libelleMuscle(data.muscle_principal)}</li>
              {data.muscles_secondaires.map((muscle) => (
                <li key={muscle} className={`${pillTag} opacity-80`}>
                  {libelleMuscle(muscle)}
                </li>
              ))}
              <li className={pillTag}>{libelleEquipement(data.equipement)}</li>
              {niveau && <li className={pillTag}>{niveau}</li>}
            </ul>
            {instructions.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className={sectionTitle}>Exécution</h3>
                <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14.5px] leading-[1.45] text-ink marker:font-semibold marker:text-ink-2">
                  {instructions.map((etape, index) => (
                    <li key={index}>{etape}</li>
                  ))}
                </ol>
              </section>
            )}
          </>
        ) : horsLigne ? (
          <>
            <IllustrationExercice
              poses={exercice.poses}
              photos={exercice.image ? [`${URL_IMAGES_SPORT}/${exercice.image}`] : []}
              alt={exercice.nom}
            />
            <p className={isError ? errorText : metaText}>Détails indisponibles hors ligne.</p>
          </>
        ) : (
          <>
            <Skeleton className="aspect-[3/2] w-full rounded-[22px]" />
            <Skeleton className="h-4 w-1/2" />
          </>
        )}
      </div>
    </Modal>
  );
}
