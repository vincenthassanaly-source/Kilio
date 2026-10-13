"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getExercices } from "@/app/actions/musculation";
import { Modal } from "@/components/Modal";
import { useBackClose } from "@/hooks/useBackClose";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { filtrerExercices } from "@/lib/musculation/catalogue";
import { MODE_SAISIE_LABELS, MUSCLES, MUSCLE_LABELS, type Muscle } from "@/lib/musculation/constantes";
import { queryKeys } from "@/lib/query/keys";
import type { ExerciceCatalogue } from "@/lib/musculation/serveur";
import { AnimationVignette } from "../AnimationExercice";
import { cardTight, errorText, input, metaText, nameText, secondaryButton, zoneTapPill } from "@/lib/ui";

const PAGE = 40;

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`${zoneTapPill} shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
        actif ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

function Contenu({ onChoisir }: { onChoisir: (exercice: ExerciceCatalogue) => void }) {
  const [recherche, setRecherche] = useState("");
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [affiches, setAffiches] = useState(PAGE);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.musculationExercices,
    queryFn: getExercices,
    staleTime: 5 * 60_000,
  });

  const rechercheDifferee = useDeferredValue(recherche);
  const resultats = useMemo(
    () => filtrerExercices(data ?? [], { recherche: rechercheDifferee, muscle }),
    [data, rechercheDifferee, muscle],
  );

  if (isLoading) return <ListItemSkeletonGroup count={5} withSubtitle />;
  if (isError || !data) return <p className={errorText}>Impossible de charger les exercices. Vérifie ta connexion.</p>;
  if (data.length === 0) {
    return <p className={metaText}>Aucun exercice pour l&apos;instant : le catalogue arrive bientôt.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={recherche}
        onChange={(e) => {
          setRecherche(e.target.value);
          setAffiches(PAGE);
        }}
        placeholder="Rechercher un exercice"
        aria-label="Rechercher un exercice"
        autoComplete="off"
        className={input}
      />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <Puce
          actif={muscle === null}
          onClick={() => {
            setMuscle(null);
            setAffiches(PAGE);
          }}
        >
          Tous
        </Puce>
        {MUSCLES.map((m) => (
          <Puce
            key={m}
            actif={muscle === m}
            onClick={() => {
              setMuscle(muscle === m ? null : m);
              setAffiches(PAGE);
            }}
          >
            {MUSCLE_LABELS[m]}
          </Puce>
        ))}
      </div>

      {resultats.length === 0 ? (
        <p className={metaText}>Aucun exercice ne correspond.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resultats.slice(0, affiches).map((exercice) => (
            <li key={exercice.id} className="flex items-center gap-2">
              <AnimationVignette animation={exercice.animation} nom={exercice.nom} />
              <button
                type="button"
                onClick={() => onChoisir(exercice)}
                className={`${cardTight} flex min-w-0 flex-1 flex-col gap-0.5 text-left`}
              >
                <span className={nameText}>{exercice.nom}</span>
                <span className={`${metaText} truncate`}>
                  {MUSCLE_LABELS[exercice.muscle]}
                  {exercice.materiel ? ` · ${exercice.materiel}` : ""} · {MODE_SAISIE_LABELS[exercice.mode]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {resultats.length > affiches && (
        <button type="button" className={secondaryButton} onClick={() => setAffiches((n) => n + PAGE)}>
          Voir plus ({resultats.length - affiches} restants)
        </button>
      )}
    </div>
  );
}

/** Feuille « Ajouter un exercice » : recherche + filtre par muscle sur le catalogue. */
export function SelecteurExercices({
  ouvert,
  onChoisir,
  onClose,
  titre = "Ajouter un exercice",
}: {
  ouvert: boolean;
  onChoisir: (exercice: ExerciceCatalogue) => void;
  onClose: () => void;
  titre?: string;
}) {
  // Le retour referme la feuille au lieu de quitter la page.
  useBackClose(ouvert, onClose);
  return (
    <AnimatePresence>
      {ouvert && (
        <Modal key="selecteur-exercices" title={titre} onClose={onClose}>
          <Contenu onChoisir={onChoisir} />
        </Modal>
      )}
    </AnimatePresence>
  );
}
