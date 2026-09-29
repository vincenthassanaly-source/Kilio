"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { runAction } from "@/lib/actions/runAction";
import { genererProgrammeDuJour } from "@/app/actions/programme";
import type { ProgrammeGenere, SourceProposition } from "@/lib/programme/generation";
import { card, ghostButton, pillTag } from "@/lib/ui";
import { Skeleton } from "@/components/skeletons/Skeleton";

type Etat = "repos" | "chargement" | "resultat" | "erreur";

const LABEL_SOURCE: Record<Exclude<SourceProposition, "general">, string> = {
  tache: "Tâche",
  note: "Note",
  habitude: "Habitude",
};

// Icône "étincelles" (même style trait que les icônes existantes de l'app :
// stroke 1.8, currentColor) — identité visuelle de la seule fonctionnalité
// générative du tableau de bord.
function IconeEtincelles() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
    </svg>
  );
}

function IconeChevron({ ouvert }: { ouvert: boolean }) {
  return (
    <motion.svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-3)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ rotate: ouvert ? 180 : 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <path d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}

// Carte "Programme du jour" : au repos, un simple teaser tappable. Un tap
// déclenche la génération (Gemini, via genererProgrammeDuJour) et déplie la
// carte en place pour afficher les propositions — jamais de navigation ni de
// modal plein écran (voulu explicitement : la carte s'agrandit sur elle-même).
// Le second tap une fois le résultat obtenu replie/déplie sans régénérer ;
// "Régénérer" à l'intérieur du résultat relance un appel.
export function DashboardProgrammeCard() {
  const [etat, setEtat] = useState<Etat>("repos");
  const [expanded, setExpanded] = useState(false);
  const [programme, setProgramme] = useState<ProgrammeGenere | null>(null);
  const [erreur, setErreur] = useState("");

  async function generer() {
    setEtat("chargement");
    setExpanded(true);
    const resultat = await runAction(() => genererProgrammeDuJour(), {
      erreur: "La génération du programme a échoué. Réessaie.",
      silencieux: true,
    });
    if (resultat.ok) {
      setProgramme(resultat.data);
      setEtat("resultat");
    } else {
      setErreur(resultat.error);
      setEtat("erreur");
    }
  }

  function onHeaderClick() {
    if (etat === "repos") {
      generer();
    } else {
      setExpanded((v) => !v);
    }
  }

  return (
    <motion.div layout transition={{ duration: 0.25, ease: "easeOut" }} className={card}>
      <motion.button
        type="button"
        layout="position"
        onClick={onHeaderClick}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-kcal-soft text-kcal">
          <IconeEtincelles />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="text-[14px] font-semibold text-ink">Programme du jour</span>
          <span className="truncate text-[12.5px] text-ink-2">
            {etat === "repos" && "Une proposition personnalisée pour aujourd'hui"}
            {etat === "chargement" && "Génération en cours…"}
            {etat === "resultat" && (programme?.intro ?? "")}
            {etat === "erreur" && "La génération a échoué"}
          </span>
        </div>
        {etat !== "repos" && <IconeChevron ouvert={expanded} />}
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && etat !== "repos" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
              {etat === "chargement" && (
                <div className="flex flex-col gap-2 py-1">
                  <p className="text-[12.5px] text-ink-2">Analyse de ta journée, tes tâches, notes et habitudes…</p>
                  <Skeleton className="h-[14px] w-[92%]" />
                  <Skeleton className="h-[14px] w-[78%]" />
                  <Skeleton className="h-[14px] w-[85%]" />
                </div>
              )}

              {etat === "erreur" && (
                <div className="flex flex-col items-start gap-2 py-1">
                  <p className="text-[13.5px] text-ink-2">{erreur}</p>
                  <button type="button" onClick={generer} className={ghostButton}>
                    Réessayer
                  </button>
                </div>
              )}

              {etat === "resultat" && programme && (
                <>
                  {programme.propositions.length === 0 ? (
                    <p className="py-1 text-[13.5px] text-ink-2">Aucune suggestion pour l&apos;instant.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-line">
                      {programme.propositions.map((p, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {p.creneau && (
                              <span className="text-[12.5px] font-semibold tabular-nums text-ink-2">{p.creneau}</span>
                            )}
                            <p className="text-[13.5px] text-ink">{p.texte}</p>
                          </div>
                          {p.source !== "general" && <span className={pillTag}>{LABEL_SOURCE[p.source]}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={generer} className={`${ghostButton} self-start`}>
                    Régénérer
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
