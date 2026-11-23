"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { creerIdee, getIdees, type Idee } from "@/app/actions/opinions";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { showToast } from "@/components/toast/toast-store";
import { TransitionLink } from "@/components/TransitionLink";
import { runAction } from "@/lib/actions/runAction";
import {
  AXES,
  LIBELLE_CONVICTION,
  LIBELLE_THEME,
  POSITION_MAX,
  THEMES,
  LIBELLE_STATUT,
  estStatut,
  estTheme,
  formaterScore,
  type Statut,
} from "@/lib/opinions/types";
import {
  ecrireEtatOpinions,
  lireEtatOpinions,
  memoriserRetourOpinions,
  type EtatOpinions,
  type OngletOpinions,
} from "@/lib/opinions/url";
import { queryKeys } from "@/lib/query/keys";
import { useMasques } from "@/lib/actions/elementsMasques";
import { cardTight, emptyState, errorText, input, label, metaText, pillTag, primaryButton, textButton } from "@/lib/ui";
import { PartisView } from "./PartisView";
import { PrioritesEditor } from "./PrioritesEditor";
import { ProfilView } from "./ProfilView";
import { StatutPill } from "./StatutPill";
import { ErrorInline } from "@/components/ErrorInline";

const ONGLETS: { value: OngletOpinions; label: string }[] = [
  { value: "idees", label: "Idées" },
  { value: "partis", label: "Partis" },
  { value: "profil", label: "Profil" },
];

// Filtres compacts : deux listes côte à côte, sur une seule rangée.
const filtreCompact = `${input} min-h-11 min-w-0 flex-1 py-2 text-small`;

const LIBELLE_FILTRE_STATUT: Record<Statut, string> = { brouillon: "Brouillons", validee: "Validées", rejetee: "Rejetées" };

function LigneIdee({ idee, index }: { idee: Idee; index: number }) {
  const scores = AXES.flatMap((axe) => {
    const score = idee.scores[axe.id];
    return score === null ? [] : [{ axe, score }];
  });

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
    >
      <TransitionLink href={`/opinions/${idee.id}`} className={`${cardTight} flex flex-col gap-2`}>
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-3 min-w-0 text-pretty break-words text-body font-medium text-ink">{idee.position}</p>
          <StatutPill statut={idee.statut} />
        </div>
        <p className={metaText}>
          {idee.theme ? LIBELLE_THEME[idee.theme] : "Sans thème"} · {LIBELLE_CONVICTION[idee.conviction]}
        </p>
        {scores.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {scores.map(({ axe, score }) => (
              <li key={axe.id} className={pillTag}>
                {axe.label} {formaterScore(score)}
              </li>
            ))}
          </ul>
        )}
      </TransitionLink>
    </motion.li>
  );
}

export function OpinionsView() {
  const queryClient = useQueryClient();
  // Onglet, filtres et parti ouvert vivent dans l'URL : retrouvés au retour
  // d'une idée, au rechargement ou depuis un lien. `replaceState` (intégré au
  // routeur de Next) met à jour `useSearchParams` sans requête serveur ni
  // entrée d'historique par tap.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const etat = lireEtatOpinions(searchParams);
  const { onglet, statut: filtre, theme } = etat;
  const requete = ecrireEtatOpinions(etat);
  useEffect(() => memoriserRetourOpinions(requete), [requete]);

  function majEtat(partiel: Partial<EtatOpinions>) {
    const suivant = ecrireEtatOpinions({ ...etat, ...partiel });
    window.history.replaceState(window.history.state, "", `${pathname}${suivant}`);
  }
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoutEnCours, startAjout] = useTransition();
  const champRef = useRef<HTMLInputElement>(null);
  const { data: toutesIdees, isLoading, isError, refetch } = useQuery({ queryKey: queryKeys.opinions, queryFn: getIdees });
  // Idées en cours de suppression (toast « Annuler » encore affiché) : cachées.
  const masquees = useMasques("idee");
  const idees = useMemo(
    () => (masquees.size === 0 ? toutesIdees : toutesIdees?.filter((i) => !masquees.has(i.id))),
    [toutesIdees, masquees]
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.opinions });
  }

  function ajouter(e: FormEvent) {
    e.preventDefault();
    const texte = saisie.trim();
    if (!texte) return;
    startAjout(async () => {
      const resultat = await runAction(() => creerIdee(texte), { silencieux: true });
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      setErreur(null);
      setSaisie("");
      invalidate();
      showToast("Idée ajoutée aux brouillons", 1800);
      champRef.current?.focus();
    });
  }

  const visibles = (idees ?? []).filter(
    (i) => (filtre === "tous" || i.statut === filtre) && (theme === "tous" || i.theme === theme)
  );

  return (
    <PullToRefresh onRefresh={invalidate}>
      <div className="flex flex-col gap-4">
        <SegmentedControl
          options={ONGLETS}
          value={onglet}
          onChange={(o) => majEtat({ onglet: o })}
          ariaLabel="Section"
          glissant
        />

        {isLoading ? (
          <ListItemSkeletonGroup withSubtitle />
        ) : isError || !idees ? (
          <ErrorInline message="Impossible de charger les idées." retry={() => refetch()} />
        ) : onglet === "partis" ? (
          <PartisView idees={idees} partiOuvert={etat.parti} onPartiOuvert={(parti) => majEtat({ parti })} />
        ) : onglet === "profil" ? (
          <div className="flex flex-col gap-4">
            <ProfilView idees={idees} />
            <PrioritesEditor />
          </div>
        ) : (
          <>
            <form onSubmit={ajouter} className="flex flex-col gap-1.5">
              <label htmlFor="opinions-saisie" className={label}>
                Nouvelle idée
              </label>
              <div className="flex gap-2">
                <input
                  id="opinions-saisie"
                  ref={champRef}
                  className={`${input} min-w-0 flex-1`}
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  maxLength={POSITION_MAX}
                  placeholder="Une position en une phrase…"
                  enterKeyHint="done"
                  autoComplete="off"
                />
                <button type="submit" className={primaryButton} disabled={ajoutEnCours || !saisie.trim()}>
                  {ajoutEnCours ? "Ajout…" : "Ajouter"}
                </button>
              </div>
              {erreur && (
                <p className={errorText} role="alert">
                  {erreur}
                </p>
              )}
              {saisie.trim() && (
                <p className="text-caption text-ink-3">Elle arrive en brouillon : thème et axes se complètent ensuite.</p>
              )}
            </form>

            <div className="flex gap-2" role="group" aria-label="Filtres">
              <select
                className={filtreCompact}
                aria-label="Filtrer par statut"
                value={filtre}
                onChange={(e) => majEtat({ statut: estStatut(e.target.value) ? e.target.value : "tous" })}
              >
                <option value="tous">Tous les statuts</option>
                {(Object.keys(LIBELLE_STATUT) as Statut[]).map((s) => (
                  <option key={s} value={s}>
                    {LIBELLE_FILTRE_STATUT[s]}
                  </option>
                ))}
              </select>
              <select
                className={filtreCompact}
                aria-label="Filtrer par thème"
                value={theme}
                onChange={(e) => majEtat({ theme: estTheme(e.target.value) ? e.target.value : "tous" })}
              >
                <option value="tous">Tous les thèmes</option>
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {LIBELLE_THEME[t]}
                  </option>
                ))}
              </select>
            </div>

            {visibles.length === 0 ? (
              <div className={`${emptyState} flex flex-col items-center gap-1`}>
                {idees.length === 0 ? (
                  <p>Aucune idée pour l&apos;instant. Note la première ci-dessus.</p>
                ) : (
                  <>
                    <p>Aucune idée ne correspond à ce filtre.</p>
                    <button
                      type="button"
                      className={textButton}
                      onClick={() => {
                        majEtat({ statut: "tous", theme: "tous" });
                      }}
                    >
                      Tout afficher
                    </button>
                  </>
                )}
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {visibles.map((idee, index) => (
                  <LigneIdee key={idee.id} idee={idee} index={index} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
