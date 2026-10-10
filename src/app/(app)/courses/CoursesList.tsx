"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { getCoursesItems } from "@/app/actions/courses";
import { creerAttributeurDeCles } from "@/lib/courses/cles-affichage";
import { queryKeys } from "@/lib/query/keys";
import { errorText, eyebrow } from "@/lib/ui";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { compterProgression, grouperItemsCourses, grouperParRayon } from "@/lib/courses/compute";
import { CourseItemRow } from "./CourseItemRow";
import { ArchivedCoursesSection } from "./ArchivedCoursesSection";

export function CoursesList() {
  const { data: items, isLoading, isError } = useQuery({
    queryKey: queryKeys.courses,
    queryFn: getCoursesItems,
  });
  // La ligne confirmée par le serveur reprend la clé de sa ligne optimiste (id
  // `temp-…`) : sans cela React la remonte et l'article s'affiche deux fois le
  // temps de l'animation de sortie.
  const [cleAffichage] = useState(creerAttributeurDeCles);

  if (isLoading) return <ListItemSkeletonGroup count={4} />;
  if (isError) return <p className={errorText}>Erreur de chargement des courses. Réessaie.</p>;
  if (!items || items.length === 0) {
    return <p className="text-ink-2">Aucun article pour l&apos;instant.</p>;
  }

  const { actifs, archives } = grouperItemsCourses(items);
  const progression = compterProgression(items);
  const sectionsRayon = grouperParRayon(actifs);

  return (
    <div className="flex flex-col gap-2.5">
      {actifs.length > 0 && (
        <>
          <p className="px-1 text-xs text-ink-2">
            {progression.actifs} article{progression.actifs > 1 ? "s" : ""} à prendre
          </p>
          <div className="flex flex-col gap-4">
            {sectionsRayon.map((section) => (
              <div key={section.rayon} className="flex flex-col gap-2.5">
                <p className={`px-1 ${eyebrow}`}>{section.rayon}</p>
                <ul className="flex flex-col gap-2.5">
                  <AnimatePresence initial={false}>
                    {section.items.map((item) => (
                      <CourseItemRow key={cleAffichage(item)} item={item} />
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
      {progression.tousCoches && <p className="px-1 text-ink-2">Tout est dans le chariot !</p>}
      <ArchivedCoursesSection items={archives} />
    </div>
  );
}
