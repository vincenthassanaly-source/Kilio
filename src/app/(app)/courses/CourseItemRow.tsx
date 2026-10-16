"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { deleteCourseItem, toggleCourseItem, updateCourseItem } from "@/app/actions/courses";
import { queryKeys } from "@/lib/query/keys";
import { restaurerElement } from "@/lib/query/rollback";
import { showActionToast, showToast } from "@/components/toast/toast-store";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, listCard, nameText } from "@/lib/ui";
import { CheckToggle } from "@/components/CheckToggle";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import { estIdTemporaire } from "@/lib/courses/compute";
import { restaurerArticlesCourses } from "./undo";

// Extrait de CoursesList pour être réutilisé tel quel par
// ArchivedCoursesSection (mêmes mutations optimistes toggle/suppression pour
// les articles archivés), sans import circulaire entre les deux fichiers.
function CourseItemRowBase({ item }: { item: Tables<"courses_items"> }) {
  const queryClient = useQueryClient();
  // Article créé hors ligne, encore affiché avec son id optimiste
  // `temp-<uuid>` tant que la création n'a pas été confirmée par le serveur
  // (voir AddCourseForm.onMutate) : cocher/supprimer/renommer ne peut jamais
  // aboutir pour cet id (colonne uuid en base) et mettrait en file une action
  // irrécupérable — voir reports/2026-09-19-audit-module-courses.md #13/#15.
  const enAttenteDeCreation = estIdTemporaire(item.id);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.courses });
  }

  // Cocher un article est l'action la plus fréquente du module : optimiste,
  // rollback silencieux + toast discret si le serveur échoue.
  // `networkMode: "always"` (ici et sur delete/update ci-dessous) : par
  // défaut, TanStack Query met une mutation en pause tant qu'il se croit
  // hors ligne (onMutate s'exécute, mutationFn jamais) — le repli Dexie
  // n'était alors jamais atteint. Ici mutationFn doit s'exécuter : hors
  // ligne, l'appel échoue en erreur réseau et l'action est mise en file
  // (enqueueAction), rejouée au retour du réseau par useOnlineSync (même
  // motif que TaskCard, src/app/(app)/taches/TasksList.tsx).
  const toggleMutation = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      vibrate();
      try {
        await toggleCourseItem(item.id, !item.coche);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // Défense en profondeur : le bouton est déjà désactivé tant que
        // `enAttenteDeCreation` est vrai (ci-dessous), donc ce chemin ne
        // devrait jamais s'exécuter en usage normal. On ne met jamais en
        // file une action ciblant un id temporaire (elle échouerait de toute
        // façon au rejeu, cf. flush-policy.ts) : on relance, ce qui déclenche
        // le rollback + toast d'erreur habituels de `onError`.
        if (enAttenteDeCreation) throw err;
        await enqueueAction("courses", "toggleCourseItem", [item.id, !item.coche]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses });
      const previous = queryClient.getQueryData<Tables<"courses_items">[]>(queryKeys.courses);
      queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) =>
        old?.map((i) => (i.id === item.id ? { ...i, coche: !i.coche } : i))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      restaurerElement(queryClient, queryKeys.courses, context?.previous, item.id);
      showToast("Impossible de mettre à jour l'article.");
    },
    onSettled: invalidate,
  });

  // Suppression immédiate (plus de `window.confirm`, décision actée : voir
  // reports/2026-09-19-audit-module-courses.md #7) + toast « Annuler ».
  // Le callback d'annulation (restaurerArticlesCourses) est une fonction
  // autonome qui ne dépend ni de ce composant ni de son `queryClient` local
  // au-delà de l'instance elle-même (stable) : il continue de fonctionner
  // même si CourseItemRow est démonté (l'article a disparu de la liste)
  // pendant les ~6 s d'affichage du toast — voir src/app/(app)/courses/undo.ts.
  const deleteMutation = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      try {
        await deleteCourseItem(item.id);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // Voir le commentaire équivalent dans toggleMutation ci-dessus.
        if (enAttenteDeCreation) throw err;
        await enqueueAction("courses", "deleteCourseItem", [item.id]);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses });
      const previous = queryClient.getQueryData<Tables<"courses_items">[]>(queryKeys.courses);
      queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) =>
        old?.filter((i) => i.id !== item.id)
      );
      return { previous };
    },
    onSuccess: () => {
      showActionToast(`« ${item.libelle} » supprimé`, {
        ariaLabel: `Annuler la suppression de « ${item.libelle} »`,
        onAction: () =>
          restaurerArticlesCourses(queryClient, [
            {
              id: item.id,
              libelle: item.libelle,
              coche: item.coche,
              created_at: item.created_at,
              termine_le: item.termine_le,
            },
          ]),
      });
    },
    onError: (_err, _vars, context) => {
      restaurerElement(queryClient, queryKeys.courses, context?.previous, item.id);
      showToast("Impossible de supprimer l'article.");
    },
    onSettled: invalidate,
  });

  // Renommage inline : tap sur le libellé -> <input>, Entrée/perte de focus
  // valide, Échap annule. Bloqué tant que l'article reste `temp-` (même
  // garde-fou que cocher/supprimer), avec défense en profondeur dans la
  // mutationFn (jamais de mise en file d'un id temporaire).
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.libelle);
  const inputRef = useRef<HTMLInputElement>(null);
  // Évite qu'Entrée (ou Échap) valide/annule une première fois, puis que le
  // `blur` déclenché par la disparition de l'<input> du DOM (React retire le
  // nœud focalisé au rendu suivant) ne déclenche une seconde validation avec
  // un `item.libelle` de cache pas encore à jour.
  const renameSettledRef = useRef(false);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const updateMutation = useMutation({
    networkMode: "always",
    mutationFn: async (libelle: string) => {
      try {
        await updateCourseItem(item.id, libelle);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // Défense en profondeur : le tap pour renommer est déjà bloqué tant
        // que `enAttenteDeCreation` est vrai (voir handleStartRenaming), un
        // id temporaire ne doit donc jamais atteindre ce point.
        if (enAttenteDeCreation) throw err;
        await enqueueAction("courses", "updateCourseItem", [item.id, libelle]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
      }
    },
    onMutate: async (libelle: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses });
      const previous = queryClient.getQueryData<Tables<"courses_items">[]>(queryKeys.courses);
      queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) =>
        old?.map((i) => (i.id === item.id ? { ...i, libelle } : i))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      restaurerElement(queryClient, queryKeys.courses, context?.previous, item.id);
      showToast("Impossible de renommer l'article.");
    },
    onSettled: invalidate,
  });

  function handleStartRenaming() {
    if (enAttenteDeCreation) return;
    renameSettledRef.current = false;
    setDraft(item.libelle);
    setRenaming(true);
  }

  function commitRename() {
    if (renameSettledRef.current) return;
    renameSettledRef.current = true;
    setRenaming(false);
    const trimmed = draft.trim();
    // Libellé vide ou inchangé : on annule sans appel serveur.
    if (!trimmed || trimmed === item.libelle) return;
    updateMutation.mutate(trimmed);
  }

  function cancelRename() {
    renameSettledRef.current = true;
    setRenaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={listCard}
      aria-busy={enAttenteDeCreation || undefined}
    >
      <div className={`flex items-center gap-3 ${enAttenteDeCreation ? "opacity-60" : ""}`}>
        <CheckToggle
          checked={item.coche}
          disabled={toggleMutation.isPending || enAttenteDeCreation}
          onToggle={() => toggleMutation.mutate()}
          color="var(--accent-courses)"
          label={item.coche ? "Décocher l'article" : "Cocher l'article"}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {renaming ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitRename}
              enterKeyHint="done"
              aria-label={`Renommer « ${item.libelle} »`}
              // 16px localement (pas via le token partagé `input` de
              // src/lib/ui.ts, en 15px) : évite le zoom automatique d'iOS
              // Safari au focus sur ce champ précis, sans changer la taille
              // de tous les autres champs de l'app.
              className="w-full rounded-lg border border-line bg-surface-alt px-2 py-1 text-base text-ink outline-none focus:border-kcal/60"
              // Empêche la sélection de texte / le geste tactile dans ce
              // champ de remonter jusqu'à TabSwipeWrapper et d'y être
              // interprété comme un swipe de navigation entre onglets (même
              // isolation que Modal.tsx).
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              onClick={handleStartRenaming}
              disabled={enAttenteDeCreation}
              aria-label={`Renommer « ${item.libelle} »`}
              className="flex min-h-[44px] w-full flex-col justify-center text-left disabled:cursor-default"
            >
              <p className={`${nameText} ${item.coche ? "text-ink-2 line-through" : ""}`}>
                {item.libelle}
              </p>
            </button>
          )}
          {enAttenteDeCreation && (
            <span className="text-xs text-ink-2">En attente de synchro</span>
          )}
        </div>
        <button
          type="button"
          disabled={deleteMutation.isPending || enAttenteDeCreation}
          onClick={() => deleteMutation.mutate()}
          // `dangerButton` (src/lib/ui.ts) mesure ~34px de haut, partagé par
          // une vingtaine d'écrans : on ne le modifie pas pour ne pas
          // agrandir tous ses autres usages (même motif que `navArrowButton`
          // dans ui.ts). `min-h-11` (44px) porte la cible de tap de CE
          // bouton précis au minimum recommandé, sans changer sa couleur,
          // son rayon ni sa police — juste un peu plus de hauteur, centrée
          // sur le texte.
          className={`${dangerButton} flex min-h-11 items-center justify-center`}
        >
          Suppr.
        </button>
      </div>
    </motion.li>
  );
}

export const CourseItemRow = memo(CourseItemRowBase);
