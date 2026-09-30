"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotesAvecRelations } from "@/app/actions/notes";
import { getTags } from "@/app/actions/taches";
import { normalizeSearch } from "@/lib/normalize";
import { TAG_IDEES } from "@/lib/notes/saisie-naturelle";
import { queryKeys } from "@/lib/query/keys";
import { NoteCard } from "./NoteCard";
import { AddNoteToggle } from "./AddNoteToggle";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";
import { errorText, input, pillTag, sectionTitle } from "@/lib/ui";
import { PullToRefresh } from "@/components/PullToRefresh";

// Tag des idées (ajouté par « Ajouter avec l'IA ») : sa pastille passe en tête.
const CLE_TAG_IDEES = normalizeSearch(TAG_IDEES);

export function NotesGrid({ defaultOpen, defaultTag }: { defaultOpen?: boolean; defaultTag?: string }) {
  const [search, setSearch] = useState("");
  // `null` tant que l'utilisateur n'a pas touché aux pastilles : le préfiltre
  // du lien s'applique alors ; dès qu'il en bascule une, son choix prime.
  const [choixTags, setChoixTags] = useState<string[] | null>(null);
  const queryClient = useQueryClient();

  const { data: notes, isLoading, isError } = useQuery({
    queryKey: queryKeys.notes,
    queryFn: getNotesAvecRelations,
  });
  const { data: tags = [] } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });

  // `?tag=idees` : filtre actif dès que les tags sont chargés.
  const prefiltre = useMemo(() => {
    if (!defaultTag) return [];
    const cle = normalizeSearch(defaultTag);
    const tag = tags.find((t) => normalizeSearch(t.nom) === cle);
    return tag ? [tag.id] : [];
  }, [defaultTag, tags]);
  const tagFilter = choixTags ?? prefiltre;

  const tagsAffiches = useMemo(
    () =>
      [...tags].sort(
        (a, b) => Number(normalizeSearch(b.nom) === CLE_TAG_IDEES) - Number(normalizeSearch(a.nom) === CLE_TAG_IDEES)
      ),
    [tags]
  );

  function toggleTagFilter(id: string) {
    setChoixTags(tagFilter.includes(id) ? tagFilter.filter((t) => t !== id) : [...tagFilter, id]);
  }

  // Filtrage 100% côté client : titre + contenu + libellés des items
  // checklist + noms de tags. Pas de recherche full-text Postgres, le
  // volume de données mono-utilisateur ne le justifie pas (cf. prompt).
  const filtered = useMemo(() => {
    if (!notes) return [];
    const term = normalizeSearch(search);
    return notes.filter((note) => {
      const matchesSearch =
        term === "" ||
        normalizeSearch(note.titre).includes(term) ||
        normalizeSearch(note.contenu).includes(term) ||
        note.items.some((item) => normalizeSearch(item.libelle).includes(term)) ||
        note.tags.some((tag) => normalizeSearch(tag.nom).includes(term));
      const matchesTags =
        tagFilter.length === 0 || tagFilter.every((id) => note.tags.some((tag) => tag.id === id));
      return matchesSearch && matchesTags;
    });
  }, [notes, search, tagFilter]);

  const epinglees = filtered.filter((n) => n.epingle);
  const autres = filtered.filter((n) => !n.epingle);

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tags }),
    ]);
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-4">
      <AddNoteToggle
        tags={tags}
        defaultOpen={defaultOpen}
        onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.notes })}
      />

      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <p className={errorText}>Erreur de chargement des notes. Réessaie.</p>
      ) : !notes || notes.length === 0 ? (
        <p className="text-ink-2">Aucune note pour l&apos;instant.</p>
      ) : (
        <>
          <input
            type="search"
            placeholder="Rechercher une note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={input}
          />

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagsAffiches.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagFilter(tag.id)}
                  className={
                    tagFilter.includes(tag.id) ? `${pillTag} bg-kcal-soft text-kcal font-bold` : pillTag
                  }
                >
                  #{tag.nom}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="py-5 text-center text-sm text-ink-3">Aucune note ne correspond à ta recherche.</p>
          ) : (
            <>
              {epinglees.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className={sectionTitle}>Épinglées</p>
                  <ul className="columns-2 gap-3">
                    <AnimatePresence initial={false}>
                      {epinglees.map((note) => (
                        <NoteCard key={note.id} note={note} tags={tags} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              )}
              {autres.length > 0 && (
                <div className="flex flex-col gap-2">
                  {epinglees.length > 0 && <p className={sectionTitle}>Autres</p>}
                  <ul className="columns-2 gap-3">
                    <AnimatePresence initial={false}>
                      {autres.map((note) => (
                        <NoteCard key={note.id} note={note} tags={tags} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
    </PullToRefresh>
  );
}
