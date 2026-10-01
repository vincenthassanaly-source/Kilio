"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { card, sectionTitle } from "@/lib/ui";

// Mémoire « pour la session » : l'écran se démonte quand on ouvre une fiche, le
// state React seul serait perdu au retour. Un Set au niveau du module survit à
// la navigation client mais repart vide à chaque rechargement de l'app.
const ouverts = new Set<string>();

function useOuvert(id: string) {
  const [ouvert, setOuvert] = useState(() => ouverts.has(id));
  const basculer = () => {
    if (ouvert) ouverts.delete(id);
    else ouverts.add(id);
    setOuvert(!ouvert);
  };
  return [ouvert, basculer] as const;
}

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-out ${ouvert ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

function Panneau({ ouvert, children }: { ouvert: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {ouvert && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const focusEntete = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

// Niveau 1 : le titre de section lui-même sert de bouton, sans conteneur.
export function SectionRepliable({
  id,
  titre,
  compteur,
  children,
}: {
  id: string;
  titre: string;
  compteur?: ReactNode;
  children: ReactNode;
}) {
  const [ouvert, basculer] = useOuvert(id);
  const idPanneau = `${id}-contenu`;

  return (
    <section className="flex flex-col">
      <h2 className="m-0">
        <button
          type="button"
          onClick={basculer}
          aria-expanded={ouvert}
          aria-controls={idPanneau}
          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl text-left ${focusEntete}`}
        >
          <span className={sectionTitle}>
            {titre}
            {compteur !== undefined && <span className="ml-1.5 font-normal text-ink-3 tabular-nums">{compteur}</span>}
          </span>
          <Chevron ouvert={ouvert} />
        </button>
      </h2>
      <div id={idPanneau}>
        <Panneau ouvert={ouvert}>
          <div className="pt-1.5">{children}</div>
        </Panneau>
      </div>
    </section>
  );
}

// Niveau 2 : une carte par groupe (famille de classes, lettre) ; l'en-tête est
// le bouton, la liste s'ouvre dans la même carte (jamais de carte imbriquée).
export function GroupeRepliable({
  id,
  titre,
  compteur,
  style,
  titreClassName = "text-[14.5px] font-semibold text-ink",
  children,
}: {
  id: string;
  titre: ReactNode;
  compteur: ReactNode;
  style?: CSSProperties;
  titreClassName?: string;
  children: ReactNode;
}) {
  const [ouvert, basculer] = useOuvert(id);
  const idPanneau = `${id}-contenu`;

  return (
    <div className={`${card} p-0`} style={style}>
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-[22px] px-4 text-left ${focusEntete}`}
      >
        <span className={`flex items-center gap-2 ${titreClassName}`}>{titre}</span>
        <span className="flex shrink-0 items-center gap-2.5">
          <span className="text-[12px] text-ink-2 tabular-nums">{compteur}</span>
          <Chevron ouvert={ouvert} />
        </span>
      </button>
      <div id={idPanneau}>
        <Panneau ouvert={ouvert}>
          <div className="border-t border-line">{children}</div>
        </Panneau>
      </div>
    </div>
  );
}
