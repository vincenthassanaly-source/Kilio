"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ajouterArticlesCourses, getCoursesItems } from "@/app/actions/courses";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import type { Tables } from "@/lib/supabase/types";
import { errorText, primaryButton } from "@/lib/ui";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import {
  decouperLibellesMultiples,
  planifierAjoutCourses,
  suggererArticles,
  trierCommeServeur,
  type PlanAjoutCourses,
} from "@/lib/courses/compute";

// Même géométrie/couleurs que le token partagé `input` de src/lib/ui.ts,
// mais en 16px localement (`text-base`) plutôt que 15px : évite le zoom
// automatique d'iOS Safari au focus sur CE champ précis, sans changer la
// taille de tous les autres champs de l'app (même motif que le renommage
// inline du lot B, CourseItemRow.tsx).
const inputClassName =
  "w-full rounded-2xl border border-line bg-surface-alt px-3.5 py-2.5 text-base text-ink outline-none focus:border-kcal/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

const MUTATION_KEY = ["courses", "ajouterArticlesCourses"];

type PlanEnvoi = PlanAjoutCourses & { libelles: string[] };

// Message inline de succès (#6 de l'audit) : une seule ligne qui se remplace
// à chaque ajout, jamais un toast empilé. Combine les trois issues possibles
// (créés / remis dans la liste / déjà présents) dans l'ordre où elles
// apparaissent le plus souvent en usage réel.
function messageResultat(plan: PlanAjoutCourses): string {
  const parties: string[] = [];
  if (plan.aCreer.length === 1) parties.push(`« ${plan.aCreer[0]} » ajouté`);
  else if (plan.aCreer.length > 1) parties.push(`${plan.aCreer.length} articles ajoutés`);

  if (plan.aReactiver.length === 1) parties.push(`« ${plan.aReactiver[0].libelle} » remis dans la liste`);
  else if (plan.aReactiver.length > 1) parties.push(`${plan.aReactiver.length} articles remis dans la liste`);

  if (plan.dejaPresents.length === 1) parties.push(`« ${plan.dejaPresents[0]} » déjà dans la liste`);
  else if (plan.dejaPresents.length > 1) parties.push(`${plan.dejaPresents.length} articles déjà dans la liste`);

  return parties.join(" · ");
}

// Le formulaire reste ouvert après chaque ajout (#1 de l'audit) : plus
// d'`onDone`, l'appelant (AddCourseToggle, QuickAddFab) ferme uniquement via
// son propre bouton de fermeture / le retour. Ajouter un article est
// l'action la plus fréquente du module : insertion optimiste immédiate,
// remplacée par les lignes réelles au refetch ; rollback ciblé (seulement
// les ids temp- et les articles réactivés de CETTE mutation) si le serveur
// échoue, pour ne jamais écraser un autre ajout encore en vol.
export function AddCourseForm({
  initial = "",
  onDone,
}: {
  /** Texte pré-rempli (ex. article proposé par « Ajouter avec l'IA »). */
  initial?: string;
  /** Appelé après l'envoi ; sans lui, le formulaire reste ouvert pour enchaîner les ajouts. */
  onDone?: () => void;
} = {}) {
  const [texte, setTexte] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [messageStatut, setMessageStatut] = useState<string | null>(null);
  const [suggestionActiveIndex, setSuggestionActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const texteRef = useRef(texte);
  const dernierTexteEnvoyeRef = useRef("");
  const listboxId = useId();
  const queryClient = useQueryClient();

  useEffect(() => {
    texteRef.current = texte;
  }, [texte]);

  // Même clé et même fonction de chargement que CoursesList : réutilise le
  // cache déjà présent sur /courses, ou déclenche son propre chargement
  // quand ce formulaire est monté seul (modale du FAB sur le dashboard).
  const { data: items = [] } = useQuery({
    queryKey: queryKeys.courses,
    queryFn: getCoursesItems,
  });

  const mutation = useMutation({
    mutationKey: MUTATION_KEY,
    // Sans cette option, une mutation déclenchée hors ligne resterait en
    // pause côté TanStack Query et n'atteindrait jamais le repli Dexie
    // ci-dessous (même motif que les autres mutations Courses, lots B/C).
    networkMode: "always",
    mutationFn: async (plan: PlanEnvoi) => {
      try {
        return await ajouterArticlesCourses(plan.libelles);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("courses", "ajouterArticlesCourses", [plan.libelles]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
        return null;
      }
    },
    onMutate: async (plan) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses });

      const maintenant = Date.now();
      const idsCrees: string[] = [];
      const originauxReactives: Tables<"courses_items">[] = [];

      queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) => {
        const base = old ?? [];
        const reactivesIds = new Set(plan.aReactiver.map((a) => a.id));

        const maj = base.map((item) => {
          if (!reactivesIds.has(item.id)) return item;
          originauxReactives.push(item);
          return { ...item, coche: false, termine_le: null, created_at: new Date(maintenant).toISOString() };
        });

        const nouveaux: Tables<"courses_items">[] = plan.aCreer.map((libelle, index) => {
          const id = `temp-${crypto.randomUUID()}`;
          idsCrees.push(id);
          const horodatage = new Date(maintenant + index).toISOString();
          return { id, libelle, coche: false, termine_le: null, created_at: horodatage, updated_at: horodatage };
        });

        return [...maj, ...nouveaux].sort(trierCommeServeur);
      });

      return { idsCrees, originauxReactives };
    },
    // Rollback ciblé (pas un instantané global) : ne retire que les ids
    // temp- créés par CETTE mutation et ne restaure que les articles
    // réactivés par CETTE mutation à leur état d'origine — un autre ajout
    // encore en vol au même moment garde ses propres articles optimistes.
    onError: (_err, _plan, context) => {
      if (!context) return;
      queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) => {
        if (!old) return old;
        const idsCreesSet = new Set(context.idsCrees);
        const parIdOrigine = new Map(context.originauxReactives.map((item) => [item.id, item]));
        return old.filter((item) => !idsCreesSet.has(item.id)).map((item) => parIdOrigine.get(item.id) ?? item);
      });
      setMessageStatut(null);
      showToast("Impossible d'ajouter les articles.");
      if (texteRef.current === "") setTexte(dernierTexteEnvoyeRef.current);
    },
    // N'invalide que lorsqu'il n'y a plus d'autre ajout de ce type en vol :
    // sinon le refetch effacerait les articles optimistes des ajouts encore
    // en cours. `isMutating` compte CETTE mutation elle-même (`onSettled`
    // s'exécute avant son passage à "success"/"error", vérifié dans
    // @tanstack/query-core), d'où le seuil à 1 et non 0.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) <= 1) {
        queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      }
    },
  });

  const decoupageActuel = useMemo(() => decouperLibellesMultiples(texte), [texte]);
  const nbArticlesDetectes = decoupageActuel.ok ? decoupageActuel.libelles.length : 0;

  // Segmentation pour l'autocomplétion : sur la simple présence d'une
  // virgule (pas le découpage complet avec exception décimale) — c'est ce
  // qui distingue "un seul segment" (une suggestion l'ajoute tout de suite)
  // de "plusieurs segments" (une suggestion complète juste le dernier).
  const segments = texte.split(",");
  const segmentCourant = segments[segments.length - 1].trim();
  const plusieursSegments = segments.length > 1;
  const suggestions = useMemo(
    () => suggererArticles(segmentCourant, items),
    [segmentCourant, items]
  );

  function refocus() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function soumettre(libellesEnvoi: string[]) {
    const plan = planifierAjoutCourses(libellesEnvoi, items);
    setMessageStatut(messageResultat(plan));
    if (plan.aCreer.length === 0 && plan.aReactiver.length === 0) return;
    mutation.mutate({ libelles: libellesEnvoi, ...plan });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const decoupage = decouperLibellesMultiples(texte);
    if (!decoupage.ok) {
      setErreur(decoupage.erreur);
      return;
    }
    if (decoupage.libelles.length === 0) {
      setErreur("Le libellé est requis.");
      return;
    }
    setErreur(null);
    // Vide le champ AU MOMENT DE LA SOUMISSION, pas dans onSuccess : sinon
    // l'article suivant déjà en cours de frappe se ferait effacer quand la
    // réponse du précédent arrive.
    dernierTexteEnvoyeRef.current = texte;
    setTexte("");
    setSuggestionActiveIndex(-1);
    soumettre(decoupage.libelles);
    if (onDone) onDone();
    else refocus();
  }

  function handleSuggestionSelect(suggestion: string) {
    if (!plusieursSegments) {
      dernierTexteEnvoyeRef.current = suggestion;
      setTexte("");
      setSuggestionActiveIndex(-1);
      soumettre([suggestion]);
      refocus();
      return;
    }
    const nouveauxSegments = [...segments.slice(0, -1), ` ${suggestion}`];
    setTexte(nouveauxSegments.join(","));
    setErreur(null);
    setSuggestionActiveIndex(-1);
    refocus();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTexte(e.target.value);
    setErreur(null);
    setSuggestionActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && suggestionActiveIndex >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[suggestionActiveIndex]);
    } else if (e.key === "Escape") {
      setSuggestionActiveIndex(-1);
    }
  }

  // Un texte collé multi-ligne devient une seule ligne dans un <input>
  // (les navigateurs mobiles suppriment ou remplacent les retours à la
  // ligne collés) : on intercepte le paste pour les remplacer par ", " à la
  // position du curseur AVANT que le navigateur ne les perde, afin de ne
  // pas perdre le découpage en plusieurs articles.
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const colle = e.clipboardData.getData("text");
    if (!/\r?\n/.test(colle)) return;
    e.preventDefault();
    const remplace = colle.replace(/\r?\n+/g, ", ");
    const el = e.currentTarget;
    const debut = el.selectionStart ?? texte.length;
    const fin = el.selectionEnd ?? texte.length;
    const nouveauTexte = texte.slice(0, debut) + remplace + texte.slice(fin);
    setTexte(nouveauTexte);
    setErreur(null);
    const position = debut + remplace.length;
    requestAnimationFrame(() => el.setSelectionRange(position, position));
  }

  const erreurAffichee = erreur ?? (!decoupageActuel.ok ? decoupageActuel.erreur : null);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          name="libelle"
          autoFocus
          autoComplete="off"
          enterKeyHint="send"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            suggestionActiveIndex >= 0 ? `${listboxId}-option-${suggestionActiveIndex}` : undefined
          }
          value={texte}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ex. lait, œufs, pain"
          className={inputClassName}
        />

        <div
          id={listboxId}
          role="listbox"
          aria-label="Suggestions d'articles habituels"
          className={suggestions.length === 0 ? "hidden" : "flex flex-wrap gap-2 px-0.5"}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === suggestionActiveIndex}
              aria-label={`Remettre « ${suggestion} » dans la liste`}
              // Empêche le tap sur une suggestion de voler le focus du champ
              // (le clavier reste ouvert).
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionSelect(suggestion)}
              className={`flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition active:scale-[0.97] ${
                index === suggestionActiveIndex
                  ? "border-kcal/60 bg-kcal-soft text-kcal"
                  : "border-line bg-surface-alt text-ink-2"
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {nbArticlesDetectes > 1 && (
        <p className="px-1 text-xs text-ink-2">
          {nbArticlesDetectes} articles : {decoupageActuel.ok ? decoupageActuel.libelles.join(" · ") : ""}
        </p>
      )}

      {erreurAffichee && (
        <p className={errorText} role="alert">
          {erreurAffichee}
        </p>
      )}

      {!erreurAffichee && messageStatut && (
        <p role="status" aria-live="polite" className="px-1 text-xs text-ink-2">
          {messageStatut}
        </p>
      )}

      <button
        type="submit"
        // Jamais désactivé pendant une mutation : les ajouts s'enchaînent.
        // `onPointerDown` empêche le bouton de voler le focus du champ au
        // tap (le clavier virtuel reste ouvert) ; le refocus explicite après
        // soumission (voir `refocus`) couvre le cas où le focus bougerait
        // malgré tout (ex. clic souris, qui ne déclenche pas `pointerdown`
        // de la même façon sur tous les navigateurs).
        onPointerDown={(e) => e.preventDefault()}
        className={primaryButton}
      >
        {nbArticlesDetectes > 1 ? `Ajouter ${nbArticlesDetectes} articles` : "Ajouter"}
      </button>
    </form>
  );
}
