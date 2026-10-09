"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteNote,
  noteItemVersTache,
  noteVersTache,
  toggleEpingle,
  toggleNoteItem,
  type NoteAvecRelations,
} from "@/app/actions/notes";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import { noteBackgroundStyle } from "@/lib/notes/palette";
import { CheckToggle } from "@/components/CheckToggle";
import { Modal } from "@/components/Modal";
import { useBackClose } from "@/hooks/useBackClose";
import type { Tables } from "@/lib/supabase/types";
import { card, dangerButton, ghostButton, linkButton, nameText, pillTag, primaryButton } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";

const NoteForm = dynamic(() => import("./NoteForm").then((m) => m.NoteForm), { ssr: false });

const ITEMS_PREVIEW_LIMIT = 6;

function couleurTagStyle(couleur: string | null) {
  if (!couleur) return undefined;
  return { backgroundColor: `${couleur}1a`, color: couleur };
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

export function NoteCard({ note, tags }: { note: NoteAvecRelations; tags: Tables<"tags">[] }) {
  // Lecture et édition s'ouvrent dans une feuille plein largeur (Modal) : la
  // tuile est une colonne de ~half-écran, trop étroite pour lire ou éditer.
  const [mode, setMode] = useState<"closed" | "view" | "edit">("closed");
  const reduceMotion = useReducedMotion() ?? false;
  const queryClient = useQueryClient();
  useBackClose(mode !== "closed", () => setMode("closed"));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.notes });
  }

  // Épingler et cocher un item de checklist sont les actions les plus
  // fréquentes sur une note existante : mise à jour optimiste du cache,
  // rollback silencieux + toast discret en cas d'échec serveur.
  const pinMutation = useMutation({
    mutationFn: () => {
      vibrate();
      return toggleEpingle(note.id, !note.epingle);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes });
      // Snapshot d'un seul champ (pas de tout le tableau, CLICK-PATH-603) :
      // le rollback d'un échec ici ne doit pas effacer une mutation sœur
      // indépendante (ex. un item coché sur une autre note) déjà appliquée
      // au cache entre-temps.
      const previousEpingle = note.epingle;
      queryClient.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
        old?.map((n) => (n.id === note.id ? { ...n, epingle: !n.epingle } : n))
      );
      return { previousEpingle };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
          old?.map((n) => (n.id === note.id ? { ...n, epingle: context.previousEpingle } : n))
        );
      }
      showToast("Impossible de mettre à jour la note.");
    },
    onSettled: invalidate,
  });

  const itemMutation = useMutation({
    mutationFn: async ({ itemId, coche }: { itemId: string; coche: boolean }) => {
      vibrate();
      try {
        await toggleNoteItem(itemId, coche);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("notes", "toggleNoteItem", [itemId, coche]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
      }
    },
    onMutate: async ({ itemId, coche }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes });
      // Idem pinMutation : snapshot du seul item touché, pas de la note (et
      // encore moins de tout le tableau) entière (CLICK-PATH-603).
      const previousCoche = note.items.find((i) => i.id === itemId)?.coche ?? !coche;
      queryClient.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
        old?.map((n) =>
          n.id === note.id
            ? { ...n, items: n.items.map((i) => (i.id === itemId ? { ...i, coche } : i)) }
            : n
        )
      );
      return { itemId, previousCoche };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
          old?.map((n) =>
            n.id === note.id
              ? {
                  ...n,
                  items: n.items.map((i) => (i.id === context.itemId ? { ...i, coche: context.previousCoche } : i)),
                }
              : n
          )
        );
      }
      showToast("Impossible de mettre à jour l'item.");
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await deleteNote(note.id);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("notes", "deleteNote", [note.id]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes });
      const previous = queryClient.getQueryData<NoteAvecRelations[]>(queryKeys.notes);
      queryClient.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
        old?.filter((n) => n.id !== note.id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.notes, context.previous);
      showToast("Impossible de supprimer la note.");
    },
    onSettled: invalidate,
  });

  // Note (ou élément) → tâche : un tap, sans formulaire. La note reste telle quelle.
  const [creationEnCours, setCreationEnCours] = useState(false);
  async function creerTache(creation: () => ReturnType<typeof noteVersTache>) {
    if (creationEnCours) return;
    setCreationEnCours(true);
    const resultat = await runAction(creation, { erreur: "Impossible de créer la tâche. Réessaie." });
    setCreationEnCours(false);
    if (!resultat.ok) return;
    showToast("Tâche créée");
    void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
  }

  function supprimer() {
    if (!confirmDelete(`Supprimer la note « ${note.titre} » ?`)) return;
    setMode("closed");
    deleteMutation.mutate();
  }

  const itemsCoches = note.items.filter((i) => i.coche).length;
  const progression = note.items.length > 0 ? Math.round((itemsCoches / note.items.length) * 100) : 0;
  const itemsAffiches = note.items.slice(0, ITEMS_PREVIEW_LIMIT);
  const itemsRestants = note.items.length - itemsAffiches.length;

  // `active:scale` ajouté ici localement (pas dans `card` de ui.ts, utilisé
  // ailleurs comme conteneur de groupe/formulaire — voir ui.ts) : cette
  // tuile est la seule utilisation de `card` visée par ce chantier.
  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
      className={`${card} mb-3 flex flex-col gap-2 break-inside-avoid transition active:scale-[0.97]`}
      style={noteBackgroundStyle(note.couleur)}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setMode("view")}
          aria-label={`Ouvrir la note ${note.titre}`}
          className={`${nameText} min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal rounded-md`}
        >
          {note.titre}
        </button>
        <button
          type="button"
          disabled={pinMutation.isPending}
          onClick={() => pinMutation.mutate()}
          aria-label={note.epingle ? "Désépingler" : "Épingler"}
          // Épingle de 18 px : zone de tap étendue à 44 px (T6) et focus visible.
          className={`relative -m-1 shrink-0 rounded-lg p-1 after:absolute after:-inset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${note.epingle ? "text-kcal" : "text-ink-3"}`}
        >
          <PinIcon filled={note.epingle} />
        </button>
      </div>

      {note.type === "texte" ? (
        note.contenu && (
          <button
            type="button"
            onClick={() => setMode("view")}
            tabIndex={-1}
            aria-hidden="true"
            className="text-left"
          >
            <p className="line-clamp-6 whitespace-pre-wrap text-sm text-ink-2">{note.contenu}</p>
          </button>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {note.items.length > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
              <div className="h-full rounded-full bg-kcal" style={{ width: `${progression}%` }} />
            </div>
          )}
          {itemsAffiches.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <CheckToggle
                checked={item.coche}
                onToggle={() => itemMutation.mutate({ itemId: item.id, coche: !item.coche })}
                label={item.coche ? "Décocher l'item" : "Cocher l'item"}
                size={18}
                // `flex flex-col gap-1.5` (6px) entre lignes : hitSlop réduit, voir
                // reports/2026-09-16-fix-dashboard-audit-constats-1-2.md.
                hitSlop={2}
              />
              <span className={`text-sm ${item.coche ? "text-ink-3 line-through" : "text-ink-2"}`}>
                {item.libelle}
              </span>
            </div>
          ))}
          {itemsRestants > 0 && (
            <button type="button" onClick={() => setMode("view")} className="self-start text-xs text-ink-3">
              +{itemsRestants} autres
            </button>
          )}
        </div>
      )}

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {note.tags.map((tag) => (
            <span key={tag.id} className={pillTag} style={couleurTagStyle(tag.couleur)}>
              #{tag.nom}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setMode("edit")} className={ghostButton}>
          Modifier
        </button>
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={supprimer}
          className={dangerButton}
        >
          Suppr.
        </button>
      </div>

      <AnimatePresence>
        {mode === "view" && (
          <Modal key="lecture" title={note.titre} onClose={() => setMode("closed")}>
            <div className="flex flex-col gap-4">
              {note.type === "texte" ? (
                note.contenu ? (
                  <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-ink">{note.contenu}</p>
                ) : (
                  <p className="text-sm text-ink-3">Note vide.</p>
                )
              ) : (
                <div className="flex flex-col gap-3">
                  {note.items.length > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                      <div className="h-full rounded-full bg-kcal" style={{ width: `${progression}%` }} />
                    </div>
                  )}
                  {note.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <CheckToggle
                        checked={item.coche}
                        onToggle={() => itemMutation.mutate({ itemId: item.id, coche: !item.coche })}
                        label={item.coche ? "Décocher l'item" : "Cocher l'item"}
                        size={22}
                        hitSlop={6}
                      />
                      <span className={`min-w-0 flex-1 text-base ${item.coche ? "text-ink-3 line-through" : "text-ink"}`}>
                        {item.libelle}
                      </span>
                      <button
                        type="button"
                        disabled={creationEnCours}
                        onClick={() => creerTache(() => noteItemVersTache(item.id))}
                        aria-label={`Créer une tâche : ${item.libelle}`}
                        className={`${linkButton} shrink-0`}
                      >
                        → Tâche
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {note.tags.map((tag) => (
                    <span key={tag.id} className={pillTag} style={couleurTagStyle(tag.couleur)}>
                      #{tag.nom}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={creationEnCours}
                onClick={() => creerTache(() => noteVersTache(note.id))}
                className={ghostButton}
              >
                Créer une tâche depuis cette note
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMode("edit")} className={`${primaryButton} flex-1`}>
                  Modifier
                </button>
                <button type="button" onClick={supprimer} className={dangerButton}>
                  Supprimer
                </button>
              </div>
            </div>
          </Modal>
        )}
        {mode === "edit" && (
          <Modal key="edition" title="Modifier la note" onClose={() => setMode("closed")}>
            <NoteForm
              note={note}
              tags={tags}
              onDone={() => {
                setMode("closed");
                invalidate();
              }}
            />
            <button type="button" onClick={() => setMode("closed")} className="mt-2 text-sm text-ink-2 underline">
              Annuler
            </button>
          </Modal>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
