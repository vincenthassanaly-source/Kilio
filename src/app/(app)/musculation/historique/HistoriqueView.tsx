"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getEntrainements } from "@/app/actions/musculation";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { formaterDateLongue, formaterDureeS, type EntrainementResume } from "@/lib/musculation/historique";
import { formaterPoids } from "@/lib/musculation/seance";
import { queryKeys } from "@/lib/query/keys";
import { card, cardTight, errorText, ghostButton, metaText, nameText, screenTitle, secondaryButton } from "@/lib/ui";

const PAGE = 30;

export function LigneEntrainement({ entrainement: e }: { entrainement: EntrainementResume }) {
  return (
    <li>
      <Link href={`/musculation/historique/${e.id}`} className={`${cardTight} flex flex-col gap-0.5`}>
        <span className={nameText}>{e.titre}</span>
        <span className={metaText}>{formaterDateLongue(e.date)}</span>
        <span className={metaText}>
          {e.nbExercices} exercice{e.nbExercices > 1 ? "s" : ""} · {e.nbSeries} série{e.nbSeries > 1 ? "s" : ""} ·{" "}
          {formaterDureeS(e.dureeS)}
          {e.volume > 0 ? ` · ${formaterPoids(e.volume)} kg` : ""}
        </span>
      </Link>
    </li>
  );
}

export function HistoriqueView() {
  const [limite, setLimite] = useState(PAGE);
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.musculationHistorique(limite),
    queryFn: () => getEntrainements(limite),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className={screenTitle}>Historique</h1>
        <Link href="/musculation/historique/nouvelle" className={ghostButton}>
          + Séance passée
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-[20px]" />
          <Skeleton className="h-20 w-full rounded-[20px]" />
        </div>
      )}
      {isError && <p className={errorText}>Impossible de charger l&apos;historique. Vérifie ta connexion.</p>}
      {data && data.length === 0 && (
        <section className={`${card} flex flex-col gap-1.5`}>
          <p className={metaText}>Aucune séance enregistrée pour l&apos;instant.</p>
        </section>
      )}
      {data && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((e) => (
            <LigneEntrainement key={e.id} entrainement={e} />
          ))}
        </ul>
      )}
      {data && data.length >= limite && (
        <button type="button" className={secondaryButton} onClick={() => setLimite((n) => n + PAGE)}>
          Voir plus
        </button>
      )}
    </div>
  );
}
