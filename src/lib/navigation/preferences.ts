import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_MODULES_BARRE_BASSE, NAV_ITEMS } from "@/lib/navigation/registry";
import type { Tables } from "@/lib/supabase/types";

// Table singleton : une seule ligne, id fixé à 1 (voir
// migration-preferences-navigation-2026-09-04.sql).
export const PREFERENCES_ID = 1;

// Tag invalidé par updateOrdreGrillePlus / updateModulesBarreBasse
// (src/app/actions/preferences-navigation.ts) via updateTag.
export const PREFERENCES_NAVIGATION_TAG = "preferences-navigation";

type PreferencesNavigation = Tables<"preferences_navigation">;

// La grille "Plus" liste TOUJOURS tous les items du registre (y compris les
// 4 modules primaires épinglables en barre du bas) : un module reste
// accessible depuis /plus même quand il est aussi épinglé en barre du bas,
// et surtout même quand un module normalement épinglé par défaut (ex.
// Nutrition, Habitudes) en a été délogé par un autre. Toute entrée absente
// du tableau enregistré (nouveau module ajouté plus tard au registre, ou
// tableau enregistré avant ce changement) s'affiche en fin de grille.
function resolveOrdreGrillePlus(saved: string[]): string[] {
  const hrefsConnus = new Set(NAV_ITEMS.map((item) => item.href));
  const sauvegardeFiltree = saved.filter((href) => hrefsConnus.has(href));
  const manquants = NAV_ITEMS.map((item) => item.href).filter((href) => !sauvegardeFiltree.includes(href));
  return [...sauvegardeFiltree, ...manquants];
}

// Si un href enregistré ne correspond plus à un item connu du registre,
// retombe sur l'emplacement par défaut correspondant (évite un onglet vide).
function resolveModulesBarreBasse(saved: string[]): string[] {
  return DEFAULT_MODULES_BARRE_BASSE.map((defaultHref, index) => {
    const href = saved[index];
    return href && NAV_ITEMS.some((item) => item.href === href) ? href : defaultHref;
  });
}

export type PreferencesNavigationResolues = {
  ordreGrillePlus: string[];
  modulesBarreBasse: string[];
};

// En cache (et donc dans la coquille statique de toutes les routes (app)) :
// la barre du bas et la grille "Plus" s'affichent instantanément, dans
// l'ordre personnalisé, sans attendre Supabase. La ligne n'est modifiée que
// par les deux Server Actions de preferences-navigation.ts, qui expirent ce
// cache via updateTag ; `days` borne la fraîcheur en cas d'écriture directe
// en base.
//
// La lecture a lieu au build (prérendu) : si Supabase est injoignable
// (build Preview sans SUPABASE_SERVICE_ROLE_KEY, panne), on retombe sur
// l'ordre par défaut avec une durée courte, relue dès la première requête
// suivante, plutôt que de faire échouer le build (ou, à l'exécution,
// d'afficher la page d'erreur sur toute l'app). Voir
// reports/2026-09-24-navigation-instantanee-cache-components.md.
export async function getPreferencesNavigationResolues(): Promise<PreferencesNavigationResolues> {
  "use cache";
  cacheTag(PREFERENCES_NAVIGATION_TAG);

  let prefs: Pick<PreferencesNavigation, "ordre_grille_plus" | "modules_barre_basse">;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("preferences_navigation")
      .select("*")
      .eq("id", PREFERENCES_ID)
      .single();

    if (error) throw new Error(error.message);
    prefs = data;
    cacheLife("days");
  } catch (error) {
    console.error("Préférences de navigation illisibles, ordre par défaut utilisé :", error);
    prefs = { ordre_grille_plus: [], modules_barre_basse: [] };
    cacheLife("minutes");
  }

  return {
    ordreGrillePlus: resolveOrdreGrillePlus(prefs.ordre_grille_plus),
    modulesBarreBasse: resolveModulesBarreBasse(prefs.modules_barre_basse),
  };
}
