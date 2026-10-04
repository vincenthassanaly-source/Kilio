"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getBibliothequeExercices } from "@/app/actions/sport";
import { Modal } from "@/components/Modal";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { queryKeys } from "@/lib/query/keys";
import { filtrerExercices, texteRecherche, type ExerciceListe } from "@/lib/sport/compute";
import { MUSCLES, URL_IMAGES_SPORT, libelleEquipement, libelleMuscle } from "@/lib/sport/libelles";
import { cardTight, errorText, input, metaText, nameText, secondaryButton } from "@/lib/ui";
import { Puce } from "./exercices/ExercicesView";

const PAGE = 40;

function Contenu({ onChoisir }: { onChoisir: (exercice: ExerciceListe) => void }) {
  const [recherche, setRecherche] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [affiches, setAffiches] = useState(PAGE);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.sportBibliotheque,
    queryFn: getBibliothequeExercices,
    staleTime: 5 * 60_000,
  });

  const rechercheDifferee = useDeferredValue(recherche);
  const recherches = useMemo(
    () => new Map((data?.exercices ?? []).map((e) => [e.id, texteRecherche(e)])),
    [data],
  );
  const resultats = useMemo(
    () => filtrerExercices(data?.exercices ?? [], { recherche: rechercheDifferee, muscle, equipement: null }, recherches),
    [data, rechercheDifferee, muscle, recherches],
  );

  if (isLoading) return <ListItemSkeletonGroup count={5} withSubtitle />;
  if (isError || !data) return <p className={errorText}>Impossible de charger les exercices. Vérifie ta connexion.</p>;

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
            key={m.slug}
            actif={muscle === m.slug}
            onClick={() => {
              setMuscle(muscle === m.slug ? null : m.slug);
              setAffiches(PAGE);
            }}
          >
            {m.label}
          </Puce>
        ))}
      </div>

      {resultats.length === 0 ? (
        <p className={metaText}>Aucun exercice ne correspond.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resultats.slice(0, affiches).map((exercice) => (
            <li key={exercice.id}>
              <button
                type="button"
                onClick={() => onChoisir(exercice)}
                className={`${cardTight} flex w-full items-center gap-3 text-left`}
              >
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-surface-alt">
                  {exercice.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- images déjà optimisées (WebP 600 px)
                    <img
                      src={`${URL_IMAGES_SPORT}/${exercice.image}`}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={nameText}>{exercice.nom_fr}</span>
                  <span className={`${metaText} truncate`}>
                    {libelleMuscle(exercice.muscle_principal)} · {libelleEquipement(exercice.equipement)}
                  </span>
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

/** Feuille « Ajouter un exercice » : recherche + filtre par muscle sur la bibliothèque. */
export function SelecteurExercices({
  ouvert,
  onChoisir,
  onClose,
}: {
  ouvert: boolean;
  onChoisir: (exercice: ExerciceListe) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {ouvert && (
        <Modal key="selecteur-exercices" title="Ajouter un exercice" onClose={onClose}>
          <Contenu onChoisir={onChoisir} />
        </Modal>
      )}
    </AnimatePresence>
  );
}
