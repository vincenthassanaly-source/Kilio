"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Idee } from "@/app/actions/opinions";
import { getPartis, getPriorites } from "@/app/actions/opinions-partis";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { classerPartis, libelleParti, moyennesParAxe, type Marqueur } from "@/lib/opinions/partis";
import { calculerProfil } from "@/lib/opinions/profil";
import { AXES, type AxeId } from "@/lib/opinions/types";
import { queryKeys } from "@/lib/query/keys";
import { addCard, addCardIcon, card, errorText, sectionTitle } from "@/lib/ui";
import { ClassementProximite } from "./ClassementProximite";
import { MarqueursAxes } from "./MarqueursAxes";
import { PartiCard } from "./PartiCard";
import { PartiFormModal } from "./PartisForms";

export function PartisView({ idees }: { idees: readonly Idee[] }) {
  const queryClient = useQueryClient();
  const [ajout, setAjout] = useState(false);
  const partis = useQuery({ queryKey: queryKeys.opinionsPartis, queryFn: getPartis });
  const priorites = useQuery({ queryKey: queryKeys.opinionsPriorites, queryFn: getPriorites });

  const classement = useMemo(
    () => (partis.data ? classerPartis(partis.data, idees, priorites.data ?? {}) : []),
    [partis.data, idees, priorites.data]
  );
  const profil = useMemo(() => calculerProfil(idees), [idees]);
  const aDesIdees = profil.some((p) => p.nombre > 0);

  const parAxe = useMemo(() => {
    const marqueursParAxe = {} as Record<AxeId, Marqueur[]>;
    for (const axe of AXES) {
      const marqueurs: Marqueur[] = [];
      const miennes = profil.find((p) => p.axe.id === axe.id);
      if (miennes && miennes.moyenne !== null) {
        marqueurs.push({ id: "moi", libelle: "Moi", valeur: miennes.moyenne, moi: true });
      }
      for (const { parti, programme } of classement) {
        if (!programme) continue;
        const moyenne = moyennesParAxe(programme.propositions).find((p) => p.axe.id === axe.id)?.moyenne ?? null;
        if (moyenne !== null) marqueurs.push({ id: parti.id, libelle: libelleParti(parti), valeur: moyenne });
      }
      marqueursParAxe[axe.id] = marqueurs;
    }
    return marqueursParAxe;
  }, [profil, classement]);

  if (partis.isLoading) return <ListItemSkeletonGroup withSubtitle />;
  if (partis.isError || !partis.data) {
    return (
      <p className={errorText} role="alert">
        Erreur de chargement des partis. Réessaie.
      </p>
    );
  }

  const aDesPropositions = classement.some((c) => (c.programme?.propositions.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-4">
      {aDesPropositions && (
        <>
          <section className={`${card} flex flex-col gap-4`} aria-labelledby="partis-axes">
            <div className="flex flex-col gap-1">
              <h2 id="partis-axes" className={sectionTitle}>
                Où se situent les partis
              </h2>
              <p className="text-xs text-ink-3">
                Programme le plus récent de chaque parti, face à ton profil (« Moi »). Même grille pour tous : chaque
                proposition est notée sur ce que dit le texte.
              </p>
            </div>
            <MarqueursAxes parAxe={parAxe} />
          </section>

          <section className="flex flex-col gap-2.5" aria-labelledby="partis-proximite">
            <h2 id="partis-proximite" className={sectionTitle}>
              Qui te ressemble
            </h2>
            <ClassementProximite classement={classement} aDesIdees={aDesIdees} />
          </section>
        </>
      )}

      <section className="flex flex-col gap-2.5" aria-labelledby="partis-liste">
        <h2 id="partis-liste" className={sectionTitle}>
          Les partis
        </h2>
        <button type="button" onClick={() => setAjout(true)} className={addCard}>
          <div className={addCardIcon}>+</div>
          <div className="flex flex-col gap-[1px]">
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">Ajouter un parti</span>
            <span className="text-xs font-medium text-ink-3">Puis demande à Claude d&apos;importer son programme</span>
          </div>
        </button>

        {partis.data.length === 0 ? (
          <p className="text-ink-2">Aucun parti pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {classement.map(({ parti, proximite }) => (
              <li key={parti.id}>
                <PartiCard parti={parti} proximite={proximite} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AnimatePresence>
        {ajout && (
          <PartiFormModal
            key="ajout"
            onClose={() => setAjout(false)}
            onSaved={() => {
              setAjout(false);
              queryClient.invalidateQueries({ queryKey: queryKeys.opinionsPartis });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
