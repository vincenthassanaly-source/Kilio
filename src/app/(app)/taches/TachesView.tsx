"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { aujourdhuiISO } from "@/lib/budget/compute";
import { getListes, getTachesAvecRelations, getTags } from "@/app/actions/taches";
import { normalizeSearch } from "@/lib/normalize";
import {
  DUREE_TOAST_AVERTISSEMENT_MS,
  actualisationEchouee,
  echeanceParDefaut,
  etatListeTaches,
  type VueTache,
} from "@/lib/taches/compute";
import { queryKeys } from "@/lib/query/keys";
import { AddTaskToggle } from "./AddTaskToggle";
import { TasksList } from "./TasksList";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { errorText, input } from "@/lib/ui";
import { PullToRefresh } from "@/components/PullToRefresh";
import { showToast } from "@/components/toast/toast-store";
import { QuickAddFab } from "../QuickAddFab";
import { preloadAddTaskFormWhenIdle } from "./preloadAddTaskForm";
import { SegmentedControl } from "@/components/SegmentedControl";

const LISTE_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </svg>
);

const SEARCH_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
);

const CLEAR_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

type VueKey = VueTache;

// Durée pendant laquelle la carte d'une tâche tout juste créée reste marquée
// (l'animation CSS dure 2,6 s), une fois affichée dans la liste. Repli plus
// long si elle n'apparaît pas (filtre de vue, de liste ou recherche actif).
const DUREE_SURBRILLANCE_MS = 3000;
const DUREE_MAX_ATTENTE_CARTE_MS = 6000;

const VUES: { key: VueKey; label: string }[] = [
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "en_retard", label: "En retard" },
  { key: "semaine", label: "7 jours" },
  { key: "toutes", label: "Toutes" },
];

export function TachesView() {
  const [vue, setVue] = useState<VueKey>("toutes");
  const [listeId, setListeId] = useState<string>("toutes");
  const [recherche, setRecherche] = useState("");
  // Formulaire d'ajout inline ouvert : le FAB est alors masqué (deux
  // formulaires de création à la fois n'ont pas de sens).
  const [ajoutInlineOuvert, setAjoutInlineOuvert] = useState(false);
  // Tâche qui vient d'être créée : à faire défiler en vue et à surligner.
  const [tacheSurlignee, setTacheSurlignee] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: taches, isLoading: tachesLoading, isError: tachesError } = useQuery({
    queryKey: queryKeys.taches,
    queryFn: getTachesAvecRelations,
  });
  const { data: listes = [] } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });
  const { data: tags = [] } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });

  // Une actualisation ratée (connexion faible, incident serveur) laisse les
  // données en cache : on garde la liste et on prévient, plutôt que de la
  // remplacer par un message d'erreur.
  const etatListe = etatListeTaches({
    isLoading: tachesLoading,
    isError: tachesError,
    aDesDonnees: taches !== undefined,
  });
  const actualisationKo = actualisationEchouee({ isError: tachesError, aDesDonnees: taches !== undefined });

  const filtered = useMemo(() => {
    if (!taches) return [];
    const today = aujourdhuiISO();
    const dansSeptJours = format(addDays(new Date(`${today}T00:00:00`), 7), "yyyy-MM-dd");
    const rechercheNormalisee = normalizeSearch(recherche);

    return taches.filter((tache) => {
      if (listeId !== "toutes" && tache.liste_id !== listeId) return false;
      if (vue === "aujourdhui" && tache.echeance !== today) return false;
      if (vue === "en_retard") {
        if (!tache.echeance || tache.echeance >= today || tache.fait) return false;
      }
      if (vue === "semaine") {
        if (!tache.echeance || tache.echeance < today || tache.echeance > dansSeptJours) return false;
      }
      if (rechercheNormalisee) {
        const titreMatch = normalizeSearch(tache.titre).includes(rechercheNormalisee);
        const notesMatch = tache.notes ? normalizeSearch(tache.notes).includes(rechercheNormalisee) : false;
        const tagsMatch = tache.tags.some((tag) => normalizeSearch(tag.nom).includes(rechercheNormalisee));
        const listeMatch = tache.liste ? normalizeSearch(tache.liste.nom).includes(rechercheNormalisee) : false;
        if (!titreMatch && !notesMatch && !tagsMatch && !listeMatch) return false;
      }
      return true;
    });
  }, [taches, vue, listeId, recherche]);

  function invalidateTaches() {
    queryClient.invalidateQueries({ queryKey: queryKeys.taches });
  }

  // Valeurs par défaut communes à la carte d'ajout et au FAB : la liste
  // sélectionnée, et l'échéance imposée par l'onglet de vue (sans elle, une
  // tâche créée sous « Aujourd'hui » serait aussitôt filtrée hors de la vue).
  const defaultListeId = listeId !== "toutes" ? listeId : undefined;
  const defaultEcheance = echeanceParDefaut(vue, aujourdhuiISO());

  // Point d'entrée unique après une création, quel que soit le bouton utilisé
  // (carte ou FAB). Les filtres de l'utilisateur ne sont jamais modifiés : si
  // la carte n'est pas dans la liste affichée, seul le toast apparaît.
  function handleCreated(id?: string, avertissement?: string) {
    // La tâche existe dans tous les cas : un avertissement (tags ou image en
    // échec) remplace « Tâche créée », plus longtemps affiché.
    if (avertissement) showToast(avertissement, DUREE_TOAST_AVERTISSEMENT_MS);
    else showToast("Tâche créée");
    invalidateTaches();
    if (id) setTacheSurlignee(id);
  }

  // Précharge le formulaire à l'inactivité du navigateur, sans retarder
  // l'affichage initial de la liste.
  useEffect(() => preloadAddTaskFormWhenIdle(), []);

  // Retire la surbrillance : peu après l'apparition de la carte (l'effet de
  // scroll de TaskCard ne doit pas rejouer aux re-rendus suivants), ou après
  // un délai plus long si elle n'apparaît jamais (filtre actif, échec du
  // rafraîchissement).
  const carteSurligneeAffichee =
    tacheSurlignee !== null && filtered.some((tache) => tache.id === tacheSurlignee);
  useEffect(() => {
    if (tacheSurlignee === null) return;
    const timer = window.setTimeout(
      () => setTacheSurlignee(null),
      carteSurligneeAffichee ? DUREE_SURBRILLANCE_MS : DUREE_MAX_ATTENTE_CARTE_MS
    );
    return () => window.clearTimeout(timer);
  }, [tacheSurlignee, carteSurligneeAffichee]);

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.taches }),
      queryClient.invalidateQueries({ queryKey: queryKeys.listes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tags }),
    ]);
  }

  return (
    <>
    <PullToRefresh onRefresh={handleRefresh}>
    {/* pb-12 : dégage les dernières cartes (boutons « Modifier / Suppr. » à
        droite) du FAB, posé au-dessus de la barre du bas. */}
    <div className="flex flex-col gap-4 pb-12">
      {/* Contrôle segmenté partagé (T7) : actif en vert Kcal au lieu de
          l'ancien jaune Glucides (One Accent Rule, 2,2:1 en sombre). */}
      <SegmentedControl
        ariaLabel="Vue des tâches"
        taille="sm"
        options={VUES.map((v) => ({ value: v.key, label: v.label }))}
        value={vue}
        onChange={setVue}
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1" data-swipe-ignore>
        <Link
          href="/taches/listes"
          aria-label="Gérer les listes"
          title="Gérer les listes"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-alt"
        >
          {LISTE_ICON}
        </Link>
        <button
          type="button"
          onClick={() => setListeId("toutes")}
          className={`flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-2xl border px-3.5 py-2.5 shadow-card transition-colors ${
            listeId === "toutes" ? "border-kcal bg-kcal-soft" : "border-line bg-surface"
          }`}
        >
          <span className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--color-kcal)" }} />
          <span className="text-[13.5px] font-semibold text-ink">Toutes</span>
        </button>
        {listes.map((liste) => (
          <button
            key={liste.id}
            type="button"
            onClick={() => setListeId(liste.id)}
            className={`flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-2xl border px-3.5 py-2.5 shadow-card transition-colors ${
              listeId === liste.id ? "border-kcal bg-kcal-soft" : "border-line bg-surface"
            }`}
          >
            <span className="h-[9px] w-[9px] rounded-full" style={{ background: liste.couleur ?? "var(--color-kcal)" }} />
            <span className="text-[13.5px] font-semibold text-ink">{liste.nom}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">{SEARCH_ICON}</span>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une tâche…"
          className={`${input} w-full pl-10 ${recherche ? "pr-9" : ""}`}
        />
        {recherche && (
          <button
            type="button"
            onClick={() => setRecherche("")}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 transition-colors after:absolute after:-inset-2 hover:bg-surface-alt"
          >
            {CLEAR_ICON}
          </button>
        )}
      </div>

      <AddTaskToggle
        listes={listes}
        tags={tags}
        defaultListeId={defaultListeId}
        defaultEcheance={defaultEcheance}
        onSaved={handleCreated}
        onOpenChange={setAjoutInlineOuvert}
      />
      {actualisationKo && (
        <p role="status" className={errorText}>
          Actualisation impossible : dernières données affichées.
        </p>
      )}
      {etatListe === "chargement" ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3 w-24" />
          <ListItemSkeletonGroup count={5} />
        </div>
      ) : etatListe === "erreur" ? (
        <p className={errorText}>Erreur de chargement des tâches. Réessaie.</p>
      ) : recherche.trim() && filtered.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ink-2">
          Aucune tâche ne correspond à « {recherche.trim()} ».
        </p>
      ) : (
        <TasksList
          taches={filtered}
          listes={listes}
          tags={tags}
          reordonnable={vue === "toutes" && !recherche.trim()}
          highlightedId={tacheSurlignee}
        />
      )}
    </div>
    </PullToRefresh>
    {/* Hors de PullToRefresh : ni le bouton ni sa feuille de saisie ne doivent
        partager les gestes tactiles du tirer-pour-rafraîchir. */}
    {!ajoutInlineOuvert && (
      <QuickAddFab
        directTask={{ defaultListeId, defaultEcheance, onCreated: handleCreated }}
      />
    )}
    </>
  );
}
