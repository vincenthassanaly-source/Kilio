"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { creerAnnonce, getAnnonces, type AnnonceVinted } from "@/app/actions/vinted";
import { FadeInImage } from "@/components/FadeInImage";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { TransitionLink } from "@/components/TransitionLink";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { addCard, addCardIcon, cardTight, linkButton, metaText, nameText } from "@/lib/ui";
import { estStatut, type Statut } from "@/lib/vinted/types";
import { StatutPill } from "./StatutPill";
import { ErrorInline } from "@/components/ErrorInline";

type Filtre = "tous" | "brouillon" | "pret" | "publie" | "vendu";

const OPTIONS: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "brouillon", label: "Brouillons" },
  { value: "pret", label: "Prêts" },
  { value: "publie", label: "Publiés" },
  { value: "vendu", label: "Vendus" },
];

function formaterPrix(prix: number | null): string {
  return prix === null ? "Prix à définir" : `${prix.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

function statutDe(annonce: AnnonceVinted): Statut {
  return estStatut(annonce.statut) ? annonce.statut : "brouillon";
}

function LigneAnnonce({ annonce, index }: { annonce: AnnonceVinted; index: number }) {
  const couverture = annonce.photos[0]?.url;
  const titre = annonce.titre.trim() || "Sans titre";
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
    >
      <TransitionLink href={`/vinted/${annonce.id}`} className={`${cardTight} flex items-center gap-3`}>
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-alt">
          {couverture ? (
            <FadeInImage src={couverture} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-ink-3" aria-hidden="true">
              Aucune
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={nameText}>{titre}</p>
          <p className={metaText}>
            {formaterPrix(annonce.prix)} · {annonce.photos.length} photo{annonce.photos.length > 1 ? "s" : ""}
          </p>
        </div>
        <StatutPill statut={statutDe(annonce)} />
      </TransitionLink>
    </motion.li>
  );
}

export function VintedList() {
  const queryClient = useQueryClient();
  const navigate = useViewTransitionNavigate();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [creationEnCours, startCreation] = useTransition();
  const { data: annonces, isLoading, isError, refetch } = useQuery({ queryKey: queryKeys.vinted, queryFn: getAnnonces });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.vinted });
  }

  function nouvelleAnnonce() {
    startCreation(async () => {
      const resultat = await runAction(() => creerAnnonce(), { erreur: "Impossible de créer l'annonce. Réessaie." });
      if (resultat.ok) {
        invalidate();
        navigate(`/vinted/${resultat.data.id}`);
      }
    });
  }

  const visibles = (annonces ?? []).filter((a) => filtre === "tous" || a.statut === filtre);

  return (
    <PullToRefresh onRefresh={invalidate}>
      <div className="flex flex-col gap-4">
        <button type="button" onClick={nouvelleAnnonce} disabled={creationEnCours} className={`${addCard} disabled:opacity-60`}>
          <div className={addCardIcon}>+</div>
          <div className="flex flex-col gap-[1px]">
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
              {creationEnCours ? "Création…" : "Nouvelle annonce"}
            </span>
            <span className="text-xs font-medium text-ink-3">Photos d&apos;abord, Claude rédige ensuite</span>
          </div>
        </button>

        <SegmentedControl options={OPTIONS} value={filtre} onChange={setFiltre} ariaLabel="Filtrer par statut" taille="sm" />

        {isLoading ? (
          <ListItemSkeletonGroup withSubtitle />
        ) : isError ? (
          <ErrorInline message="Impossible de charger les annonces." retry={() => refetch()} />
        ) : visibles.length === 0 ? (
          <p className="text-ink-2">
            {filtre === "tous" ? "Aucune annonce pour l'instant." : "Aucune annonce avec ce statut."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visibles.map((annonce, index) => (
              <LigneAnnonce key={annonce.id} annonce={annonce} index={index} />
            ))}
          </ul>
        )}

        <TransitionLink href="/vinted/reglages" className={`${linkButton} self-start`}>
          Réglages : signature, colis, hashtags
        </TransitionLink>
      </div>
    </PullToRefresh>
  );
}
