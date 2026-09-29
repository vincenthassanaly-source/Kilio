"use client";

import { useId, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addNoteItem,
  createNote,
  deleteNoteItem,
  reorderNoteItems,
  toggleNoteItem,
  updateNote,
  updateNoteItemLibelle,
  type NoteAvecRelations,
  type NoteFormState,
} from "@/app/actions/notes";
import { queryKeys } from "@/lib/query/keys";
import { runAction } from "@/lib/actions/runAction";
import { showToast } from "@/components/toast/toast-store";
import { vibrate } from "@/lib/haptics";
import type { Enums, Tables } from "@/lib/supabase/types";
import { NOTE_PALETTE, estCouleurValide, type NoteCouleur } from "@/lib/notes/palette";
import { CheckToggle } from "@/components/CheckToggle";
import { errorText, ghostButton, input, label as labelClass, primaryButton } from "@/lib/ui";
import { SegmentedControl } from "@/components/SegmentedControl";

const initialState: NoteFormState = { error: null };

// Éditeur d'items persistés en direct (note existante, id déjà connu) :
// chaque action (toggle/renommer/réordonner/supprimer) part immédiatement
// via startTransition, indépendamment du bouton "Enregistrer" du formulaire
// — même pattern que SousTachesList dans src/app/(app)/taches/TasksList.tsx.
function NoteItemsEditor({ noteId, items }: { noteId: string; items: Tables<"note_items">[] }) {
  const [nouvelItem, setNouvelItem] = useState("");
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.notes });
  }

  // Même pattern optimiste que NoteCard.itemMutation (hors formulaire) :
  // sans lui, cocher un item ici n'était visuellement réactif qu'après un
  // aller-retour serveur complet, alors que le même geste sur la tuile est
  // instantané (CLICK-PATH-602).
  const toggleMutation = useMutation({
    mutationFn: ({ itemId, coche }: { itemId: string; coche: boolean }) => {
      vibrate();
      return toggleNoteItem(itemId, coche);
    },
    onMutate: async ({ itemId, coche }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes });
      const previous = queryClient.getQueryData<NoteAvecRelations[]>(queryKeys.notes);
      queryClient.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
        old?.map((n) =>
          n.id === noteId
            ? { ...n, items: n.items.map((i) => (i.id === itemId ? { ...i, coche } : i)) }
            : n
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.notes, context.previous);
      showToast("L'item n'a pas pu être coché. Réessaie.");
    },
    onSettled: invalidate,
  });

  // Contrat T1 : chaque écriture passe par `runAction`, qui transforme une
  // exception (réseau, serveur) en toast `role="alert"` au lieu de faire
  // basculer tout l'éditeur sur error.tsx.
  function executer(action: () => Promise<unknown>, erreur: string, onOk?: () => void) {
    startTransition(async () => {
      const resultat = await runAction(action, { erreur });
      if (resultat.ok) {
        onOk?.();
        invalidate();
      }
    });
  }

  function ajouter() {
    const trimmed = nouvelItem.trim();
    if (!trimmed) return;
    // Champ vidé seulement après succès : un échec garde la saisie.
    executer(() => addNoteItem(noteId, trimmed), "L'item n'a pas pu être ajouté. Réessaie.", () =>
      setNouvelItem("")
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <CheckToggle
            checked={item.coche}
            onToggle={() => toggleMutation.mutate({ itemId: item.id, coche: !item.coche })}
            label={item.coche ? "Décocher l'item" : "Cocher l'item"}
            size={20}
            // `flex flex-col gap-1.5` (6px) entre lignes : hitSlop réduit, voir
            // reports/2026-09-16-fix-dashboard-audit-constats-1-2.md.
            hitSlop={2}
          />
          <input
            defaultValue={item.libelle}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value && value !== item.libelle) {
                executer(
                  () => updateNoteItemLibelle(item.id, value),
                  "Le renommage n'a pas pu être enregistré. Réessaie."
                );
              }
            }}
            className={`${input} flex-1 py-1.5 ${item.coche ? "text-ink-3 line-through" : ""}`}
          />
          <button
            type="button"
            disabled={isPending || index === 0}
            onClick={() =>
              executer(() => reorderNoteItems(noteId, item.id, "haut"), "L'ordre n'a pas pu être modifié. Réessaie.")
            }
            className={`${ghostButton} disabled:opacity-30`}
            aria-label="Monter l'item"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isPending || index === items.length - 1}
            onClick={() =>
              executer(() => reorderNoteItems(noteId, item.id, "bas"), "L'ordre n'a pas pu être modifié. Réessaie.")
            }
            className={`${ghostButton} disabled:opacity-30`}
            aria-label="Descendre l'item"
          >
            ↓
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              executer(() => deleteNoteItem(item.id), `Impossible de supprimer « ${item.libelle} ». Réessaie.`)
            }
            className={ghostButton}
            aria-label="Supprimer l'item"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={nouvelItem}
          onChange={(e) => setNouvelItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Ajouter un item…"
          className={`${input} flex-1 py-1.5`}
        />
        <button type="button" onClick={ajouter} className={ghostButton}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

// Éditeur d'items locaux (création : pas encore d'id de note pour appeler
// addNoteItem) — soumis avec le formulaire via des inputs cachés
// "item_libelle", insérés en base par createNote au submit.
function NoteItemsDraft({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [nouvelItem, setNouvelItem] = useState("");

  function ajouter() {
    const trimmed = nouvelItem.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setNouvelItem("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((libelle, index) => (
        <div key={index} className="flex items-center gap-2">
          <input type="hidden" name="item_libelle" value={libelle} />
          <span className="flex-1 text-sm text-ink">{libelle}</span>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className={ghostButton}
            aria-label="Retirer l'item"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={nouvelItem}
          onChange={(e) => setNouvelItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Ajouter un item…"
          className={`${input} flex-1 py-1.5`}
        />
        <button type="button" onClick={ajouter} className={ghostButton}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

// Valeurs de départ d'une nouvelle note (ex. proposition de « Ajouter avec
// l'IA ») ; ignorées en édition, où la note existante fait foi.
export type NoteInitiale = {
  titre: string;
  type: Enums<"note_type">;
  contenu: string;
  items: string[];
  tagIds: string[];
  nouveauxTags: string[];
};

export function NoteForm({
  note,
  tags,
  onDone,
  initial,
}: {
  note?: NoteAvecRelations;
  tags: Tables<"tags">[];
  onDone?: () => void;
  initial?: NoteInitiale;
}) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const action = note ? updateNote : createNote;
  const [state, formAction, pending] = useActionState(action, initialState);
  const prevPending = useRef(pending);

  const [type, setType] = useState<Enums<"note_type">>(note?.type ?? initial?.type ?? "texte");
  const [couleur, setCouleur] = useState<NoteCouleur | null>(
    note?.couleur && estCouleurValide(note.couleur) ? note.couleur : null
  );
  const [tagIds, setTagIds] = useState<string[]>(note?.tags.map((t) => t.id) ?? initial?.tagIds ?? []);
  const [draftItems, setDraftItems] = useState<string[]>(initial?.items ?? []);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      onDone?.();
    }
    prevPending.current = pending;
  }, [pending, state.error, onDone]);

  function toggleTag(id: string) {
    setTagIds((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {note && <input type="hidden" name="id" value={note.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="couleur" value={couleur ?? ""} />
      {tagIds.map((id) => (
        <input key={id} type="hidden" name="tag_ids" value={id} />
      ))}

      {!note && (
        <SegmentedControl
          ariaLabel="Type de note"
          taille="sm"
          options={[
            { value: "texte", label: "Texte" },
            { value: "checklist", label: "Checklist" },
          ]}
          value={type}
          onChange={setType}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-titre`} className={labelClass}>
          Titre
        </label>
        <input id={`${uid}-titre`} name="titre" required defaultValue={note?.titre ?? initial?.titre} className={input} />
      </div>

      {type === "texte" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-contenu`} className={labelClass}>
            Contenu
          </label>
          <textarea
            id={`${uid}-contenu`}
            name="contenu"
            rows={note ? 12 : 5}
            defaultValue={note?.contenu ?? initial?.contenu}
            className={input}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Items</span>
          {note ? (
            <NoteItemsEditor noteId={note.id} items={note.items} />
          ) : (
            <NoteItemsDraft items={draftItems} onChange={setDraftItems} />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className={labelClass}>Couleur</span>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setCouleur(null)}
            aria-label="Aucune couleur"
            className={`relative after:absolute after:-inset-1.5 h-7 w-7 rounded-full border-2 bg-surface ${
              couleur === null ? "border-kcal" : "border-line"
            }`}
          />
          {NOTE_PALETTE.map((c) => (
            <button
              key={c.cle}
              type="button"
              onClick={() => setCouleur(c.cle)}
              aria-label={c.label}
              className={`relative after:absolute after:-inset-1.5 h-7 w-7 rounded-full border-2 ${
                couleur === c.cle ? "border-kcal" : "border-transparent"
              }`}
              style={{ backgroundColor: `var(--note-${c.cle})` }}
            />
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  tagIds.includes(tag.id) ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
                }`}
              >
                #{tag.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-nouveaux_tags`} className={labelClass}>
          Nouveaux tags (optionnel, séparés par une virgule)
        </label>
        <input
          id={`${uid}-nouveaux_tags`}
          name="nouveaux_tags"
          defaultValue={initial?.nouveauxTags.join(", ")}
          placeholder="perso, idées"
          className={input}
        />
      </div>

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Enregistrement..." : note ? "Enregistrer" : "Créer la note"}
      </button>
    </form>
  );
}
