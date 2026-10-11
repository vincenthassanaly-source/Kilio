"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getEntrainements } from "@/app/actions/musculation";
import { queryKeys } from "@/lib/query/keys";
import { ghostButton, sectionTitle } from "@/lib/ui";
import { LigneEntrainement } from "./historique/HistoriqueView";

const NB_RECENTES = 3;

/** Les dernières séances de l'accueil, avec accès à l'historique complet. Rien tant qu'il n'y en a pas. */
export function DernieresSeances() {
  const { data } = useQuery({
    queryKey: queryKeys.musculationHistorique(NB_RECENTES),
    queryFn: () => getEntrainements(NB_RECENTES),
  });
  if (!data || data.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label="Dernières séances">
      <div className="flex items-center justify-between gap-2">
        <h2 className={sectionTitle}>Dernières séances</h2>
        <Link href="/musculation/historique" className={ghostButton}>
          Tout l&apos;historique
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {data.map((e) => (
          <LigneEntrainement key={e.id} entrainement={e} />
        ))}
      </ul>
    </section>
  );
}
