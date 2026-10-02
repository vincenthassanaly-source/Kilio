"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBibliothequeExercices } from "@/app/actions/sport";
import { queryKeys } from "@/lib/query/keys";
import { TransitionLink } from "@/components/TransitionLink";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { filtrerExercices, texteRecherche } from "@/lib/sport/compute";
import { EQUIPEMENTS, MUSCLES, libelleEquipement, libelleMuscle } from "@/lib/sport/libelles";
import { cardTight, errorText, eyebrow, input, linkButton, metaText, nameText, secondaryButton, zoneTapPill } from "@/lib/ui";

// Nombre de lignes affichées d'un coup : la bibliothèque compte ~900
// exercices, en rendre autant d'un bloc ralentirait le téléphone.
const PAGE = 60;

export function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: string }) {
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

export function ExercicesView() {
  const [recherche, setRecherche] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipement, setEquipement] = useState<string | null>(null);
  const [affiches, setAffiches] = useState(PAGE);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.sportBibliotheque,
    queryFn: getBibliothequeExercices,
    // Données statiques (importées par script) : inutile de les redemander.
    staleTime: 5 * 60_000,
  });

  const rechercheDifferee = useDeferredValue(recherche);
  const recherches = useMemo(
    () => new Map((data?.exercices ?? []).map((e) => [e.id, texteRecherche(e)])),
    [data],
  );
  const resultats = useMemo(
    () => filtrerExercices(data?.exercices ?? [], { recherche: rechercheDifferee, muscle, equipement }, recherches),
    [data, rechercheDifferee, muscle, equipement, recherches],
  );

  // Toute modification d'un filtre ramène la liste à sa première page.
  function changer<T>(setter: (valeur: T) => void) {
    return (valeur: T) => {
      setter(valeur);
      setAffiches(PAGE);
    };
  }

  if (isLoading) return <ListItemSkeletonGroup count={6} withSubtitle />;
  if (isError || !data) return <p className={errorText}>Erreur de chargement des exercices.</p>;
  if (data.exercices.length === 0) {
    return <p className={metaText}>La bibliothèque d&apos;exercices est en cours d&apos;import. Reviens dans un instant.</p>;
  }

  const visibles = resultats.slice(0, affiches);
  const filtreActif = Boolean(muscle || equipement || recherche.trim());

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={recherche}
        onChange={(e) => changer(setRecherche)(e.target.value)}
        placeholder="Rechercher un exercice"
        aria-label="Rechercher un exercice"
        autoComplete="off"
        className={input}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className={eyebrow}>Muscle</span>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <Puce actif={muscle === null} onClick={() => changer(setMuscle)(null)}>
              Tous
            </Puce>
            {MUSCLES.map((m) => (
              <Puce key={m.slug} actif={muscle === m.slug} onClick={() => changer(setMuscle)(muscle === m.slug ? null : m.slug)}>
                {m.label}
              </Puce>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={eyebrow}>Équipement</span>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <Puce actif={equipement === null} onClick={() => changer(setEquipement)(null)}>
              Tous
            </Puce>
            {EQUIPEMENTS.map((e) => (
              <Puce
                key={e.slug}
                actif={equipement === e.slug}
                onClick={() => changer(setEquipement)(equipement === e.slug ? null : e.slug)}
              >
                {e.label}
              </Puce>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={metaText} aria-live="polite">
          {resultats.length} exercice{resultats.length > 1 ? "s" : ""}
        </span>
        {filtreActif && (
          <button
            type="button"
            className={linkButton}
            onClick={() => {
              setRecherche("");
              setMuscle(null);
              setEquipement(null);
              setAffiches(PAGE);
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {resultats.length === 0 ? (
        <p className={metaText}>Aucun exercice ne correspond à ta recherche.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((exercice) => (
            <li key={exercice.id}>
              <TransitionLink href={`/sport/exercices/${encodeURIComponent(exercice.id)}`} className={`${cardTight} flex items-center gap-3`}>
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-surface-alt">
                  {exercice.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- images déjà optimisées (WebP 600 px) dans Supabase Storage
                    <img
                      src={`${data.urlImages}/${exercice.image}`}
                      alt=""
                      width={56}
                      height={56}
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
              </TransitionLink>
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
