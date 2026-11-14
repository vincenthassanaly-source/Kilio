"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getEntrainements } from "@/app/actions/musculation";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { formaterDateLongue, formaterDureeS, type EntrainementResume } from "@/lib/musculation/historique";
import { formaterPoids } from "@/lib/musculation/seance";
import { queryKeys } from "@/lib/query/keys";
import { useMasques } from "@/lib/actions/elementsMasques";
import { LIBELLES_TYPE } from "@/lib/seances/compute";
import { card, cardTight, ghostButton, metaText, pillTag, nameTextComplet, screenTitle, secondaryButton } from "@/lib/ui";
import { ErrorInline } from "@/components/ErrorInline";
import { BackLink } from "@/components/BackLink";

const PAGE = 30;

export function LigneEntrainement({ entrainement: e }: { entrainement: EntrainementResume }) {
  return (
    <li>
      <Link href={`/musculation/historique/${e.id}`} className={`${cardTight} flex flex-col gap-0.5`}>
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className={`${nameTextComplet} min-w-0`}>{e.titre}</span>
          {/* Le titre par défaut (« Push ») dit déjà le type : la pastille ne ferait que doublonner. */}
          {e.typeSeance && e.titre.trim().toLowerCase() !== LIBELLES_TYPE[e.typeSeance].toLowerCase() && (
            <span className={`${pillTag} mt-0.5`}>{LIBELLES_TYPE[e.typeSeance]}</span>
          )}
        </span>
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
  const { data: toutes, isLoading, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: queryKeys.musculationHistorique(limite),
    queryFn: () => getEntrainements(limite),
    placeholderData: keepPreviousData,
  });
  // Séances en cours de suppression (toast « Annuler » encore affiché) : cachées.
  const masquees = useMasques("entrainement");
  const data = toutes?.filter((e) => !masquees.has(e.id));

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/musculation">Musculation</BackLink>
      <div className="flex items-center justify-between gap-3">
        <h1 className={screenTitle}>Historique</h1>
        <Link href="/musculation/historique/nouvelle" className={ghostButton}>
          + Séance passée
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-row" />
          <Skeleton className="h-20 w-full rounded-row" />
        </div>
      )}
      {isError && <ErrorInline message="Impossible de charger l'historique. Vérifie ta connexion." retry={() => refetch()} />}
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
      {toutes && toutes.length >= limite && (
        <button
          type="button"
          className={secondaryButton}
          onClick={() => setLimite((n) => n + PAGE)}
          disabled={isPlaceholderData}
          aria-busy={isPlaceholderData}
        >
          {isPlaceholderData ? "Chargement…" : "Voir plus"}
        </button>
      )}
    </div>
  );
}
