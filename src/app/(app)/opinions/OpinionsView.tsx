"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
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
  estTheme,
  formaterScore,
  type Statut,
  type Theme,
} from "@/lib/opinions/types";
import { queryKeys } from "@/lib/query/keys";
import { cardTight, errorText, input, label, metaText, pillTag, primaryButton } from "@/lib/ui";
import { PartisView } from "./PartisView";
import { PrioritesEditor } from "./PrioritesEditor";
import { ProfilView } from "./ProfilView";
import { StatutPill } from "./StatutPill";
import { ErrorInline } from "@/components/ErrorInline";

type Onglet = "idees" | "partis" | "profil";
type Filtre = "tous" | Statut;
type FiltreTheme = "tous" | Theme;

const ONGLETS: { value: Onglet; label: string }[] = [
  { value: "idees", label: "Idées" },
  { value: "partis", label: "Partis" },
  { value: "profil", label: "Profil" },
];

const FILTRES: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Toutes" },
  { value: "brouillon", label: "Brouillons" },
  { value: "validee", label: "Validées" },
  { value: "rejetee", label: "Rejetées" },
];

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
          <p className="line-clamp-3 text-pretty text-[15px] font-medium text-ink">{idee.position}</p>
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
  const [onglet, setOnglet] = useState<Onglet>("idees");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [theme, setTheme] = useState<FiltreTheme>("tous");
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoutEnCours, startAjout] = useTransition();
  const champRef = useRef<HTMLInputElement>(null);
  const { data: idees, isLoading, isError, refetch } = useQuery({ queryKey: queryKeys.opinions, queryFn: getIdees });

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
        <SegmentedControl options={ONGLETS} value={onglet} onChange={setOnglet} ariaLabel="Section" glissant />

        {isLoading ? (
          <ListItemSkeletonGroup withSubtitle />
        ) : isError || !idees ? (
          <ErrorInline message="Impossible de charger les idées." retry={() => refetch()} />
        ) : onglet === "partis" ? (
          <PartisView idees={idees} />
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
                  {ajoutEnCours ? "…" : "Ajouter"}
                </button>
              </div>
              {erreur && (
                <p className={errorText} role="alert">
                  {erreur}
                </p>
              )}
              <p className="text-xs text-ink-3">Elle arrive en brouillon : thème et axes se complètent ensuite.</p>
            </form>

            <SegmentedControl options={FILTRES} value={filtre} onChange={setFiltre} ariaLabel="Filtrer par statut" taille="sm" />

            <select
              className={input}
              aria-label="Filtrer par thème"
              value={theme}
              onChange={(e) => setTheme(estTheme(e.target.value) ? e.target.value : "tous")}
            >
              <option value="tous">Tous les thèmes</option>
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {LIBELLE_THEME[t]}
                </option>
              ))}
            </select>

            {visibles.length === 0 ? (
              <p className="text-ink-2">
                {idees.length === 0 ? "Aucune idée pour l'instant. Note la première ci-dessus." : "Aucune idée ne correspond à ce filtre."}
              </p>
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
