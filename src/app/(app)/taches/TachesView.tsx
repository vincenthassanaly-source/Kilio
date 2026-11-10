"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { aujourdhuiISO } from "@/lib/date/recurrence";
import { getListes, getTachesAvecRelations, getTags } from "@/app/actions/taches";
import { normalizeSearch } from "@/lib/normalize";
import {
  DUREE_TOAST_AVERTISSEMENT_MS,
  actualisationEchouee,
  echeanceParDefaut,
  etatListeTaches,
  filtrerParPriorite,
  trierTaches,
  type OrdreTaches,
  type Priorite,
  type VueTache,
} from "@/lib/taches/compute";
import { queryKeys } from "@/lib/query/keys";
import { msAvantMinuitParis } from "@/lib/date/paris";
import { SelectionBar } from "./SelectionBar";
import { TasksList } from "./TasksList";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { errorText, ghostButton, input, textButton } from "@/lib/ui";
import { PullToRefresh } from "@/components/PullToRefresh";
import { showToast } from "@/components/toast/toast-store";
import { QuickAddFab } from "../QuickAddFab";
import { preloadAddTaskFormWhenIdle } from "./preloadAddTaskForm";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ErrorInline } from "@/components/ErrorInline";

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

const ORDRES: { value: OrdreTaches; label: string }[] = [
  { value: "manuel", label: "Ordre manuel" },
  { value: "priorite", label: "Priorité" },
  { value: "echeance", label: "Échéance" },
];

const FILTRES_PRIORITE: { value: Priorite; label: string }[] = [
  { value: "haute", label: "Haute" },
  { value: "moyenne", label: "Moyenne" },
  { value: "basse", label: "Basse" },
  { value: "aucune", label: "Sans priorité" },
];

// Références stables tant que les requêtes n'ont pas répondu : un `= []` neuf à
// chaque rendu invaliderait le memo des cartes.
const LISTES_VIDES: Awaited<ReturnType<typeof getListes>> = [];
const TAGS_VIDES: Awaited<ReturnType<typeof getTags>> = [];

export function TachesView() {
  const [vue, setVue] = useState<VueKey>("aujourdhui");
  const [listeId, setListeId] = useState<string>("toutes");
  const [recherche, setRecherche] = useState("");
  // Tâche qui vient d'être créée : à faire défiler en vue et à surligner.
  const [tacheSurlignee, setTacheSurlignee] = useState<string | null>(null);
  const [ordre, setOrdre] = useState<OrdreTaches>("manuel");
  const [priorites, setPriorites] = useState<ReadonlySet<Priorite>>(() => new Set());
  // Sélection multiple : cartes cochables + barre d'actions groupées.
  const [selection, setSelection] = useState(false);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [selectionIds, setSelectionIds] = useState<ReadonlySet<string>>(() => new Set());
  const queryClient = useQueryClient();
  // Jour courant : une PWA laissée ouverte la nuit doit basculer « Aujourd'hui »
  // et « En retard » à minuit, sans attendre une autre interaction.
  const [aujourdhui, setAujourdhui] = useState(() => aujourdhuiISO());
  useEffect(() => {
    const majJour = () => setAujourdhui(aujourdhuiISO());
    const minuteur = window.setTimeout(majJour, msAvantMinuitParis() + 1000);
    const auRetour = () => {
      if (document.visibilityState === "visible") majJour();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearTimeout(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [aujourdhui]);

  const { data: taches, isLoading: tachesLoading, isError: tachesError, refetch: refetchTaches } = useQuery({
    queryKey: queryKeys.taches,
    queryFn: getTachesAvecRelations,
  });
  const { data: listes = LISTES_VIDES } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });
  const { data: tags = TAGS_VIDES } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });

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
    const today = aujourdhui;
    const dansSeptJours = format(addDays(new Date(`${today}T00:00:00`), 7), "yyyy-MM-dd");
    const rechercheNormalisee = normalizeSearch(recherche);

    const visibles = taches.filter((tache) => {
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
    // « 7 jours » se lit par date : sans tri choisi, l'échéance prime sur l'ordre manuel.
    const ordreAffiche: OrdreTaches = vue === "semaine" && ordre === "manuel" ? "echeance" : ordre;
    return trierTaches(filtrerParPriorite(visibles, priorites), ordreAffiche);
  }, [taches, vue, listeId, recherche, priorites, ordre, aujourdhui]);

  // Sélection restreinte aux tâches affichées : changer de vue, de liste ou de
  // filtre ne doit pas laisser des tâches masquées dans les actions groupées.
  const selectionVisible = useMemo(() => {
    const visibles = new Set(filtered.map((t) => t.id));
    return new Set([...selectionIds].filter((id) => visibles.has(id)));
  }, [filtered, selectionIds]);

  function basculerPriorite(p: Priorite) {
    setPriorites((courantes) => {
      const suivantes = new Set(courantes);
      if (!suivantes.delete(p)) suivantes.add(p);
      return suivantes;
    });
  }

  const basculerSelection = useCallback((id: string) => {
    setSelectionIds((courants) => {
      const suivants = new Set(courants);
      if (!suivants.delete(id)) suivants.add(id);
      return suivants;
    });
  }, []);

  function quitterSelection() {
    setSelection(false);
    setSelectionIds(new Set());
  }

  // Le glisser-déposer renumérote la liste complète d'après la position
  // visuelle : il n'a de sens qu'en ordre manuel, sans filtre qui masque des
  // tâches.
  const reordonnable = vue === "toutes" && !recherche.trim() && ordre === "manuel" && priorites.size === 0;

  function invalidateTaches() {
    queryClient.invalidateQueries({ queryKey: queryKeys.taches });
  }

  // Valeurs par défaut du FAB : la liste sélectionnée, et l'échéance imposée par l'onglet de vue (sans elle, une
  // tâche créée sous « Aujourd'hui » serait aussitôt filtrée hors de la vue).
  const defaultListeId = listeId !== "toutes" ? listeId : undefined;
  const defaultEcheance = echeanceParDefaut(vue, aujourdhui);

  // Point d'entrée après une création par le FAB. Les filtres de l'utilisateur ne sont jamais modifiés : si
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

  const nbFiltresActifs = priorites.size;
  const trie = ordre !== "manuel";
  const nbEnRetard = useMemo(
    () => (taches ?? []).filter((t) => !t.fait && t.echeance !== null && t.echeance < aujourdhui).length,
    [taches, aujourdhui]
  );
  const listeActive = listeId !== "toutes" ? listes.find((l) => l.id === listeId) : undefined;
  // Résumé du filtre actif, visible même panneau replié : on voit tout de suite
  // pourquoi la liste est plus courte que prévu.
  const resumeFiltres = [
    listeActive ? listeActive.nom : null,
    nbFiltresActifs > 0 ? `${nbFiltresActifs} priorité${nbFiltresActifs > 1 ? "s" : ""}` : null,
    trie ? `trié par ${ORDRES.find((o) => o.value === ordre)?.label.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const libelleVue = VUES.find((v) => v.key === vue)?.label ?? "";
  const filtresReinitialisables = listeId !== "toutes" || nbFiltresActifs > 0 || ordre !== "manuel";
  function reinitialiserFiltres() {
    setListeId("toutes");
    setPriorites(new Set());
    setOrdre("manuel");
  }
  const toutSelectionnable = filtered.filter((t) => !t.fait).map((t) => t.id);
  // Même action que le « + » flottant : on déclenche son bouton plutôt que de
  // dupliquer l'ouverture de la feuille (QuickAddFab porte l'état d'ouverture).
  const boutonAjout = (
    <button
      type="button"
      onClick={() => document.querySelector<HTMLButtonElement>('button[aria-label="Nouvelle tâche"]')?.click()}
      className={`${ghostButton} mx-auto mt-2`}
    >
      Ajouter une tâche
    </button>
  );
  const messageVide =
    vue === "en_retard" ? (
      <>Rien en retard. Tout est à jour.</>
    ) : filtresReinitialisables ? (
      <>
        <p>Aucune tâche avec ces filtres.</p>
        <button type="button" onClick={reinitialiserFiltres} className={`${textButton} mx-auto`}>
          Réinitialiser les filtres
        </button>
      </>
    ) : vue === "aujourdhui" ? (
      <>
        <p>Rien de prévu aujourd’hui.</p>
        {nbEnRetard > 0 && (
          <button type="button" onClick={() => setVue("en_retard")} className={`${textButton} mx-auto`}>
            {nbEnRetard} en retard : les voir
          </button>
        )}
        {boutonAjout}
      </>
    ) : vue === "semaine" ? (
      <>
        <p>Rien de prévu dans les 7 prochains jours.</p>
        {boutonAjout}
      </>
    ) : (
      <>
        <p>Aucune tâche pour l’instant.</p>
        {boutonAjout}
      </>
    );

  return (
    <>
    <PullToRefresh onRefresh={handleRefresh}>
    {/* pb-12 : dégage les dernières cartes (boutons « Modifier / Suppr. » à
        droite) du FAB, posé au-dessus de la barre du bas. */}
    <div className={`flex flex-col gap-4 ${selection ? "pb-52" : "pb-12"}`}>
      {/* Contrôle segmenté partagé (T7) : actif en vert Kcal au lieu de
          l'ancien jaune Glucides (One Accent Rule, 2,2:1 en sombre). */}
      <SegmentedControl
        ariaLabel="Vue des tâches"
        taille="sm"
        className="[&>button]:min-w-0"
        options={VUES.map((v) => ({
          value: v.key,
          label: v.key === "en_retard" && nbEnRetard > 0 ? `${v.label} · ${nbEnRetard}` : v.label,
        }))}
        value={vue}
        onChange={setVue}
      />

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">{SEARCH_ICON}</span>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une tâche…"
          aria-label="Rechercher une tâche"
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

      {/* Annonce le nombre de tâches affichées aux lecteurs d'écran (recherche, filtres). */}
      <p role="status" className="sr-only">
        {etatListe === "liste" ? `${filtered.length} tâche${filtered.length > 1 ? "s" : ""} affichée${filtered.length > 1 ? "s" : ""}` : ""}
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setFiltresOuverts((o) => !o)}
            aria-expanded={filtresOuverts}
            aria-controls="taches-filtres"
            className={`${ghostButton} min-w-0 flex-1 justify-start text-left`}
          >
            <span className="block min-w-0 truncate">
              Filtres et tri
              {resumeFiltres && <span className="ml-1 text-ink-3">· {resumeFiltres}</span>}
            </span>
          </button>
          {/* Hors du panneau : la gestion des listes reste à un tap, sans ouvrir les filtres. */}
          <Link href="/taches/listes" className={`${ghostButton} shrink-0`}>
            Listes
          </Link>
          <button
            type="button"
            onClick={() => (selection ? quitterSelection() : setSelection(true))}
            aria-pressed={selection}
            className={`${ghostButton} shrink-0`}
          >
            {selection ? "Fermer" : "Sélectionner"}
          </button>
        </div>
        {/* Toujours dans le DOM (hidden) : aria-controls pointe vers un élément réel. */}
        <div id="taches-filtres" hidden={!filtresOuverts} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-semibold text-ink-2">Liste</span>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par liste">
              {[{ id: "toutes", nom: "Toutes", couleur: null as string | null }, ...listes].map((liste) => {
                const actif = listeId === liste.id;
                return (
                  <button
                    key={liste.id}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setListeId(liste.id)}
                    className={`relative flex min-h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-2xl border px-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                      actif ? "border-kcal bg-kcal-soft" : "border-line bg-surface"
                    }`}
                  >
                    {liste.id !== "toutes" && (
                      <span
                        className="h-[9px] w-[9px] rounded-full"
                        style={{ background: liste.couleur ?? "var(--ink-3)" }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-label font-semibold text-ink">{liste.nom}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-semibold text-ink-2">Priorité</span>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par priorité">
              {FILTRES_PRIORITE.map((f) => {
                const actif = priorites.has(f.value);
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => basculerPriorite(f.value)}
                    className={`relative after:absolute after:inset-x-0 after:-inset-y-1.5 min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-small font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                      actif ? "border-kcal bg-kcal-soft text-ink" : "border-line bg-surface text-ink-2"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-semibold text-ink-2">Trier</span>
            <SegmentedControl
              ariaLabel="Trier les tâches"
              taille="sm"
              options={ORDRES.map((o) => ({ value: o.value, label: o.label }))}
              value={ordre}
              onChange={setOrdre}
            />
          </div>
          {filtresReinitialisables && (
            <button type="button" onClick={reinitialiserFiltres} className={`${textButton} self-start`}>
              Réinitialiser
            </button>
          )}
        </div>
      </div>

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
        <ErrorInline message="Impossible de charger les tâches." retry={() => refetchTaches()} />
      ) : recherche.trim() && filtered.length === 0 ? (
        <p className="py-6 text-center text-label text-ink-2">
          Aucune tâche ne correspond à « {recherche.trim()} »
          {vue !== "toutes" || listeActive ? ` dans ${[vue !== "toutes" ? libelleVue : null, listeActive?.nom ?? null].filter(Boolean).join(" · ")}` : ""}.
        </p>
      ) : (
        <TasksList
          taches={filtered}
          listes={listes}
          tags={tags}
          messageVide={messageVide}
          reordonnable={reordonnable}
          grouperParJour={vue === "semaine"}
          highlightedId={tacheSurlignee}
          selectionMode={selection}
          selectionIds={selectionVisible}
          onToggleSelect={basculerSelection}
        />
      )}
    </div>
    </PullToRefresh>
    {/* Hors de PullToRefresh : ni le bouton ni sa feuille de saisie ne doivent
        partager les gestes tactiles du tirer-pour-rafraîchir. */}
    {selection && (
      <SelectionBar
        ids={selectionVisible}
        taches={taches ?? []}
        listes={listes}
        toutesLesIds={toutSelectionnable}
        onToutSelectionner={(ids) => setSelectionIds(new Set(ids))}
        onDone={quitterSelection}
      />
    )}
    {!selection && (
      <QuickAddFab
        directTask={{ defaultListeId, defaultEcheance, onCreated: handleCreated }}
      />
    )}
    </>
  );
}
