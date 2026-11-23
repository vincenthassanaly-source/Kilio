import type { QueryClient } from "@tanstack/react-query";
import { restoreCourseItems, toggleCourseItem, type CourseItemARestaurer } from "@/app/actions/courses";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import type { Tables } from "@/lib/supabase/types";
import { trierCommeServeur } from "@/lib/courses/compute";

// Fonction autonome (pas un hook, pas un `mutate` lié à un composant) :
// le callback « Annuler » d'un toast d'action doit continuer à fonctionner
// même si l'écran qui a déclenché la suppression a été démonté entre-temps
// (l'utilisateur peut changer de page pendant les ~6 s d'affichage du
// toast — CourseItemRow ou ArchivedCoursesSection ne sont alors plus
// montés). Ne capture que le `queryClient` (instance stable pour toute la
// durée de vie de l'app, voir providers.tsx) et un instantané de données
// (`CourseItemARestaurer[]`), jamais un état ni un `mutate` de composant.
export async function restaurerArticlesCourses(
  queryClient: QueryClient,
  items: CourseItemARestaurer[]
) {
  if (items.length === 0) return;

  queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) => {
    const existants = new Set((old ?? []).map((i) => i.id));
    const maintenant = new Date().toISOString();
    // `updated_at` n'est pas restauré (voir restoreCourseItems) : la valeur
    // exacte que le serveur assignera à l'INSERT n'est pas connue tant que
    // le refetch n'a pas confirmé — une valeur approximative suffit pour le
    // court instant avant invalidation ci-dessous.
    const aAjouter: Tables<"courses_items">[] = items
      .filter((item) => !existants.has(item.id))
      .map((item) => ({ ...item, updated_at: maintenant }));
    if (aAjouter.length === 0) return old;
    return [...(old ?? []), ...aAjouter].sort(trierCommeServeur);
  });

  try {
    await restoreCourseItems(items);
  } catch (err) {
    if (!isNetworkError(err)) {
      showToast("Impossible d'annuler la suppression.");
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      return;
    }
    await enqueueAction("courses", "restoreCourseItems", [items]);
    showToast("Enregistré, sera synchronisé à la reconnexion");
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.courses });
}

// « Annuler » du toast de coche : remet l'article « à prendre ». Même
// contrainte que ci-dessus (l'article a quitté la liste active, sa ligne a pu
// être démontée) : fonction autonome, optimiste, avec repli dans la file hors
// ligne comme la coche elle-même.
export async function annulerCocheCourse(queryClient: QueryClient, id: string) {
  await queryClient.cancelQueries({ queryKey: queryKeys.courses });
  queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) =>
    old?.map((i) => (i.id === id ? { ...i, coche: false } : i))
  );

  try {
    await toggleCourseItem(id, false);
  } catch (err) {
    if (!isNetworkError(err)) {
      showToast("Impossible d'annuler la coche.");
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      return;
    }
    await enqueueAction("courses", "toggleCourseItem", [id, false]);
    showToast("Enregistré, sera synchronisé à la reconnexion");
    // Pas d'invalidation : un refetch relirait l'état serveur encore coché.
    return;
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.courses });
}
