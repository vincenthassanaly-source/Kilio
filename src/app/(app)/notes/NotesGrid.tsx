"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotesAvecRelations, type NoteAvecRelations } from "@/app/actions/notes";
import { repartirEnColonnes } from "@/lib/notes/colonnes";
import type { Tables } from "@/lib/supabase/types";
import { getTags } from "@/app/actions/taches";
import { normalizeSearch } from "@/lib/normalize";
import { queryKeys } from "@/lib/query/keys";
import { NoteCard } from "./NoteCard";
import { AddNoteToggle } from "./AddNoteToggle";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";
import { input, linkButton, pillTag, sectionTitle, zoneTapPill } from "@/lib/ui";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ErrorInline } from "@/components/ErrorInline";

// Tag des idées : sa pastille passe en tête.
const CLE_TAG_IDEES = normalizeSearch("idées");

// Pastille de filtre active : fond vert doux propre, pas `pillTag` +
// surcharge (le `bg-surface-alt` de `pillTag` l'emportait sur `bg-kcal-soft`
// et la pastille active restait grise).
const PASTILLE_FILTRE_ACTIVE = "shrink-0 rounded-full bg-kcal-soft px-2.5 py-1 text-micro font-semibold text-kcal";

// Deux colonnes remplies ligne par ligne (voir repartirEnColonnes) : la
// deuxième note est à droite de la première, plus sous toute la colonne
// de gauche comme avec `columns-2`.
function GrilleNotes({ notes, tags }: { notes: NoteAvecRelations[]; tags: Tables<"tags">[] }) {
  return (
    <div className="grid grid-cols-2 items-start gap-3">
      {repartirEnColonnes(notes).map((colonne, index) => (
        <ul key={index} className="flex min-w-0 flex-col gap-3">
          <AnimatePresence initial={false}>
            {colonne.map((note) => (
              <NoteCard key={note.id} note={note} tags={tags} />
            ))}
          </AnimatePresence>
        </ul>
      ))}
    </div>
  );
}

export function NotesGrid({ defaultOpen, defaultTag }: { defaultOpen?: boolean; defaultTag?: string }) {
  const [search, setSearch] = useState("");
  // `null` tant que l'utilisateur n'a pas touché aux pastilles : le préfiltre
  // du lien s'applique alors ; dès qu'il en bascule une, son choix prime.
  const [choixTags, setChoixTags] = useState<string[] | null>(null);
  const queryClient = useQueryClient();

  const { data: notes, isLoading, isError, refetch } = useQuery({
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
        <ErrorInline message="Impossible de charger les notes." retry={() => refetch()} />
      ) : !notes || notes.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="text-heading-sm font-semibold text-ink">Aucune note pour l&apos;instant</p>
          <p className="text-label text-ink-2">
            Ajoute une première note ou une liste avec le bouton ci-dessus.
          </p>
        </div>
      ) : (
        <>
          <input
            type="search"
            placeholder="Rechercher une note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher une note"
            autoComplete="off"
            enterKeyHint="search"
            className={input}
          />

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-4">
              {tagsAffiches.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagFilter(tag.id)}
                  aria-pressed={tagFilter.includes(tag.id)}
                  className={`${zoneTapPill} max-w-full truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                    tagFilter.includes(tag.id) ? PASTILLE_FILTRE_ACTIVE : pillTag
                  }`}
                >
                  #{tag.nom}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center">
              <p className="text-label text-ink-2">Aucune note ne correspond à ta recherche.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setChoixTags([]);
                }}
                className={`${linkButton} inline-flex min-h-11 items-center`}
              >
                Effacer la recherche et les filtres
              </button>
            </div>
          ) : (
            <>
              {epinglees.length > 0 && (
                <section aria-labelledby="notes-epinglees" className="flex flex-col gap-2">
                  <h2 id="notes-epinglees" className={sectionTitle}>Épinglées</h2>
                  <GrilleNotes notes={epinglees} tags={tags} />
                </section>
              )}
              {autres.length > 0 && (
                <section aria-labelledby={epinglees.length > 0 ? "notes-autres" : undefined} className="flex flex-col gap-2">
                  {epinglees.length > 0 && (
                    <h2 id="notes-autres" className={sectionTitle}>
                      Autres
                    </h2>
                  )}
                  <GrilleNotes notes={autres} tags={tags} />
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
    </PullToRefresh>
  );
}
