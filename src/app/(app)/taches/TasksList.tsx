"use client";

import { memo, useCallback, useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createSousTache,
  deleteSousTache,
  deleteTache,
  enregistrerOrdreTaches,
  reordonnerSousTaches,
  toggleSousTache,
  setTacheFait,
  type TacheAvecRelations,
} from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import type { Enums, Tables } from "@/lib/supabase/types";
import { card, dangerButton, ghostButton, input, kcalPillTag, listCard, metaText, pillTag, zoneTapPill } from "@/lib/ui";
import { runAction } from "@/lib/actions/runAction";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import type { ActionResult } from "@/lib/actions/result";
import { confirmDelete } from "@/lib/confirm";
import { CheckToggle } from "@/components/CheckToggle";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useBackClose } from "@/hooks/useBackClose";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";

const AddTaskForm = dynamic(() => import("./AddTaskForm").then((m) => m.AddTaskForm), { ssr: false });

function formatEcheance(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const PRIORITE_LABELS: Record<Enums<"priorite_tache">, string> = {
  aucune: "Aucune",
  basse: "Basse",
  moyenne: "Moyenne",
  haute: "Haute",
};

// Réutilise les couleurs de module existantes (accent-agenda/carbs/alert)
// plutôt que d'en introduire de nouvelles : basse = bleu (calme), moyenne =
// orange, haute = rouge/alerte.
const PRIORITE_BADGE: Record<Enums<"priorite_tache">, string> = {
  aucune: "",
  basse: "bg-agenda/10 text-agenda",
  moyenne: "bg-carbs/10 text-carbs",
  haute: "bg-alert/10 text-alert",
};

function couleurStyle(couleur: string | null): React.CSSProperties | undefined {
  if (!couleur) return undefined;
  return { backgroundColor: `${couleur}1a`, color: couleur };
}

// Accent de carte par couleur de liste (Agenda uniquement, cf. prop
// `colorByListe` de TaskCard) : fond très clair (même opacité que
// couleurStyle) + bordure plus marquée pour se distinguer du fond d'écran
// en thème sombre, sans écraser les classes `listCard` (forme/ombre).
// Pas de couleur de liste (ex. "Général") -> undefined, on garde le
// `bg-surface`/`border-line` par défaut de `listCard`.
function carteAccentStyle(couleur: string | null | undefined): React.CSSProperties | undefined {
  if (!couleur) return undefined;
  return { backgroundColor: `${couleur}1a`, borderColor: `${couleur}4d` };
}

// Poignée de drag dédiée (6 points), plutôt qu'une carte entière
// "appui long" comme les tuiles de la page d'accueil : sur une LISTE
// VERTICALE, le geste de drag (déplacer haut/bas) est sur le même axe que
// le scroll de la page, contrairement à une grille 2D où pan-y peut laisser
// le scroll vertical natif cohabiter avec le drag (cf. commentaire
// touchAction dans ModulesGrid.tsx). Poser `touchAction: "none"` sur la
// carte entière bloquerait tout scroll dès qu'un doigt touche une tâche ;
// le limiter à cette petite poignée laisse le reste de la carte
// scrollable normalement.
const GRIP_ICON = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="3" r="1.3" />
    <circle cx="11" cy="3" r="1.3" />
    <circle cx="5" cy="8" r="1.3" />
    <circle cx="11" cy="8" r="1.3" />
    <circle cx="5" cy="13" r="1.3" />
    <circle cx="11" cy="13" r="1.3" />
  </svg>
);

// Boutons de ligne des sous-tâches : zone de tap de 44 px de haut (au lieu
// des glyphes nus d'environ 10×24 px relevés par l'audit), anneau de focus.
const sousTacheBouton =
  "flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-base disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

function SousTachesList({ tache }: { tache: TacheAvecRelations }) {
  const [isPending, startTransition] = useTransition();
  const [titre, setTitre] = useState("");
  // Sous-tâches masquées le temps du toast « Annuler » (suppression différée).
  const [masquees, setMasquees] = useState<ReadonlySet<string>>(() => new Set());
  const queryClient = useQueryClient();
  const visibles = tache.sous_taches.filter((s) => !masquees.has(s.id));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.taches });
  }

  // Contrat T1 : `runAction` ne laisse jamais une erreur remonter à
  // error.tsx ; l'échec s'affiche en toast `role="alert"`.
  function executer(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const resultat = await runAction(action);
      if (resultat.ok) invalidate();
    });
  }

  function handleAjouter(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = titre.trim();
    if (!trimmed) return;
    // Le champ n'est vidé qu'après succès : un échec garde la saisie.
    startTransition(async () => {
      const resultat = await runAction(() => createSousTache(tache.id, trimmed));
      if (resultat.ok) {
        setTitre("");
        invalidate();
      }
    });
  }

  function handleSupprimer(sousTache: Tables<"sous_taches">) {
    supprimerAvecAnnulation({
      texte: `« ${sousTache.titre} » supprimée`,
      ariaLabel: `Annuler la suppression de « ${sousTache.titre} »`,
      masquer: () => setMasquees((m) => new Set(m).add(sousTache.id)),
      restaurer: () =>
        setMasquees((m) => {
          const suivant = new Set(m);
          suivant.delete(sousTache.id);
          return suivant;
        }),
      supprimer: () => deleteSousTache(sousTache.id),
      erreur: `Impossible de supprimer « ${sousTache.titre} ». Réessaie.`,
      onSupprime: invalidate,
    });
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5 border-t border-line pt-2">
      {visibles.length > 0 && (
        <ul className="flex flex-col">
          {visibles.map((sousTache, index) => (
            <li key={sousTache.id} className="flex items-center gap-1">
              <CheckToggle
                checked={sousTache.fait}
                disabled={isPending}
                onToggle={() => executer(() => toggleSousTache(sousTache.id, !sousTache.fait))}
                size={17}
                label={sousTache.fait ? "Marquer non fait" : "Marquer fait"}
                // Lignes de 44 px : la zone de tap du CheckToggle n'a plus
                // besoin d'être étendue au-delà (voir
                // reports/2026-09-16-fix-dashboard-audit-constats-1-2.md).
                hitSlop={1}
              />
              <span
                className={`ml-1 min-w-0 flex-1 break-words text-[13.5px] ${
                  sousTache.fait ? "text-ink-2 line-through" : "text-ink"
                }`}
              >
                {sousTache.titre}
              </span>
              <button
                type="button"
                disabled={isPending || index === 0}
                onClick={() => executer(() => reordonnerSousTaches(tache.id, sousTache.id, "haut"))}
                className={`${sousTacheBouton} text-ink-2`}
                aria-label={`Monter « ${sousTache.titre} »`}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={isPending || index === visibles.length - 1}
                onClick={() => executer(() => reordonnerSousTaches(tache.id, sousTache.id, "bas"))}
                className={`${sousTacheBouton} text-ink-2`}
                aria-label={`Descendre « ${sousTache.titre} »`}
              >
                ↓
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSupprimer(sousTache)}
                className={`${sousTacheBouton} text-alert`}
                aria-label={`Supprimer « ${sousTache.titre} »`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAjouter} className="flex gap-2">
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="+ Sous-tâche…"
          aria-label="Nouvelle sous-tâche"
          name="sous-tache"
          autoComplete="off"
          className={`${input} min-h-11 flex-1 py-2 text-base`}
        />
        <button
          type="submit"
          disabled={isPending || !titre.trim()}
          className="min-h-11 rounded-xl px-2 text-sm font-semibold text-kcal disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          {isPending ? "Ajout…" : "Ajouter"}
        </button>
      </form>
    </div>
  );
}

function TacheImagesRow({ tache }: { tache: TacheAvecRelations }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (tache.images.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-0.5">
        {tache.images.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setLightboxSrc(image.url)}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line"
            aria-label="Agrandir l'image"
          >
            <Image src={image.url} alt="" width={56} height={56} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  );
}

export const TaskCard = memo(function TaskCard({
  tache,
  listes,
  tags,
  reorderable = false,
  colorByListe = false,
  highlighted = false,
}: {
  tache: TacheAvecRelations;
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  // Uniquement true depuis SortableTachesList (liste active en vue non
  // filtrée, cf. TasksList) : les tâches archivées ne sont jamais
  // réordonnables (leur affichage suit updated_at, pas ordre). useSortable
  // est appelé inconditionnellement (règle des Hooks) même quand
  // `reorderable` est false : hors DndContext/SortableContext, dnd-kit
  // retombe sur ses valeurs par défaut inertes (vérifié dans
  // node_modules/@dnd-kit/{core,sortable} — `defaultInternalContext` /
  // `Context` par défaut), donc sans effet ni erreur pour les usages
  // statiques (archivées, agenda).
  reorderable?: boolean;
  // Teinte le fond/la bordure de la carte avec la couleur de la liste de la
  // tâche (cf. couleurStyle) : uniquement utilisé par les 3 vues Agenda
  // (DayView, ListView, ArchivedTasksSection), où le fond des cartes se
  // confondait avec celui de l'écran en thème sombre. La page /taches garde
  // son rendu neutre habituel (valeur par défaut `false`).
  colorByListe?: boolean;
  // Tâche ciblée par un deep-link de notification (cf. AgendaView/DayView) :
  // scrollée en vue et mise en surbrillance temporairement à l'apparition.
  highlighted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  useBackClose(editing, () => setEditing(false));
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  // Bascule carte compacte <-> formulaire d'édition : cross-fade (comme
  // AnimatedAddCard) plutôt que `layout`, qui interpolerait les dimensions
  // très différentes des deux états et produirait un effet d'étirement.
  const editSwapTransition = reduceMotion ? { duration: 0 } : { duration: 0.18 };
  const editSwapInitial = reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 };
  const editSwapAnimate = { opacity: 1, scale: 1 };
  const editSwapExit = reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 };
  const queryClient = useQueryClient();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tache.id,
  });
  const highlightRef = useRef<HTMLLIElement | null>(null);
  // Variante `reorderable` : le <li> porte déjà le ref de dnd-kit, on y
  // ajoute celui de la surbrillance (un même nœud, deux consommateurs).
  const setReorderableRef = useCallback(
    (node: HTMLLIElement | null) => {
      setNodeRef(node);
      highlightRef.current = node;
    },
    [setNodeRef]
  );
  useEffect(() => {
    if (highlighted) {
      // Scroll instantané pour qui a demandé de réduire les animations.
      highlightRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    }
  }, [highlighted, reduceMotion]);

  function invalidateTaches() {
    queryClient.invalidateQueries({ queryKey: queryKeys.taches });
  }

  // Cocher/décocher est l'action la plus fréquente sur une tâche : mise à
  // jour optimiste du cache (le cercle bascule à l'instant du tap), rollback
  // silencieux + toast discret si le serveur échoue. La logique de
  // récurrence (échéance suivante) reste calculée côté serveur ; on ne
  // l'approxime pas ici, `onSettled` réconcilie avec l'état réel.
  // `networkMode: "always"` (ici et sur deleteMutation) : par défaut,
  // TanStack Query met une mutation en pause tant qu'il se croit hors ligne
  // (onMutate s'exécute, mutationFn jamais) : le repli Dexie ci-dessous n'était
  // alors jamais atteint, la coche restait en mémoire et se perdait si l'app
  // était fermée avant le retour du réseau. Ici mutationFn doit s'exécuter :
  // hors ligne, toggleTache échoue en erreur réseau et l'action est mise en
  // file (enqueueAction), rejouée au retour du réseau par useOnlineSync.
  const toggleMutation = useMutation({
    networkMode: "always",
    // `enfile` : l'action est partie en file hors ligne au lieu du serveur. Dans
    // ce cas on NE réactualise PAS depuis le serveur (voir onSettled) : il
    // n'a pas encore l'écriture et rétablirait l'ancien état à l'écran.
    // L'échéance vue est transmise au serveur : cocher une récurrente avance
    // l'échéance, la garde évite qu'une coche rejouée en avance une seconde fois.
    mutationFn: async (): Promise<{ enfile: boolean }> => {
      vibrate();
      const nextFait = !tache.fait;
      try {
        await setTacheFait(tache.id, nextFait, tache.echeance);
        return { enfile: false };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("taches", "setTacheFait", [tache.id, nextFait, tache.echeance]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
        return { enfile: true };
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.taches });
      const previous = queryClient.getQueryData<TacheAvecRelations[]>(queryKeys.taches);
      queryClient.setQueryData<TacheAvecRelations[]>(queryKeys.taches, (old) =>
        old?.map((t) => (t.id === tache.id ? { ...t, fait: !t.fait } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.taches, context.previous);
      showToast("Impossible de mettre à jour la tâche.");
    },
    // Action en file : l'état optimiste reste affiché jusqu'au rejeu, qui
    // invalide tout (Providers, useOnlineSync).
    onSettled: (resultat) => {
      if (!resultat?.enfile) invalidateTaches();
    },
  });

  const deleteMutation = useMutation({
    networkMode: "always",
    mutationFn: async (): Promise<{ enfile: boolean }> => {
      try {
        await deleteTache(tache.id);
        return { enfile: false };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("taches", "deleteTache", [tache.id]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
        return { enfile: true };
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.taches });
      const previous = queryClient.getQueryData<TacheAvecRelations[]>(queryKeys.taches);
      queryClient.setQueryData<TacheAvecRelations[]>(queryKeys.taches, (old) =>
        old?.filter((t) => t.id !== tache.id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.taches, context.previous);
      showToast("Impossible de supprimer la tâche.");
    },
    onSettled: (resultat) => {
      if (!resultat?.enfile) invalidateTaches();
    },
  });

  if (editing) {
    return (
      <AnimatePresence mode="wait" propagate>
        <motion.li
          key="edit"
          initial={editSwapInitial}
          animate={editSwapAnimate}
          exit={editSwapExit}
          transition={editSwapTransition}
          className={card}
        >
          <AddTaskForm
            tache={tache}
            listes={listes}
            tags={tags}
            onDone={() => {
              setEditing(false);
              invalidateTaches();
            }}
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="mt-2 text-sm text-ink-2 underline"
          >
            Annuler
          </button>
        </motion.li>
      </AnimatePresence>
    );
  }

  const sousTachesFaites = tache.sous_taches.filter((s) => s.fait).length;

  const content = (
    <>
      <div className="flex items-start gap-3">
        <CheckToggle
          checked={tache.fait}
          disabled={toggleMutation.isPending}
          onToggle={() => toggleMutation.mutate()}
          className="mt-0.5"
          label={tache.fait ? "Marquer non fait" : "Marquer fait"}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p
              className={`min-w-0 flex-1 whitespace-normal break-words text-[14.5px] font-semibold text-ink ${tache.fait ? "text-ink-2 line-through" : ""}`}
            >
              {tache.titre}
            </p>
            {tache.recurrence_frequence && (
              <span className="shrink-0 text-ink-2" title="Tâche récurrente">
                ↻
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {tache.liste && (
              <span className={pillTag} style={couleurStyle(tache.liste.couleur)}>
                {tache.liste.nom}
              </span>
            )}
            {tache.priorite !== "aucune" && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${PRIORITE_BADGE[tache.priorite]}`}
              >
                {PRIORITE_LABELS[tache.priorite]}
              </span>
            )}
            {tache.programme_jour && (
              <span className={kcalPillTag} title="Sera supprimée automatiquement si non cochée à la fin de la journée">
                Tâche du jour
              </span>
            )}
            {tache.tags.map((tag) => (
              <span key={tag.id} className={pillTag} style={couleurStyle(tag.couleur)}>
                #{tag.nom}
              </span>
            ))}
            <button type="button" onClick={() => setExpanded((v) => !v)} className={`${pillTag} ${zoneTapPill}`}>
              {tache.sous_taches.length > 0
                ? `${sousTachesFaites}/${tache.sous_taches.length}`
                : "+ sous-tâches"}
            </button>
          </div>

          {tache.notes && (
            <p className="whitespace-pre-wrap text-[13px] text-ink-2">{tache.notes}</p>
          )}

          {tache.echeance && (
            <span className={metaText}>
              Échéance : {formatEcheance(tache.echeance)}
              {tache.heure &&
                (tache.heure_fin
                  ? ` de ${tache.heure.slice(0, 5)} – ${tache.heure_fin.slice(0, 5)}`
                  : ` à ${tache.heure.slice(0, 5)}`)}
            </span>
          )}

          <TacheImagesRow tache={tache} />

          {expanded && <SousTachesList tache={tache} />}
        </div>
      </div>
      <div className={`flex items-center gap-2 ${reorderable ? "justify-between" : "justify-end"}`}>
        {reorderable && (
          <button
            type="button"
            className="relative after:absolute after:-inset-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-2"
            style={{ touchAction: "none", WebkitTouchCallout: "none" }}
            data-drag-handle
            aria-label="Réordonner : glisser pour déplacer la tâche"
            {...attributes}
            {...listeners}
          >
            {GRIP_ICON}
          </button>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
            Modifier
          </button>
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (!confirmDelete(`Supprimer la tâche « ${tache.titre} » ?`)) return;
              deleteMutation.mutate();
            }}
            className={dangerButton}
          >
            Suppr.
          </button>
        </div>
      </div>
    </>
  );

  const accentStyle = colorByListe ? carteAccentStyle(tache.liste?.couleur) : undefined;

  // Sans `reorderable` (tâches archivées, ou vue filtrée où le drag est
  // désactivé — voir TasksList) : carte statique, motion.li porte lui-même
  // l'animation d'entrée/sortie/layout.
  if (!reorderable) {
    return (
      <AnimatePresence mode="wait" propagate>
        <motion.li
          key="view"
          ref={highlightRef}
          id={highlighted ? `tache-${tache.id}` : undefined}
          layout={!reduceMotion}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          className={`${listCard} ${highlighted ? "tache-surbrillance" : ""}`}
          style={accentStyle}
        >
          {content}
        </motion.li>
      </AnimatePresence>
    );
  }

  // Avec `reorderable` : le <li> externe (non-motion) porte le transform
  // brut de dnd-kit pendant le drag ; un <motion.div> interne gère
  // l'animation d'entrée/sortie/layout des AUTRES tâches qui se décalent.
  // Superposer les deux systèmes de transform sur le même nœud les ferait
  // s'écraser l'un l'autre (framer-motion recalcule `style.transform` dès
  // qu'un `animate` avec `y` est actif) — d'où la séparation en deux nœuds.
  // `attributes`/`listeners` (déclencheurs du drag) sont posés sur la
  // poignée dans `content`, pas ici : voir GRIP_ICON plus haut.
  const dragStyle: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <AnimatePresence mode="wait" propagate>
      <li
        key="view"
        ref={setReorderableRef}
        id={highlighted ? `tache-${tache.id}` : undefined}
        style={dragStyle}
        className={isDragging ? "opacity-60" : undefined}
      >
        <motion.div
          layout={!isDragging && !reduceMotion}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          className={`${listCard} ${highlighted ? "tache-surbrillance" : ""}`}
          style={accentStyle}
        >
          {content}
        </motion.div>
      </li>
    </AnimatePresence>
  );
});

// Contrairement aux tuiles de la page d'accueil (appui long ~400ms sur
// toute la tuile, cf. NavigationEditContext), ici le drag part d'une
// poignée dédiée (GRIP_ICON) et non de la carte entière : sur une liste
// verticale, le drag (haut/bas) est sur le même axe que le scroll de la
// page, un appui long général aurait donc dû bloquer le scroll natif sur
// toute la carte (`touchAction: "none"`) pour être fiable — au prix de
// rendre le scroll impossible en touchant une tâche. La poignée isole ce
// `touchAction: "none"` à une petite zone, donc pas besoin d'un délai pour
// distinguer un tap normal d'un drag : un simple seuil de distance suffit
// (la poignée ne fait rien d'autre).
function useTaskDragSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
}

// Reproduit côté client les deux premières clés du tri serveur
// (`getTachesAvecRelations` : fait, ordre) pour que la mise à jour
// optimiste du cache après un drag reflète immédiatement le nouvel ordre
// visuel, sans attendre le refetch. `echeance`/`created_at` sont omis : ils
// ne changent jamais pendant un drag, donc ces deux clés suffisent à
// reproduire fidèlement l'ordre serveur dans ce cas précis. Pour les
// tâches faites (`fait: true`), on renvoie 0 plutôt que de comparer
// `ordre` : `Array.prototype.sort` étant stable, leur position relative
// dans le tableau en cache (déjà correcte) est préservée telle quelle.
function comparerPourAffichage(a: TacheAvecRelations, b: TacheAvecRelations) {
  if (a.fait !== b.fait) return a.fait ? 1 : -1;
  if (!a.fait) return a.ordre - b.ordre;
  return 0;
}

// Liste réordonnable au drag & drop. N'est utilisée que lorsque la vue
// affichée correspond exactement à l'ensemble complet des tâches actives de
// chaque liste concernée (voir `reordonnable` dans TachesView) : c'est ce
// qui permet de renuméroter l'ordre par liste_id à partir de la seule
// position visuelle post-drop, sans avoir à interroger les tâches masquées
// par un filtre de date.
function SortableTachesList({
  actives,
  listes,
  tags,
  highlightedId,
}: {
  actives: TacheAvecRelations[];
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  highlightedId?: string | null;
}) {
  const queryClient = useQueryClient();
  const sensors = useTaskDragSensors();

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = actives.findIndex((t) => t.id === active.id);
    const newIndex = actives.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordonnees = arrayMove(actives, oldIndex, newIndex);

    // Renumérote 0..n-1 par liste_id selon le nouvel ordre visuel ; ne
    // transmet que les tâches dont l'ordre change réellement.
    const compteurs = new Map<string, number>();
    const updates: { id: string; ordre: number }[] = [];
    for (const tache of reordonnees) {
      const n = compteurs.get(tache.liste_id) ?? 0;
      compteurs.set(tache.liste_id, n + 1);
      if (tache.ordre !== n) updates.push({ id: tache.id, ordre: n });
    }
    if (updates.length === 0) return;

    // Comme pour toggle/delete plus haut : annule tout refetch en vol avant
    // d'écrire l'optimiste, sinon une mutation concurrente sans rapport
    // (toggle d'une autre tâche) peut faire retomber la liste sur l'ordre
    // pré-drag une fois son propre refetch résolu (CLICK-PATH-303).
    await queryClient.cancelQueries({ queryKey: queryKeys.taches });

    const parOrdre = new Map(updates.map((u) => [u.id, u.ordre]));
    queryClient.setQueryData<TacheAvecRelations[]>(queryKeys.taches, (old) =>
      old
        ?.map((t) => (parOrdre.has(t.id) ? { ...t, ordre: parOrdre.get(t.id)! } : t))
        .sort(comparerPourAffichage)
    );

    try {
      await enregistrerOrdreTaches(updates);
    } catch {
      showToast("Échec de la réorganisation, réessaie.");
    } finally {
      // Réconcilie avec le serveur dans tous les cas, pas seulement l'échec :
      // rien d'autre n'invalidait après un enregistrerOrdreTaches réussi.
      queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={actives.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {actives.map((tache) => (
              <TaskCard
                key={tache.id}
                tache={tache}
                listes={listes}
                tags={tags}
                reorderable
                highlighted={tache.id === highlightedId}
              />
            ))}
          </AnimatePresence>
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function TasksList({
  taches,
  listes,
  tags,
  reordonnable = false,
  highlightedId = null,
}: {
  taches: TacheAvecRelations[];
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  reordonnable?: boolean;
  // Tâche à faire défiler en vue et surligner (création réussie, cf.
  // TachesView) ; uniquement pour les tâches actives.
  highlightedId?: string | null;
}) {
  if (taches.length === 0) {
    return <p className="text-ink-2">Aucune tâche pour l&apos;instant.</p>;
  }

  const actives = taches.filter((tache) => !tache.fait);
  // Trié par updated_at décroissant : proxy imparfait de la date de cochage
  // (updated_at change aussi si la tâche est éditée après coup), faute de
  // colonne dédiée type `fait_le`.
  const archivees = taches
    .filter((tache) => tache.fait)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));

  return (
    <>
      {actives.length > 0 &&
        (reordonnable ? (
          <SortableTachesList actives={actives} listes={listes} tags={tags} highlightedId={highlightedId} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {actives.map((tache) => (
                <TaskCard
                  key={tache.id}
                  tache={tache}
                  listes={listes}
                  tags={tags}
                  highlighted={tache.id === highlightedId}
                />
              ))}
            </AnimatePresence>
          </ul>
        ))}
      {archivees.length > 0 && (
        <details className={`${card} mt-2.5`}>
          <summary className="cursor-pointer text-[14.5px] font-semibold text-ink-2">
            Tâches archivées ({archivees.length})
          </summary>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {archivees.map((tache) => (
                <TaskCard key={tache.id} tache={tache} listes={listes} tags={tags} />
              ))}
            </AnimatePresence>
          </ul>
        </details>
      )}
    </>
  );
}
