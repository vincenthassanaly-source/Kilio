// Fonctions pures du module Courses : aucun accès réseau ni base de données
// ici, uniquement du groupement sur les items déjà récupérés (voir
// src/app/actions/courses.ts pour la requête).

import type { Tables } from "@/lib/supabase/types";

/** Sépare les articles actifs (non cochés) des archivés (cochés), en
 * conservant l'ordre renvoyé par `getCoursesItems` (coche croissant, puis
 * created_at décroissant) au sein de chaque groupe. */
export function grouperItemsCourses(items: Tables<"courses_items">[]): {
  actifs: Tables<"courses_items">[];
  archives: Tables<"courses_items">[];
} {
  return {
    actifs: items.filter((item) => !item.coche),
    archives: items.filter((item) => item.coche),
  };
}

/** Un article créé hors ligne reçoit un id optimiste `temp-<uuid>`
 * (`AddCourseForm.onMutate`) tant que la création n'a pas été confirmée par
 * le serveur — `courses_items.id` étant une colonne `uuid`, aucune action
 * ciblant cet id ne peut jamais aboutir en base. Utilisé à la fois par le
 * garde-fou d'UI (`CourseItemRow`, désactive cocher/supprimer) et par la
 * politique de la file offline (`src/lib/offline/flush-policy.ts`, purge
 * immédiate sans appel serveur) — voir reports/2026-09-19-audit-module-courses.md
 * constats #13/#15. */
export function estIdTemporaire(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("temp-");
}

/** Reproduit l'ordre exact renvoyé par `getCoursesItems` (coche croissant,
 * donc actifs avant archivés, puis created_at décroissant au sein de chaque
 * groupe) : sert à replacer un article restauré (« Annuler » d'une
 * suppression) au même endroit dans le cache optimiste, sans attendre le
 * refetch serveur. */
export function trierCommeServeur(a: Tables<"courses_items">, b: Tables<"courses_items">): number {
  if (a.coche !== b.coche) return a.coche ? 1 : -1;
  if (a.created_at === b.created_at) return 0;
  return a.created_at < b.created_at ? 1 : -1;
}

/** Clé de dédoublonnage d'un libellé : minuscules, accents retirés (NFD),
 * espaces multiples réduits à un seul, trim. Point de définition unique,
 * réutilisé côté client (planification optimiste, autocomplétion) et côté
 * serveur (`ajouterArticlesCourses`, qui rejoue la même décision) — deux
 * libellés avec la même clé sont considérés comme le même article. */
export function cleDoublon(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Plafond d'articles acceptés en un seul ajout multiple : au-delà,
 * `decouperLibellesMultiples` renvoie une erreur plutôt que de tronquer en
 * silence (voir son commentaire). Valeur arbitraire mais cohérente avec le
 * volume réel du module (15 lignes en base au 2026-09-19). */
export const PLAFOND_ARTICLES_COURSES = 30;

/** Longueur maximale d'un libellé, en caractères. Aucune contrainte de ce
 * type n'existe en base (`libelle` est un `text` sans `character_maximum_length`,
 * vérifié en lecture seule) ni ailleurs dans le code : valeur de repli
 * choisie par ce lot (100), largement au-dessus du maximum actuellement
 * observé en production (32 caractères). */
export const LONGUEUR_MAX_LIBELLE_COURSE = 100;

// Motif des puces/cases collées depuis une note ("- ", "• ", "* ", "[ ] ",
// "[x] ", "1. ", "2) ") en tête d'un segment, à retirer avant de le garder
// comme libellé.
const PUCE_RE = /^\s*(?:[-•*]|\[\s*[xX]?\s*\]|\d+[.)])\s*/;

// Sépare un segment sur les virgules, SAUF une virgule directement entourée
// de deux chiffres ("1,5 L de lait" reste un seul article) : protège
// temporairement ce motif par un caractère de contrôle qui ne peut pas
// apparaître dans une saisie utilisateur normale, découpe sur le reste des
// virgules, puis restaure.
function decouperVirgules(segment: string): string[] {
  const protege = segment.replace(/(\d),(\d)/g, "$1\u0000$2");
  return protege.split(",").map((partie) => partie.replace(/\u0000/g, ","));
}

function nettoyerSegment(segment: string): string {
  return segment.replace(PUCE_RE, "").trim();
}

export type ResultatDecoupageLibelles =
  | { ok: true; libelles: string[] }
  | { ok: false; erreur: string };

/** Découpe une saisie libre en plusieurs libellés d'articles : sur les
 * retours à la ligne et les `;` toujours, sur la virgule sauf entre deux
 * chiffres (`decouperVirgules`), en retirant les puces/cases collées depuis
 * une note (`nettoyerSegment`) et les entrées vides. Dédoublonne à
 * l'intérieur du lot par `cleDoublon` (garde la première occurrence,
 * casse d'origine). Un lot vide (saisie ne contenant que des séparateurs)
 * n'est pas une erreur : `libelles` est simplement vide, à l'appelant de
 * décider quoi en faire (comme pour un champ simple vidé). Le plafond
 * d'articles et la longueur maximale, eux, renvoient une erreur exploitable
 * par l'UI plutôt que de tronquer en silence. */
export function decouperLibellesMultiples(saisie: string): ResultatDecoupageLibelles {
  const segmentsBruts: string[] = [];
  for (const ligne of saisie.split(/\n+/)) {
    for (const partie of ligne.split(/;+/)) {
      segmentsBruts.push(...decouperVirgules(partie));
    }
  }

  const nettoyes = segmentsBruts.map(nettoyerSegment).filter((s) => s.length > 0);

  const clesVues = new Set<string>();
  const libelles: string[] = [];
  for (const libelle of nettoyes) {
    const cle = cleDoublon(libelle);
    if (clesVues.has(cle)) continue;
    clesVues.add(cle);
    libelles.push(libelle);
  }

  if (libelles.length > PLAFOND_ARTICLES_COURSES) {
    return {
      ok: false,
      erreur: `Maximum ${PLAFOND_ARTICLES_COURSES} articles à la fois (${libelles.length} détectés).`,
    };
  }

  const tropLong = libelles.find((l) => l.length > LONGUEUR_MAX_LIBELLE_COURSE);
  if (tropLong) {
    return {
      ok: false,
      erreur: `Un article dépasse ${LONGUEUR_MAX_LIBELLE_COURSE} caractères : « ${tropLong.slice(0, 40)}… ».`,
    };
  }

  return { ok: true, libelles };
}

type ItemPourPlanification = Pick<Tables<"courses_items">, "id" | "libelle" | "coche">;

export type PlanAjoutCourses = {
  aCreer: string[];
  aReactiver: { id: string; libelle: string }[];
  dejaPresents: string[];
};

/** Décide, pour chaque libellé saisi (dans l'ordre), s'il faut créer un
 * nouvel article, réactiver un archivé identique, ou ne rien faire (déjà
 * présent). Un article ACTIF identique (y compris un article encore
 * `temp-…`, cf. `estIdTemporaire`) → `dejaPresents`. Un article ARCHIVÉ
 * identique → `aReactiver` ; s'il en existe plusieurs, le plus RÉCENT est
 * choisi — mais cette fonction ne compare aucune date : elle suppose que
 * `itemsExistants` est trié comme `getCoursesItems` (coche asc, created_at
 * desc, le tri partagé par le cache client et la requête serveur), auquel
 * cas le premier archivé rencontré pour une clé donnée EST le plus récent.
 * Le même contrat vaut à l'intérieur d'un lot : un doublon interne contre un
 * article qui vient d'être planifié (à créer ou réactivé) part aussi en
 * `dejaPresents`, pour ne réactiver/créer qu'une seule fois. Utilisée à la
 * fois côté client (plan optimiste sur le cache TanStack Query) et côté
 * serveur (`ajouterArticlesCourses`, qui rejoue la même décision sur les
 * données fraîches de la base — le serveur fait foi). */
export function planifierAjoutCourses(
  libelles: string[],
  itemsExistants: ItemPourPlanification[]
): PlanAjoutCourses {
  const actifsParCle = new Set<string>();
  const archivesParCle = new Map<string, { id: string; libelle: string }>();

  for (const item of itemsExistants) {
    const cle = cleDoublon(item.libelle);
    if (!item.coche) {
      actifsParCle.add(cle);
    } else if (!archivesParCle.has(cle)) {
      archivesParCle.set(cle, { id: item.id, libelle: item.libelle });
    }
  }

  const aCreer: string[] = [];
  const aReactiver: { id: string; libelle: string }[] = [];
  const dejaPresents: string[] = [];
  const clesDejaPlanifiees = new Set<string>();

  for (const libelle of libelles) {
    const cle = cleDoublon(libelle);
    if (actifsParCle.has(cle) || clesDejaPlanifiees.has(cle)) {
      dejaPresents.push(libelle);
      continue;
    }

    const archive = archivesParCle.get(cle);
    if (archive) {
      aReactiver.push(archive);
    } else {
      aCreer.push(libelle);
    }
    clesDejaPlanifiees.add(cle);
  }

  return { aCreer, aReactiver, dejaPresents };
}

type ItemPourSuggestion = Pick<Tables<"courses_items">, "libelle" | "coche" | "termine_le">;

/** Jusqu'à `max` suggestions d'« habituels » pour le dernier segment en
 * cours de saisie, issues UNIQUEMENT des articles archivés (l'historique
 * conservé — voir la limite de fenêtre glissante de 30 jours du nettoyage
 * automatique, documentée dans le rapport de ce lot). Dédoublonnées par
 * `cleDoublon`, filtrées sur le début du libellé ou d'un de ses mots
 * (insensible à la casse/aux accents), classées par nombre d'occurrences
 * dans l'historique puis par récence (`termine_le`). Segment vide (après
 * trim) -> aucune suggestion. */
export function suggererArticles(
  segment: string,
  itemsExistants: ItemPourSuggestion[],
  max = 4
): string[] {
  const segmentNormalise = cleDoublon(segment);
  if (!segmentNormalise) return [];

  type Agrege = { libelle: string; occurrences: number; dernierTermineLe: string };
  const parCle = new Map<string, Agrege>();

  for (const item of itemsExistants) {
    if (!item.coche) continue;
    const cle = cleDoublon(item.libelle);
    const termineLe = item.termine_le ?? "";
    const existant = parCle.get(cle);
    if (existant) {
      existant.occurrences += 1;
      if (termineLe > existant.dernierTermineLe) {
        existant.dernierTermineLe = termineLe;
        existant.libelle = item.libelle;
      }
    } else {
      parCle.set(cle, { libelle: item.libelle, occurrences: 1, dernierTermineLe: termineLe });
    }
  }

  const correspondances = [...parCle.values()].filter((agrege) => {
    if (cleDoublon(agrege.libelle).startsWith(segmentNormalise)) return true;
    return agrege.libelle.split(/\s+/).some((mot) => cleDoublon(mot).startsWith(segmentNormalise));
  });

  correspondances.sort((a, b) => {
    if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
    return b.dernierTermineLe.localeCompare(a.dernierTermineLe);
  });

  return correspondances.slice(0, max).map((agrege) => agrege.libelle);
}

/** Rayon fourre-tout pour tout article dont aucun mot-clé ne correspond —
 * toujours en dernier dans `grouperParRayon`, jamais une erreur. */
export const RAYON_AUTRES = "Autres";

/** Dictionnaire de classification par rayon, dans l'ordre de parcours d'un
 * supermarché type. Brouillon de départ validé avec Vincent (voir le
 * `shape` de cette fonctionnalité dans la conversation) : à affiner au fil
 * de l'usage réel plutôt qu'à considérer comme figé. Chaque mot-clé est
 * comparé à `cleDoublon(libelle)` (accents/casse/espaces déjà normalisés) :
 * un mot-clé sans espace doit correspondre à un mot ENTIER du libellé
 * (jamais une sous-chaîne, pour éviter par exemple qu'« huile » matche un
 * libellé contenant seulement « huileux ») ; un mot-clé à plusieurs mots
 * (ex. « papier toilette ») est cherché comme sous-chaîne du libellé
 * normalisé en entier. Le premier rayon dont un mot-clé correspond
 * l'emporte — l'ordre du tableau ci-dessous ne fixe donc pas seulement
 * l'ordre d'affichage, mais aussi la priorité en cas d'ambiguïté. */
export const RAYONS: { nom: string; motsCles: string[] }[] = [
  {
    nom: "Fruits & légumes",
    motsCles: [
      "pomme", "pommes", "poire", "poires", "banane", "bananes", "orange", "oranges",
      "clementine", "clementines", "mandarine", "mandarines", "citron", "citrons",
      "raisin", "raisins", "fraise", "fraises", "framboise", "framboises",
      "abricot", "abricots", "peche", "peches", "prune", "prunes", "kiwi", "kiwis",
      "ananas", "mangue", "mangues", "avocat", "avocats", "tomate", "tomates",
      "salade", "salades", "laitue", "carotte", "carottes", "pomme de terre",
      "pommes de terre", "patate", "patates", "oignon", "oignons", "ail", "echalote", "echalotes",
      "poireau", "poireaux", "courgette", "courgettes", "aubergine", "aubergines",
      "poivron", "poivrons", "concombre", "concombres", "champignon", "champignons",
      "brocoli", "brocolis", "chou", "choux", "epinard", "epinards", "haricot",
      "haricots", "radis", "betterave", "betteraves", "persil", "basilic",
      "coriandre", "menthe",
    ],
  },
  {
    nom: "Boulangerie",
    motsCles: ["pain", "baguette", "baguettes", "croissant", "croissants", "brioche", "biscotte", "biscottes", "viennoiserie", "viennoiseries", "pain de mie"],
  },
  {
    nom: "Boucherie/Poisson/Traiteur",
    motsCles: [
      "poulet", "boeuf", "bœuf", "porc", "veau", "agneau", "steak", "steaks",
      "saucisse", "saucisses", "saucisson", "jambon", "lardons", "chorizo",
      "merguez", "poisson", "saumon", "thon", "crevette", "crevettes",
      "cabillaud", "truite", "sole", "rillettes", "terrine",
    ],
  },
  {
    nom: "Crémerie/Fromage",
    motsCles: [
      "lait", "yaourt", "yaourts", "fromage", "fromages", "beurre", "creme",
      "oeuf", "oeufs", "mozzarella", "gruyere", "comte", "camembert", "chevre",
      "faisselle", "skyr", "margarine",
    ],
  },
  {
    nom: "Épicerie salée",
    motsCles: [
      "pates", "riz", "quinoa", "semoule", "lentilles", "farine", "huile",
      "vinaigre", "sel", "poivre", "epices", "sauce", "sauces", "bouillon",
      "conserve", "conserves", "cafe", "the", "tisane", "chips", "olives",
      "cornichons", "moutarde", "mayonnaise", "ketchup",
    ],
  },
  {
    nom: "Épicerie sucrée",
    motsCles: [
      "sucre", "chocolat", "confiture", "miel", "biscuits", "gateau", "gateaux",
      "cereales", "compote", "compotes", "bonbons",
    ],
  },
  {
    nom: "Surgelés",
    motsCles: ["surgele", "surgeles", "glace", "glaces", "sorbet", "sorbets", "nuggets"],
  },
  {
    nom: "Boissons",
    motsCles: ["eau", "jus", "soda", "coca", "limonade", "vin", "biere", "bieres", "champagne"],
  },
  {
    nom: "Hygiène/Beauté",
    motsCles: [
      "savon", "gel douche", "shampoing", "dentifrice", "brosse a dents",
      "deodorant", "papier toilette", "mouchoirs", "coton", "rasoir",
      "tampons", "serviettes hygieniques",
    ],
  },
  {
    nom: "Entretien/Maison",
    motsCles: [
      "lessive", "adoucissant", "eponge", "eponges", "sac poubelle",
      "sacs poubelle", "liquide vaisselle", "javel", "nettoyant", "sopalin",
      "essuie tout", "allumettes", "piles", "ampoule", "ampoules",
    ],
  },
  {
    nom: "Bébé",
    motsCles: ["couches", "couche", "lait infantile", "petit pot", "petits pots", "lingettes bebe"],
  },
  {
    nom: "Animaux",
    motsCles: ["croquettes", "patee", "litiere"],
  },
];

/** Classe un libellé d'article dans un rayon selon `RAYONS` (premier
 * mot-clé qui correspond, dans l'ordre du tableau), ou `RAYON_AUTRES` si
 * aucun ne correspond. Fonction pure, aucune saisie de rayon requise côté
 * utilisateur — respecte la décision produit « libellé texte libre
 * uniquement ». */
export function classerParRayon(libelle: string): string {
  const normalise = cleDoublon(libelle);
  const mots = normalise.split(" ").filter(Boolean);

  for (const { nom, motsCles } of RAYONS) {
    for (const motCle of motsCles) {
      const motCleNormalise = cleDoublon(motCle);
      const correspond = motCleNormalise.includes(" ")
        ? normalise.includes(motCleNormalise)
        : mots.includes(motCleNormalise);
      if (correspond) return nom;
    }
  }

  return RAYON_AUTRES;
}

export type SectionRayon = { rayon: string; items: Tables<"courses_items">[] };

/** Regroupe des articles (déjà filtrés sur les actifs, dans l'ordre
 * existant — voir `grouperItemsCourses`) par rayon, dans l'ordre du
 * magasin défini par `RAYONS`, `RAYON_AUTRES` toujours en dernier. L'ordre
 * interne à chaque rayon est celui de `items` en entrée, non retrié. Une
 * section vide n'est jamais renvoyée. */
export function grouperParRayon(items: Tables<"courses_items">[]): SectionRayon[] {
  const parRayon = new Map<string, Tables<"courses_items">[]>();
  for (const item of items) {
    const rayon = classerParRayon(item.libelle);
    const liste = parRayon.get(rayon);
    if (liste) liste.push(item);
    else parRayon.set(rayon, [item]);
  }

  const sections: SectionRayon[] = [];
  for (const { nom } of RAYONS) {
    const liste = parRayon.get(nom);
    if (liste) sections.push({ rayon: nom, items: liste });
  }
  const autres = parRayon.get(RAYON_AUTRES);
  if (autres) sections.push({ rayon: RAYON_AUTRES, items: autres });

  return sections;
}

export type ProgressionCourses = {
  actifs: number;
  total: number;
  /** `true` seulement quand il y a eu des articles (au moins un archivé) et
   * qu'il n'en reste plus aucun d'actif : distingue « tout est coché » de
   * « aucun article n'a jamais existé », qui garde le message générique
   * existant de `CoursesList` (`items.length === 0`). */
  tousCoches: boolean;
};

/** Compte d'avancement affiché au-dessus de la liste active (« N article(s)
 * à prendre ») et détecte l'état positif « tout est dans le chariot ! ».
 * Fonction pure : ne fait que compter, `CoursesList` décide de l'affichage. */
export function compterProgression(items: Tables<"courses_items">[]): ProgressionCourses {
  const total = items.length;
  const actifs = items.filter((item) => !item.coche).length;
  return { actifs, total, tousCoches: total > 0 && actifs === 0 };
}
