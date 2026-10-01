import { NAV_ITEMS, isModuleRootPath } from "@/lib/navigation/registry";

const FICHE_REFERENTIEL = /^\/pharmacie\/referentiel\/(classe|medicament|pathologie)\/[^/]+$/;

/**
 * Exception au retour « parent logique » : depuis une fiche du référentiel
 * (classe, médicament, pathologie), le retour suit l'historique réel tant
 * qu'il reste dans le référentiel — on revient ainsi à la pathologie, à la
 * classe ou à la recherche d'où l'on vient, pas toujours à son accueil.
 */
export function retourHistoriqueAutorise(courant: string, arrivee: string): boolean {
  const normaliser = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  const de = normaliser(courant);
  const vers = normaliser(arrivee);
  if (de === vers || !FICHE_REFERENTIEL.test(de)) return false;
  return vers === "/pharmacie/referentiel" || FICHE_REFERENTIEL.test(vers);
}

/**
 * Écran vers lequel le retour (bouton/geste du téléphone) doit ramener
 * depuis `pathname`, indépendamment du chemin réellement parcouru :
 * - l'accueil n'a pas de parent (`null` : c'est là qu'on quitte l'app) ;
 * - un module épinglé en barre du bas ramène à l'accueil ;
 * - un module non épinglé (ouvert depuis la grille « Plus ») ramène à /plus ;
 * - /plus ramène à l'accueil ;
 * - une sous-page remonte d'un segment, jusqu'à la racine de son module.
 */
export function parentRoute(pathname: string, modulesBarreBasse: readonly string[]): string | null {
  const chemin = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (chemin === "/" || chemin === "") return null;
  if (chemin === "/plus") return "/";

  if (isModuleRootPath(chemin)) {
    return modulesBarreBasse.includes(chemin) ? "/" : "/plus";
  }

  // Les fiches du référentiel pharmacie (…/referentiel/<type>/<id>) n'ont pas
  // de page « <type> » : retirer un segment tomberait sur /pharmacie/<matière>/<chapitre>
  // (« Ce chapitre n'existe plus »). Leur parent est l'accueil du référentiel.
  if (FICHE_REFERENTIEL.test(chemin)) {
    return "/pharmacie/referentiel";
  }

  const segments = chemin.split("/").filter(Boolean);
  segments.pop();
  const parent = segments.length ? `/${segments.join("/")}` : "/";
  // Route inconnue hors de tout module : retomber sur l'accueil plutôt que
  // sur un chemin qui n'existe pas.
  if (parent === "/") return "/";
  const moduleParent = NAV_ITEMS.find((item) => item.href !== "/" && (parent === item.href || parent.startsWith(`${item.href}/`)));
  return moduleParent ? parent : "/";
}
