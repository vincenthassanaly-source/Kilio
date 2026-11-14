"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getCoursesItems } from "@/app/actions/courses";
import { creerAttributeurDeCles } from "@/lib/courses/cles-affichage";
import { queryKeys } from "@/lib/query/keys";
import { eyebrow, sectionTitle } from "@/lib/ui";
import { CheckIcon } from "@/components/icons";
import { PanierIcon } from "./CoursesIcons";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { compterProgression, grouperItemsCourses, grouperParRayon } from "@/lib/courses/compute";
import { CourseItemRow } from "./CourseItemRow";
import { ArchivedCoursesSection } from "./ArchivedCoursesSection";
import { ErrorInline } from "@/components/ErrorInline";

export function CoursesList() {
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.courses,
    queryFn: getCoursesItems,
  });
  // La ligne confirmée par le serveur reprend la clé de sa ligne optimiste (id
  // `temp-…`) : sans cela React la remonte et l'article s'affiche deux fois le
  // temps de l'animation de sortie.
  const [cleAffichage] = useState(creerAttributeurDeCles);

  if (isLoading) return <ListItemSkeletonGroup count={4} />;
  // Un rechargement qui échoue (réseau instable en magasin) garde les articles
  // déjà chargés : l'erreur ne remplace la liste que s'il n'y a rien à montrer.
  if (isError && !items) return <ErrorInline message="Impossible de charger les courses." retry={() => refetch()} />;
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control-border px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-2">
          <PanierIcon size={24} />
        </span>
        <div className="flex flex-col gap-1">
          <p className={sectionTitle}>Aucun article pour l&apos;instant.</p>
          <p className="text-small text-ink-2 text-pretty">
            Ajoutez-en un ci-dessus, ou plusieurs d&apos;un coup : lait, œufs, pain.
          </p>
        </div>
      </div>
    );
  }

  const { actifs, archives } = grouperItemsCourses(items);
  const progression = compterProgression(items);
  const sectionsRayon = grouperParRayon(actifs);

  return (
    <div className="flex flex-col gap-2.5">
      {actifs.length > 0 && (
        <>
          <p className="px-1 text-small font-medium tabular-nums text-ink-2">
            {progression.actifs} article{progression.actifs > 1 ? "s" : ""} à prendre
          </p>
          <div className="flex flex-col gap-5">
            <AnimatePresence initial={false}>
            {sectionsRayon.map((section, index) => (
              <motion.div
                key={section.rayon}
                layout
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <h2 id={`rayon-titre-${index}`} className={`min-w-0 text-balance ${eyebrow}`}>{section.rayon}</h2>
                  <span aria-hidden className="text-caption font-medium tabular-nums text-ink-3">
                    {section.items.length}
                  </span>
                </div>
                {/* Un rayon = une carte : les lignes se séparent par un filet,
                    plus une carte de 70 px par article. */}
                <ul
                  aria-labelledby={`rayon-titre-${index}`}
                  className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface py-1 shadow-card"
                >
                  <AnimatePresence initial={false}>
                    {section.items.map((item) => (
                      <CourseItemRow key={cleAffichage(item)} item={item} groupe />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        </>
      )}
      {progression.tousCoches && (
        <p className="flex items-center gap-2.5 rounded-row bg-kcal-soft px-3.5 py-3 text-label font-semibold text-ink">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-kcal text-on-kcal">
            <CheckIcon size={14} />
          </span>
          Tout est dans le chariot !
        </p>
      )}
      <ArchivedCoursesSection items={archives} />
    </div>
  );
}
