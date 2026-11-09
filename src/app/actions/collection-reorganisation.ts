"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  ELEMENTS_MAX_REORGANISATION,
  NOM_COLLECTION_MAX,
  SCHEMA_REORGANISATION_COLLECTIONS,
  construirePromptReorganisationCollections,
  estLisible,
  lireReponseReorganisationCollections,
  type CollectionPourReorganisation,
  type ElementPourReorganisation,
  type PropositionReorganisation,
} from "@/lib/collection/reorganisation";
import { nettoyerInstruction } from "@/lib/documents/reorganisation";
import { nettoyerTexte, trouverCategorie } from "@/lib/documents/tri";
import { analyserPaquet, type Analyse, type EchecAnalyse } from "@/lib/gemini/analyse";
import { createAdminClient } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/uuid";

// Réorganisation des collections avec Gemini, en trois temps (même principe
// que celle des documents) : `proposerReorganisationCollections` (lecture
// seule, un seul appel Gemini sur les titres et descriptions),
// `appliquerReorganisationCollections` (n'écrit que ce que l'aperçu a validé)
// et `annulerReorganisationCollections` (remet tout en place, y compris les
// collections supprimées par une fusion : elles n'ont perdu aucun élément).

const ELEMENTS_MIN = 2;
const CHANGEMENTS_MAX = ELEMENTS_MAX_REORGANISATION + 100;

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function revalidateReorganisation() {
  revalidatePath("/collection");
  revalidatePath("/collection/[id]", "page");
}

// --- Proposition (lecture seule) ---

type SuccesPropositionCollections = {
  suggestion: PropositionReorganisation;
  /** Éléments par collection : repère les collections qui se videront. */
  comptes: Record<string, number>;
  noms: Record<string, string>;
  analyses: number;
  /** Éléments sans titre ni description, non examinés. */
  nonLus: number;
  /** Plus d'éléments lisibles que la limite d'un appel : les plus récents seulement. */
  tronque: boolean;
};

// Discriminant `statut` et non `ok` : voir `@/lib/gemini/analyse` (contrat `runAction`).
export type ResultatPropositionCollections = ({ statut: "ok" } & SuccesPropositionCollections) | EchecAnalyse;

type LigneElement = {
  id: string;
  collection_id: string;
  titre: string | null;
  description?: string | null;
  type: string;
  created_at: string;
};

/** Lit tous les éléments ; sans la colonne `description` (migration pas appliquée), les titres seuls. */
async function lireElements(supabase: SupabaseAdmin): Promise<LigneElement[] | null> {
  const avec = await supabase
    .from("collection_items")
    .select("id, collection_id, titre, description, type, created_at")
    .order("created_at", { ascending: false });
  if (!avec.error) return avec.data as LigneElement[];
  const sans = await supabase
    .from("collection_items")
    .select("id, collection_id, titre, type, created_at")
    .order("created_at", { ascending: false });
  return sans.error ? null : (sans.data as LigneElement[]);
}

/** Ce que `preparer` a lu en base, pour que `lire` assemble le résultat complet. */
type ContexteReorganisation = {
  analyses: ElementPourReorganisation[];
  collections: CollectionPourReorganisation[];
  comptes: Record<string, number>;
  noms: Record<string, string>;
  nonLus: number;
  tronque: boolean;
};

/** Un seul appel Gemini sur toute la collection : l'élément du paquet est l'instruction de l'utilisateur. */
const REORGANISATION: Analyse<string, ContexteReorganisation, SuccesPropositionCollections> = {
  etiquette: "reorganisation-collections",
  schema: SCHEMA_REORGANISATION_COLLECTIONS,
  verbe: "proposer de réorganisation",
  tailleMax: 1,
  timeoutMs: 50_000,
  temperature: 0.2,
  async preparer(instruction) {
    const supabase = createAdminClient();
    const [collectionsResult, elementsLus] = await Promise.all([
      supabase.from("collections").select("id, nom, ordre").order("ordre", { ascending: true }),
      lireElements(supabase),
    ]);
    if (collectionsResult.error || elementsLus === null) return { refus: "Les collections n'ont pas pu être lues. Réessaie." };

    const comptes: Record<string, number> = {};
    const noms: Record<string, string> = {};
    for (const c of collectionsResult.data ?? []) {
      comptes[c.id] = 0;
      noms[c.id] = c.nom;
    }
    for (const e of elementsLus) comptes[e.collection_id] = (comptes[e.collection_id] ?? 0) + 1;

    const lisibles = elementsLus.filter((e) => estLisible({ titre: e.titre, description: e.description ?? null }));
    if (lisibles.length < ELEMENTS_MIN) {
      return { refus: "Il faut au moins deux éléments avec un titre ou une description. Lance d'abord « Décrire » dans tes collections." };
    }
    const tronque = lisibles.length > ELEMENTS_MAX_REORGANISATION;
    const analyses: ElementPourReorganisation[] = lisibles.slice(0, ELEMENTS_MAX_REORGANISATION).map((e) => ({
      id: e.id,
      titre: e.titre,
      description: e.description ?? null,
      type: e.type,
      collectionId: e.collection_id,
    }));
    const collections: CollectionPourReorganisation[] = (collectionsResult.data ?? []).map((c) => ({
      id: c.id,
      nom: c.nom,
      nbElements: comptes[c.id] ?? 0,
    }));

    return {
      prompt: construirePromptReorganisationCollections(analyses, collections, nettoyerInstruction(instruction)),
      contexte: { analyses, collections, comptes, noms, nonLus: elementsLus.length - lisibles.length, tronque },
    };
  },
  lire: (brut, { analyses, collections, comptes, noms, nonLus, tronque }) => ({
    suggestion: lireReponseReorganisationCollections(brut, analyses, collections),
    comptes,
    noms,
    analyses: analyses.length,
    nonLus,
    tronque,
  }),
};

export async function proposerReorganisationCollections(instruction: string = ""): Promise<ResultatPropositionCollections> {
  const [resultat] = await analyserPaquet(REORGANISATION, [instruction]);
  return resultat.statut === "ok" ? { statut: "ok", ...resultat.suggestion } : resultat;
}

// --- Application (écriture) ---

type DeplacementValide = { id: string; versId: string | null; versNom: string };
type FusionValide = { deId: string; versId: string };
type RenommageValide = { id: string; nom: string };
export type SelectionReorganisation = {
  deplacements: DeplacementValide[];
  fusions: FusionValide[];
  renommages: RenommageValide[];
};

export type AncienEmplacement = { id: string; deId: string; ordre: number };
export type CollectionSupprimee = { id: string; nom: string; ordre: number };
export type AncienNom = { id: string; nom: string };
export type ResultatApplicationCollections = {
  deplaces: number;
  fusionnees: number;
  renommees: number;
  echecs: number;
  /** Pourquoi le premier changement a échoué (null s'il n'y a aucun échec). */
  raison: string | null;
  /** De quoi annuler. */
  anciens: AncienEmplacement[];
  creees: string[];
  supprimees: CollectionSupprimee[];
  anciensNoms: AncienNom[];
};

export async function appliquerReorganisationCollections(
  selection: SelectionReorganisation
): Promise<ActionResult<ResultatApplicationCollections>> {
  const deplacements = Array.isArray(selection?.deplacements) ? selection.deplacements : [];
  const fusions = Array.isArray(selection?.fusions) ? selection.fusions : [];
  const renommages = Array.isArray(selection?.renommages) ? selection.renommages : [];
  const total = deplacements.length + fusions.length + renommages.length;
  if (total === 0) return fail("Rien à appliquer.");
  if (total > CHANGEMENTS_MAX) return fail("Trop de changements d'un coup.");

  const moves: DeplacementValide[] = [];
  for (const d of deplacements) {
    const versNom = nettoyerTexte(d?.versNom).slice(0, NOM_COLLECTION_MAX);
    const versId = d?.versId ?? null;
    if (!estUuid(String(d?.id)) || (versId !== null && !estUuid(String(versId))) || (versId === null && !versNom)) {
      return fail("Un des déplacements est invalide.");
    }
    moves.push({ id: d.id, versId, versNom });
  }
  const merges: FusionValide[] = [];
  for (const f of fusions) {
    if (!estUuid(String(f?.deId)) || !estUuid(String(f?.versId)) || f.deId === f.versId) return fail("Une des fusions est invalide.");
    merges.push({ deId: f.deId, versId: f.versId });
  }
  const renames: RenommageValide[] = [];
  for (const r of renommages) {
    const nom = nettoyerTexte(r?.nom).slice(0, NOM_COLLECTION_MAX);
    if (!estUuid(String(r?.id)) || !nom) return fail("Un des noms est invalide.");
    renames.push({ id: r.id, nom });
  }

  const supabase = createAdminClient();
  const { data: lues, error: collectionsError } = await supabase.from("collections").select("id, nom, ordre");
  if (collectionsError) return fail("La réorganisation n'a pas pu être appliquée. Réessaie.");
  const collections = new Map((lues ?? []).map((c) => [c.id, { nom: c.nom, ordre: c.ordre }]));

  const anciens: AncienEmplacement[] = [];
  const creees: string[] = [];
  const supprimees: CollectionSupprimee[] = [];
  const anciensNoms: AncienNom[] = [];
  let deplaces = 0;
  let fusionnees = 0;
  let renommees = 0;
  let echecs = 0;
  let raison: string | null = null;
  const echoue = (pourquoi: string) => {
    echecs += 1;
    raison ??= pourquoi;
  };

  // Prochain rang libre dans une collection (mémorisé : on ajoute à la suite).
  const rangs = new Map<string, number>();
  async function prochainRang(collectionId: string): Promise<number> {
    let rang = rangs.get(collectionId);
    if (rang === undefined) {
      const { data } = await supabase
        .from("collection_items")
        .select("ordre")
        .eq("collection_id", collectionId)
        .order("ordre", { ascending: false })
        .limit(1)
        .maybeSingle();
      rang = (data?.ordre ?? -1) + 1;
    }
    rangs.set(collectionId, rang + 1);
    return rang;
  }

  async function deplacerElement(id: string, deId: string, ordreAvant: number, versId: string): Promise<boolean> {
    const ordre = await prochainRang(versId);
    const { data, error } = await supabase
      .from("collection_items")
      .update({ collection_id: versId, ordre })
      .eq("id", id)
      .eq("collection_id", deId)
      .select("id");
    if (error || (data?.length ?? 0) === 0) return false;
    anciens.push({ id, deId, ordre: ordreAvant });
    return true;
  }

  // 1. Collections à créer (nouveaux noms), seulement s'il y a des éléments à y mettre.
  const nouvellesParNom = new Map<string, string>();
  let rangCollection = Math.max(-1, ...[...collections.values()].map((c) => c.ordre)) + 1;
  for (const { versId, versNom } of moves) {
    if (versId !== null) continue;
    const existante = [...collections].find(([, c]) => trouverCategorie(versNom, [c.nom]));
    if (existante) {
      nouvellesParNom.set(versNom.toLowerCase(), existante[0]);
      continue;
    }
    const deja = [...nouvellesParNom.keys()].find((nom) => trouverCategorie(versNom, [nom]));
    if (deja) {
      nouvellesParNom.set(versNom.toLowerCase(), nouvellesParNom.get(deja)!);
      continue;
    }
    const { data, error } = await supabase
      .from("collections")
      .insert({ nom: versNom, ordre: rangCollection })
      .select("id")
      .single();
    if (error || !data) {
      console.error("appliquerReorganisationCollections: collection non créée", error);
      continue;
    }
    rangCollection += 1;
    creees.push(data.id);
    collections.set(data.id, { nom: versNom, ordre: rangCollection - 1 });
    nouvellesParNom.set(versNom.toLowerCase(), data.id);
  }

  // 2. Déplacements d'éléments.
  const { data: courants, error: elementsError } = await supabase
    .from("collection_items")
    .select("id, collection_id, ordre")
    .in("id", moves.map((m) => m.id));
  if (elementsError) return fail("La réorganisation n'a pas pu être appliquée. Réessaie.");
  const actuels = new Map((courants ?? []).map((e) => [e.id, e]));
  for (const { id, versId, versNom } of moves) {
    const courant = actuels.get(id);
    if (!courant) {
      echoue("élément supprimé entre-temps");
      continue;
    }
    const cibleId = versId ?? nouvellesParNom.get(versNom.toLowerCase()) ?? null;
    if (!cibleId || !collections.has(cibleId)) {
      echoue("collection de destination introuvable");
      continue;
    }
    if (cibleId === courant.collection_id) continue;
    if (await deplacerElement(id, courant.collection_id, courant.ordre, cibleId)) deplaces += 1;
    else echoue("erreur de la base");
  }

  // 3. Fusions : tout le contenu de la source passe dans la cible, puis la source (vide) disparaît.
  for (const { deId, versId } of merges) {
    const source = collections.get(deId);
    if (!source || !collections.has(versId)) {
      echoue("collection introuvable");
      continue;
    }
    const { data: contenu, error } = await supabase
      .from("collection_items")
      .select("id, ordre")
      .eq("collection_id", deId)
      .order("ordre", { ascending: true });
    if (error) {
      echoue("erreur de la base");
      continue;
    }
    let tousDeplaces = true;
    for (const element of contenu ?? []) {
      if (await deplacerElement(element.id, deId, element.ordre, versId)) deplaces += 1;
      else tousDeplaces = false;
    }
    if (!tousDeplaces) {
      echoue("des éléments n'ont pas pu être déplacés : la collection est conservée");
      continue;
    }
    const { error: suppressionError } = await supabase.from("collections").delete().eq("id", deId);
    if (suppressionError) {
      echoue("collection fusionnée non supprimée");
      continue;
    }
    supprimees.push({ id: deId, nom: source.nom, ordre: source.ordre });
    collections.delete(deId);
    fusionnees += 1;
  }

  // 4. Renommages (jamais d'un nom déjà pris par une autre collection).
  for (const { id, nom } of renames) {
    const courante = collections.get(id);
    if (!courante) {
      echoue("collection introuvable");
      continue;
    }
    const autres = [...collections].filter(([autreId]) => autreId !== id).map(([, c]) => c.nom);
    if (trouverCategorie(nom, autres)) {
      echoue("nom déjà pris par une autre collection");
      continue;
    }
    const { error } = await supabase.from("collections").update({ nom }).eq("id", id);
    if (error) {
      echoue("erreur de la base");
      continue;
    }
    anciensNoms.push({ id, nom: courante.nom });
    collections.set(id, { ...courante, nom });
    renommees += 1;
  }

  // Collections créées pendant cet essai mais restées vides (échec) : retirées.
  for (const id of [...creees]) {
    const { count } = await supabase.from("collection_items").select("id", { count: "exact", head: true }).eq("collection_id", id);
    if (count === 0) {
      await supabase.from("collections").delete().eq("id", id);
      creees.splice(creees.indexOf(id), 1);
    }
  }

  revalidateReorganisation();
  return ok({ deplaces, fusionnees, renommees, echecs, raison, anciens, creees, supprimees, anciensNoms });
}

// --- Annulation ---

export async function annulerReorganisationCollections(
  anciens: AncienEmplacement[],
  creees: string[],
  supprimees: CollectionSupprimee[],
  anciensNoms: AncienNom[]
): Promise<ActionResult<undefined>> {
  const valide =
    Array.isArray(anciens) &&
    Array.isArray(creees) &&
    Array.isArray(supprimees) &&
    Array.isArray(anciensNoms) &&
    anciens.every((a) => estUuid(String(a?.id)) && estUuid(String(a?.deId)) && Number.isInteger(a?.ordre)) &&
    creees.every((id) => estUuid(String(id))) &&
    supprimees.every((s) => estUuid(String(s?.id)) && nettoyerTexte(s?.nom) !== "" && Number.isInteger(s?.ordre)) &&
    anciensNoms.every((n) => estUuid(String(n?.id)) && nettoyerTexte(n?.nom) !== "");
  if (!valide) return fail("Annulation impossible.");

  const supabase = createAdminClient();
  let incomplet = false;

  // Collections supprimées par une fusion : recréées avec leur identifiant, avant d'y remettre les éléments.
  if (supprimees.length > 0) {
    const { error } = await supabase
      .from("collections")
      .insert(supprimees.map((s) => ({ id: s.id, nom: nettoyerTexte(s.nom).slice(0, NOM_COLLECTION_MAX), ordre: s.ordre })));
    if (error) return fail("Les collections fusionnées n'ont pas pu être recréées.");
  }
  for (const { id, deId, ordre } of anciens) {
    const { error } = await supabase.from("collection_items").update({ collection_id: deId, ordre }).eq("id", id);
    if (error) incomplet = true;
  }
  for (const { id, nom } of anciensNoms) {
    const { error } = await supabase.from("collections").update({ nom: nettoyerTexte(nom).slice(0, NOM_COLLECTION_MAX) }).eq("id", id);
    if (error) incomplet = true;
  }
  // Collections créées par la réorganisation : retirées seulement si elles sont vides.
  for (const id of creees) {
    const { count } = await supabase.from("collection_items").select("id", { count: "exact", head: true }).eq("collection_id", id);
    if (count === 0) await supabase.from("collections").delete().eq("id", id);
  }

  revalidateReorganisation();
  return incomplet ? fail("L'annulation est incomplète : vérifie tes collections.") : ok();
}
