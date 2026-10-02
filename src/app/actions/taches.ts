"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTES_TAG } from "@/lib/notes/tags";
import { TACHES_TAG } from "@/lib/taches/tags";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiISO } from "@/lib/budget/compute";
import type { Enums, Tables } from "@/lib/supabase/types";
import {
  RAPPEL_MINUTES_VALEURS,
  appliquerCochage,
  cochageDejaApplique,
  messageAvertissementCreation,
} from "@/lib/taches/compute";

// `id` : renseigné par createTache en cas de succès (id de la tâche créée,
// pour que l'UI puisse la mettre en évidence) ; absent pour updateTache et
// pour tout état d'erreur.
// `avertissement` : la tâche a bien été créée (`error` est null) mais une
// étape secondaire (tags, images) a échoué ; à afficher à l'utilisateur sans
// le laisser recréer la tâche.
export type TacheFormState = { error: string | null; id?: string; avertissement?: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRIORITES: readonly Enums<"priorite_tache">[] = ["aucune", "basse", "moyenne", "haute"];
const FREQUENCES: readonly Enums<"frequence_recurrence">[] = [
  "quotidien",
  "hebdomadaire",
  "mensuel",
  "annuel",
];

const HEURE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// `expire: 0` : le prochain rendu relit la base, jamais de donnée périmée
// (setTacheFait est aussi appelée depuis une route API, où updateTag est
// interdit).
function expirerCacheTaches() {
  revalidateTag(TACHES_TAG, { expire: 0 });
}

function revalidateTachesPaths() {
  expirerCacheTaches();
  revalidatePath("/taches");
  revalidatePath("/agenda");
  revalidatePath("/");
}

type TacheInput = {
  titre: string;
  echeance: string | null;
  heure: string | null;
  heure_fin: string | null;
  liste_id: string;
  notes: string | null;
  priorite: Enums<"priorite_tache">;
  programme_jour: boolean;
  recurrence_frequence: Enums<"frequence_recurrence"> | null;
  recurrence_fin: string | null;
  toute_la_journee: boolean;
  rappel_minutes: number | null;
};

type ParseResult = { ok: true; value: TacheInput } | { ok: false; error: string };

function parseTacheInput(formData: FormData): ParseResult {
  const titre = String(formData.get("titre") ?? "").trim();
  const echeance = String(formData.get("echeance") ?? "").trim();
  const heure = String(formData.get("heure") ?? "").trim();
  const heure_fin = String(formData.get("heure_fin") ?? "").trim();
  const liste_id = String(formData.get("liste_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const priorite = String(formData.get("priorite") ?? "aucune");
  const programme_jour = formData.get("programme_jour") === "on";
  const recurrence_frequence = String(formData.get("recurrence_frequence") ?? "").trim();
  const recurrence_fin = String(formData.get("recurrence_fin") ?? "").trim();
  const toute_la_journee = formData.get("toute_la_journee") === "on";
  const rappel_minutes_brut = String(formData.get("rappel_minutes") ?? "").trim();

  if (!titre) return { ok: false, error: "Le titre est requis." };
  if (!liste_id) return { ok: false, error: "La liste est requise." };
  if (heure && !HEURE_REGEX.test(heure)) {
    return { ok: false, error: "Heure invalide (format HH:MM)." };
  }
  if (heure_fin && !HEURE_REGEX.test(heure_fin)) {
    return { ok: false, error: "Heure de fin invalide (format HH:MM)." };
  }
  if (heure && heure_fin && heure_fin <= heure) {
    return { ok: false, error: "L'heure de fin doit être après l'heure de début." };
  }
  if (!PRIORITES.includes(priorite as Enums<"priorite_tache">)) {
    return { ok: false, error: "Priorité invalide." };
  }
  if (recurrence_frequence && !FREQUENCES.includes(recurrence_frequence as Enums<"frequence_recurrence">)) {
    return { ok: false, error: "Fréquence de récurrence invalide." };
  }

  const frequence = recurrence_frequence
    ? (recurrence_frequence as Enums<"frequence_recurrence">)
    : null;

  // Un rappel n'a de sens qu'avec une heure précise (ou, pour une tâche
  // toute la journée, avec la valeur 1440 ancrée sur 18h la veille) : toute
  // autre valeur (y compris vide) est silencieusement ramenée à null,
  // plutôt que rejetée comme une erreur de formulaire.
  const rappel_minutes_parse = Number(rappel_minutes_brut);
  const rappel_minutes_valide =
    rappel_minutes_brut &&
    RAPPEL_MINUTES_VALEURS.includes(rappel_minutes_parse as (typeof RAPPEL_MINUTES_VALEURS)[number])
      ? rappel_minutes_parse
      : null;
  // Toute la journée : seule 1440 (la veille) a un sens sans heure précise —
  // jamais de défaut automatique, Vincent la sélectionne manuellement.
  // Avec heure précise : rappel n'a de sens que si heure est renseignée,
  // même si le client envoyait une valeur (défensif, la même règle que
  // toute_la_journee ci-dessous pour heure/heure_fin).
  const rappel_minutes = toute_la_journee
    ? rappel_minutes_valide === 1440
      ? 1440
      : null
    : heure
      ? rappel_minutes_valide
      : null;

  return {
    ok: true,
    value: {
      titre,
      // "Toute la journée" et une heure précise sont mutuellement
      // exclusives : le serveur force heure/rappel_minutes à null plutôt que
      // de faire confiance au client, qui masque déjà ces champs.
      // Une tâche "du jour" sans échéance n'aurait jamais de date à laquelle
      // le cron de suppression pourrait s'appliquer : le serveur force donc
      // l'échéance à aujourd'hui plutôt que de faire confiance au client.
      echeance: echeance || (programme_jour ? aujourdhuiISO() : null),
      heure: toute_la_journee ? null : heure || null,
      heure_fin: toute_la_journee ? null : heure_fin || null,
      liste_id,
      notes: notes || null,
      priorite: priorite as Enums<"priorite_tache">,
      programme_jour,
      recurrence_frequence: frequence,
      // La date de fin de récurrence n'a de sens qu'accompagnée d'une
      // fréquence : silencieusement ignorée sinon (même logique que
      // unite/valeur_cible pour les objectifs de type "valeur").
      recurrence_fin: frequence && recurrence_fin ? recurrence_fin : null,
      toute_la_journee,
      rappel_minutes,
    },
  };
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

async function resolveTagIds(
  supabase: SupabaseClient,
  tagIds: string[],
  nouveauxNoms: string[]
): Promise<string[]> {
  const ids = new Set(tagIds);

  if (nouveauxNoms.length > 0) {
    // upsert sur le nom (unique) : si le tag existe déjà, on récupère son id
    // au lieu d'en recréer un, pour permettre la "création à la volée" sans
    // dupliquer un tag déjà présent.
    const { data, error } = await supabase
      .from("tags")
      .upsert(
        nouveauxNoms.map((nom) => ({ nom })),
        { onConflict: "nom" }
      )
      .select("id");

    if (error) throw new Error(error.message);
    for (const tag of data ?? []) ids.add(tag.id);
  }

  return [...ids];
}

function parseTagFields(formData: FormData): { tagIds: string[]; nouveauxNoms: string[] } {
  const tagIds = formData.getAll("tag_ids").map(String).filter(Boolean);
  const nouveauxNoms = [
    ...new Set(
      String(formData.get("nouveaux_tags") ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
    ),
  ];
  return { tagIds, nouveauxNoms };
}

async function syncTachesTags(supabase: SupabaseClient, tacheId: string, tagIds: string[]) {
  const { error: deleteError } = await supabase.from("taches_tags").delete().eq("tache_id", tacheId);
  if (deleteError) throw new Error(deleteError.message);

  if (tagIds.length > 0) {
    const { error: insertError } = await supabase
      .from("taches_tags")
      .insert(tagIds.map((tag_id) => ({ tache_id: tacheId, tag_id })));
    if (insertError) throw new Error(insertError.message);
  }
}

export async function createTache(
  _prevState: TacheFormState,
  formData: FormData
): Promise<TacheFormState> {
  const parsed = parseTacheInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("taches")
    .select("ordre")
    .eq("liste_id", parsed.value.liste_id)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  // resolveTagIds ne dépend que de formData, pas de l'id de la tâche créée :
  // on le lance en parallèle de l'insertion plutôt que de l'attendre après
  // coup.
  const { tagIds, nouveauxNoms } = parseTagFields(formData);

  const [{ data: tache, error }, tagsResult] = await Promise.all([
    supabase
      .from("taches")
      .insert({ ...parsed.value, ordre: (derniere?.ordre ?? -1) + 1 })
      .select("id")
      .single(),
    resolveTagIds(supabase, tagIds, nouveauxNoms).then(
      (resolvedTagIds) => ({ ok: true as const, resolvedTagIds }),
      (tagError: unknown) => ({ ok: false as const, tagError })
    ),
  ]);

  if (error) return { error: error.message };

  // À partir d'ici la tâche existe. Un échec des étapes secondaires (tags,
  // images) ne doit plus être renvoyé comme une erreur de formulaire : le
  // formulaire resterait ouvert et un nouvel appui sur « Créer » créerait un
  // doublon. On renvoie donc un succès accompagné d'un avertissement, et on
  // revalide sur tous les chemins de sortie.
  let echecTags = false;
  let echecImages = false;

  try {
    if (!tagsResult.ok) throw tagsResult.tagError;
    await syncTachesTags(supabase, tache.id, tagsResult.resolvedTagIds);
  } catch (tagError) {
    echecTags = true;
    console.error("createTache : échec de l'enregistrement des tags", tagError);
  }

  const nbImages = formData.getAll("images").filter((f) => f instanceof File && f.size > 0).length;
  try {
    await uploadTacheImages(tache.id, formData);
  } catch (imageError) {
    echecImages = true;
    console.error("createTache : échec de l'envoi des images", imageError);
  }

  revalidateTachesPaths();

  const avertissement = messageAvertissementCreation({
    tags: echecTags,
    images: echecImages,
    plusieursImages: nbImages > 1,
  });
  return { error: null, id: tache.id, ...(avertissement ? { avertissement } : {}) };
}

export async function updateTache(
  _prevState: TacheFormState,
  formData: FormData
): Promise<TacheFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Tâche introuvable." };

  const parsed = parseTacheInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();

  const { data: existante, error: fetchError } = await supabase
    .from("taches")
    .select("echeance, heure, rappel_minutes")
    .eq("id", id)
    .single();
  if (fetchError) return { error: fetchError.message };

  // Un rappel déjà envoyé ne doit pas rester "acquis" si la tâche est
  // déplacée à une nouvelle heure : sans ça, une tâche repoussée ne
  // renverrait plus jamais de rappel.
  const rappelObsolete =
    existante.echeance !== parsed.value.echeance ||
    existante.heure !== parsed.value.heure ||
    existante.rappel_minutes !== parsed.value.rappel_minutes;

  // resolveTagIds ne dépend que de formData, pas du résultat de la mise à
  // jour : on le lance en parallèle plutôt que de l'attendre après coup.
  const { tagIds, nouveauxNoms } = parseTagFields(formData);

  const [{ error }, tagsResult] = await Promise.all([
    supabase
      .from("taches")
      .update(rappelObsolete ? { ...parsed.value, rappel_envoye_le: null } : parsed.value)
      .eq("id", id),
    resolveTagIds(supabase, tagIds, nouveauxNoms).then(
      (resolvedTagIds) => ({ ok: true as const, resolvedTagIds }),
      (tagError: unknown) => ({ ok: false as const, tagError })
    ),
  ]);

  if (error) return { error: error.message };

  // La mise à jour principale est appliquée : quelle que soit la suite, les
  // données ont changé et les chemins du module doivent être revalidés. Une
  // mise à jour est rejouable (tags recalculés, images déjà supprimées
  // ignorées) : en cas d'échec d'une étape secondaire on garde donc un
  // retour `{ error }`, le formulaire reste ouvert pour un nouvel essai.
  try {
    if (!tagsResult.ok) throw tagsResult.tagError;
    await syncTachesTags(supabase, id, tagsResult.resolvedTagIds);
  } catch (tagError) {
    revalidateTachesPaths();
    return { error: tagError instanceof Error ? tagError.message : "Erreur lors des tags." };
  }

  // Suppression différée des images retirées dans le formulaire : elle n'a
  // lieu qu'ici, une fois la mise à jour réussie (« Annuler » n'a rien à
  // annuler côté serveur).
  try {
    const imageIds = [...new Set(formData.getAll("delete_image_ids").map(String))].filter((imageId) =>
      UUID_REGEX.test(imageId)
    );
    await supprimerImagesDeTache(supabase, id, imageIds);
  } catch (suppressionError) {
    revalidateTachesPaths();
    return {
      error:
        suppressionError instanceof Error
          ? suppressionError.message
          : "Erreur lors de la suppression des images.",
    };
  }

  try {
    await uploadTacheImages(id, formData);
  } catch (imageError) {
    revalidateTachesPaths();
    return {
      error: imageError instanceof Error ? imageError.message : "Erreur lors de l'envoi des images.",
    };
  }

  revalidateTachesPaths();
  return { error: null };
}

// --- Images ---

const TACHE_IMAGES_BUCKET = "tache-images";
const TACHE_IMAGE_MAX_DIMENSION = 1600;
const TACHE_IMAGE_JPEG_QUALITY = 75;

// Chemin de stockage attendu : `${tacheId}/${uuid}.jpg`, sous
// `/storage/v1/object/public/tache-images/`. On extrait ce chemin depuis
// l'URL publique stockée en base pour pouvoir supprimer l'objet Storage
// correspondant (le chemin lui-même n'est pas persisté séparément).
function extraireCheminStorage(url: string): string | null {
  const marqueur = `/${TACHE_IMAGES_BUCKET}/`;
  const index = url.indexOf(marqueur);
  if (index === -1) return null;
  return url.slice(index + marqueur.length);
}

// Compresse et upload chaque fichier envoyé sous la clé "images" du
// formData, puis insère une ligne tache_images par fichier. Ne fait rien si
// aucun fichier n'est fourni (cas normal : la plupart des soumissions du
// formulaire n'ajoutent pas d'image).
async function uploadTacheImages(tacheId: string, formData: FormData) {
  const fichiers = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length === 0) return;

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("tache_images")
    .select("ordre")
    .eq("tache_id", tacheId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  let ordre = (derniere?.ordre ?? -1) + 1;

  for (const fichier of fichiers) {
    const buffer = Buffer.from(await fichier.arrayBuffer());
    const compresse = await sharp(buffer)
      .rotate()
      .resize(TACHE_IMAGE_MAX_DIMENSION, TACHE_IMAGE_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: TACHE_IMAGE_JPEG_QUALITY })
      .toBuffer();

    const chemin = `${tacheId}/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(TACHE_IMAGES_BUCKET)
      .upload(chemin, compresse, { contentType: "image/jpeg" });
    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from(TACHE_IMAGES_BUCKET).getPublicUrl(chemin);

    const { error: insertError } = await supabase
      .from("tache_images")
      .insert({ tache_id: tacheId, url: publicUrl, ordre });
    if (insertError) {
      // Le fichier est déjà dans le bucket alors que sa ligne n'a pas pu
      // être enregistrée : sans nettoyage, il resterait orphelin. Au mieux :
      // un échec de ce nettoyage ne doit pas masquer l'erreur d'origine.
      try {
        const { error: cleanupError } = await supabase.storage.from(TACHE_IMAGES_BUCKET).remove([chemin]);
        if (cleanupError) {
          console.error("uploadTacheImages : nettoyage de l'objet orphelin impossible", cleanupError);
        }
      } catch (cleanupError) {
        console.error("uploadTacheImages : nettoyage de l'objet orphelin impossible", cleanupError);
      }
      throw new Error(insertError.message);
    }

    ordre++;
  }

  revalidateTachesPaths();
}

// Taille des lots pour les requêtes `in (...)` et les suppressions Storage :
// évite des URL de requête démesurées quand une liste compte beaucoup de
// tâches.
const TAILLE_LOT = 100;

function enLots<T>(elements: T[], taille = TAILLE_LOT): T[][] {
  const lots: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) lots.push(elements.slice(i, i + taille));
  return lots;
}

// Supprime des objets du bucket par lots. Lève à la première erreur : les
// lots déjà traités restent supprimés (la suppression d'un objet absent est
// sans effet, l'opération est donc rejouable).
async function supprimerObjetsStorage(supabase: SupabaseClient, chemins: string[]) {
  for (const lot of enLots(chemins)) {
    const { error } = await supabase.storage.from(TACHE_IMAGES_BUCKET).remove(lot);
    if (error) throw new Error(error.message);
  }
}

// Supprime des images d'UNE tâche (fichier Storage puis ligne). Seules les
// images réellement rattachées à `tacheId` sont concernées : un id qui
// appartient à une autre tâche, ou qui n'existe plus, est ignoré. Le fichier
// est supprimé avant la ligne : en cas d'échec Storage la ligne reste et
// l'opération peut être rejouée.
async function supprimerImagesDeTache(supabase: SupabaseClient, tacheId: string, imageIds: string[]) {
  if (imageIds.length === 0) return;

  const { data: images, error: fetchError } = await supabase
    .from("tache_images")
    .select("id, url")
    .eq("tache_id", tacheId)
    .in("id", imageIds);
  if (fetchError) throw new Error(fetchError.message);
  if (!images || images.length === 0) return;

  const chemins = images.map((i) => extraireCheminStorage(i.url)).filter((c): c is string => c !== null);
  await supprimerObjetsStorage(supabase, chemins);

  const { error } = await supabase
    .from("tache_images")
    .delete()
    .eq("tache_id", tacheId)
    .in(
      "id",
      images.map((i) => i.id)
    );
  if (error) throw new Error(error.message);
}

// Option A (validée) : quand une tâche récurrente est cochée, elle repart
// non cochée avec l'échéance suivante au lieu de rester "faite". Si la date
// de fin de récurrence est dépassée par la nouvelle échéance, la récurrence
// s'arrête et la tâche reste cochée. Le calcul de la nouvelle échéance est
// délégué à `appliquerCochage` (lib/taches/compute.ts, fonction pure et
// testée) : il avance en boucle jusqu'à dépasser aujourd'hui, pour qu'une
// tâche en retard reparte sur une échéance future plutôt que de rester en
// retard après chaque coche.
//
// `setTacheFait` fixe l'état voulu (plutôt que de l'inverser) : c'est
// l'action à utiliser pour toute mutation rejouable (file hors ligne), pour
// qu'un rejeu en double ou un changement fait ailleurs entre-temps ne
// bascule pas la tâche dans l'état inverse de celui voulu.
// `echeanceObservee` : échéance que l'appelant voyait au moment de cocher.
// Cocher une récurrente avance l'échéance, l'action n'est donc pas
// idempotente : une coche rejouée (file hors ligne) alors que l'occurrence a
// déjà été avancée doit être ignorée, sinon elle en sauterait une seconde
// (voir `cochageDejaApplique`). `undefined` = pas de garde (route de
// notification, actions mises en file avant ce paramètre).
export async function setTacheFait(id: string, fait: boolean, echeanceObservee?: string | null) {
  const supabase = createAdminClient();

  const { data, error: fetchError } = await supabase
    .from("taches")
    .select("echeance, recurrence_frequence, recurrence_fin")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  if (cochageDejaApplique(data, fait, echeanceObservee)) {
    revalidateTachesPaths();
    return;
  }

  const resultat = appliquerCochage(data, fait, aujourdhuiISO());

  const { error } = await supabase
    .from("taches")
    .update({
      fait: resultat.fait,
      echeance: resultat.echeance,
      ...(resultat.occurrenceAvancee ? { rappel_envoye_le: null } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (resultat.occurrenceAvancee) {
    const { error: sousTachesError } = await supabase
      .from("sous_taches")
      .update({ fait: false, termine_le: null })
      .eq("tache_id", id);
    if (sousTachesError) throw new Error(sousTachesError.message);
  }

  revalidateTachesPaths();
}

// Conservée pour les appelants qui basculent l'état sans le connaître à
// l'avance (UI en ligne). Hors ligne, préférer `setTacheFait` avec l'état
// cible déjà décidé par l'appelant (voir TasksList.tsx / DashboardTaskItem.tsx).
export async function deleteTache(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("taches").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidateTachesPaths();
}

// Persiste un nouvel ordre pour les tâches actives, après un drag & drop
// dans TasksList (remplace l'ancien système de flèches ↑/↓ par échange de
// voisin, cf. historique git : ambigu dès que le voisin visuel n'était pas
// le voisin logique, ex. tâche archivée masquée). Le client recalcule déjà
// l'ordre séquentiel par liste_id à partir de la position visuelle post-drop
// (voir TasksList.tsx) et ne transmet que les tâches dont l'ordre a
// effectivement changé.
export async function enregistrerOrdreTaches(updates: { id: string; ordre: number }[]) {
  if (updates.length === 0) return;

  const supabase = createAdminClient();

  const results = await Promise.all(
    updates.map(({ id, ordre }) => supabase.from("taches").update({ ordre }).eq("id", id))
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  revalidateTachesPaths();
}

export type TacheAvecRelations = Tables<"taches"> & {
  liste: Pick<Tables<"listes_taches">, "id" | "nom" | "couleur"> | null;
  sous_taches: Tables<"sous_taches">[];
  tags: Tables<"tags">[];
  images: Tables<"tache_images">[];
};

export async function getTachesAvecRelations(): Promise<TacheAvecRelations[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("taches")
    .select(
      "*, liste:listes_taches(id, nom, couleur), sous_taches(id, tache_id, titre, fait, termine_le, ordre, created_at), taches_tags(tag:tags(id, nom, couleur)), tache_images(id, tache_id, url, ordre, created_at)"
    )
    .order("fait", { ascending: true })
    .order("ordre", { ascending: true })
    .order("echeance", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("ordre", { referencedTable: "sous_taches", ascending: true })
    .order("ordre", { referencedTable: "tache_images", ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(({ taches_tags, tache_images, ...tache }) => ({
    ...tache,
    tags: taches_tags.map((tt) => tt.tag).filter((tag): tag is Tables<"tags"> => tag !== null),
    images: tache_images,
  }));
}

// --- Listes ---

export type ListeFormState = { error: string | null };

export async function createListe(
  _prevState: ListeFormState,
  formData: FormData
): Promise<ListeFormState> {
  const nom = String(formData.get("nom") ?? "").trim();
  const couleur = String(formData.get("couleur") ?? "").trim();
  if (!nom) return { error: "Le nom est requis." };

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("listes_taches")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("listes_taches").insert({
    nom,
    couleur: couleur || null,
    ordre: (derniere?.ordre ?? -1) + 1,
  });

  if (error) return { error: error.message };

  revalidatePath("/taches");
  revalidatePath("/taches/listes");
  expirerCacheTaches();
  return { error: null };
}

export async function updateListe(
  _prevState: ListeFormState,
  formData: FormData
): Promise<ListeFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Liste introuvable." };

  const nom = String(formData.get("nom") ?? "").trim();
  const couleur = String(formData.get("couleur") ?? "").trim();
  if (!nom) return { error: "Le nom est requis." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("listes_taches")
    .update({ nom, couleur: couleur || null })
    .eq("id", id);

  if (error) return { error: error.message };

  // `/taches/listes` (Server Component sans refetch client) est la page
  // réellement affichée par ce formulaire — même correctif que
  // `reordonnerListes` (CLICK-PATH-301/302) : sans elle, la nouvelle liste
  // ou le nouveau nom n'apparaît qu'après un rechargement manuel.
  revalidatePath("/taches");
  revalidatePath("/taches/listes");
  expirerCacheTaches();
  return { error: null };
}

// La liste "Général", créée par la migration, est la liste par défaut de
// secours : comme taches.liste_id est not null, la supprimer casserait
// toute tâche qui y est encore rattachée. Non supprimable, à l'image des
// catégories prédéfinies du budget (cf. supprimerCategorie).
//
// Suppression en deux temps, sans exception (Next masque en production le
// message d'une exception levée par une Server Action : toute erreur est
// donc renvoyée en valeur, en français) :
//  1. tant que la suppression des tâches n'est pas confirmée
//     (`supprimerTaches`), rien n'est supprimé et, si la liste contient des
//     tâches, on renvoie `confirmation` avec leur nombre exact ;
//  2. une fois confirmée : fichiers Storage des images -> tâches (les
//     sous-tâches, lignes d'images et liens de tags partent par CASCADE) ->
//     liste. La clé `taches_liste_id_fkey` reste `NO ACTION` : les tâches
//     sont supprimées explicitement ici, jamais par la base.
// `totalAttendu` : nombre de tâches annoncé à l'utilisateur au moment de la
// confirmation ; s'il ne correspond plus (tâches ajoutées ou supprimées
// entre-temps), rien n'est supprimé et on renvoie les chiffres réels pour
// une nouvelle confirmation.
// Pas de transaction : si une étape échoue en cours de route, l'opération
// est rejouable. États intermédiaires possibles : images supprimées du
// bucket alors que leurs lignes existent encore (tâches sans fichier), ou
// une partie des tâches supprimée alors que la liste existe encore.
export type SuppressionListeResult = {
  error: string | null;
  confirmation?: { total: number; faites: number };
};

export async function deleteListe(
  id: string,
  supprimerTaches = false,
  totalAttendu?: number
): Promise<SuppressionListeResult> {
  const supabase = createAdminClient();

  const { data: liste, error: fetchError } = await supabase
    .from("listes_taches")
    .select("nom")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return { error: "Impossible de lire la liste. Réessaie." };
  if (!liste) return { error: null }; // déjà supprimée
  if (liste.nom === "Général") {
    return { error: 'La liste "Général" ne peut pas être supprimée.' };
  }

  const { data: taches, error: tachesError } = await supabase
    .from("taches")
    .select("id, fait")
    .eq("liste_id", id);
  if (tachesError) return { error: "Impossible de compter les tâches de la liste. Réessaie." };

  const total = taches.length;
  const faites = taches.filter((t) => t.fait).length;

  // Rien n'est supprimé tant que le nombre de tâches n'a pas été confirmé.
  if (total > 0 && !supprimerTaches) return { error: null, confirmation: { total, faites } };
  if (supprimerTaches && totalAttendu !== undefined && total !== totalAttendu) {
    return { error: null, confirmation: { total, faites } };
  }

  if (total > 0) {
    const tacheIds = taches.map((t) => t.id);

    // 1. Fichiers Storage : en cas d'échec, on s'arrête AVANT toute
    //    suppression en base.
    const chemins: string[] = [];
    for (const lot of enLots(tacheIds)) {
      const { data: images, error: imagesError } = await supabase
        .from("tache_images")
        .select("url")
        .in("tache_id", lot);
      if (imagesError) {
        return { error: "Impossible de lister les images de la liste : rien n'a été supprimé. Réessaie." };
      }
      for (const image of images ?? []) {
        const chemin = extraireCheminStorage(image.url);
        if (chemin) chemins.push(chemin);
      }
    }
    try {
      await supprimerObjetsStorage(supabase, chemins);
    } catch (storageError) {
      console.error("deleteListe : suppression des images impossible", storageError);
      return {
        error: "La suppression des images a échoué : aucune tâche ni liste n'a été supprimée. Réessaie.",
      };
    }

    // 2. Tâches (exactement celles comptées et confirmées).
    for (const lot of enLots(tacheIds)) {
      const { error } = await supabase.from("taches").delete().in("id", lot);
      if (error) {
        console.error("deleteListe : suppression des tâches impossible", error);
        revalidateTachesPaths();
        return {
          error: "La suppression des tâches a échoué en cours de route. Réessaie pour supprimer celles qui restent.",
        };
      }
    }
  }

  // 3. La liste elle-même.
  const { error } = await supabase.from("listes_taches").delete().eq("id", id);

  revalidateTachesPaths();
  revalidatePath("/taches/listes");
  expirerCacheTaches();

  if (error) {
    console.error("deleteListe : suppression de la liste impossible", error);
    return {
      error: "La liste n'a pas pu être supprimée (des tâches y ont peut-être été ajoutées entre-temps). Réessaie.",
    };
  }
  return { error: null };
}

// Nombre de tâches (total et faites) par liste, pour afficher le compte dans
// /taches/listes et annoncer ce qu'une suppression de liste emporterait.
export async function getComptesTachesParListe(): Promise<
  Record<string, { total: number; faites: number }>
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("taches").select("liste_id, fait");
  if (error) throw new Error(error.message);

  const comptes: Record<string, { total: number; faites: number }> = {};
  for (const { liste_id, fait } of data ?? []) {
    const compte = (comptes[liste_id] ??= { total: 0, faites: 0 });
    compte.total++;
    if (fait) compte.faites++;
  }
  return comptes;
}

export async function reordonnerListes(id: string, direction: "haut" | "bas") {
  const supabase = createAdminClient();

  const { data: listes, error } = await supabase
    .from("listes_taches")
    .select("id, ordre")
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);
  if (!listes) return;

  const index = listes.findIndex((l) => l.id === id);
  if (index === -1) return;

  const voisinIndex = direction === "haut" ? index - 1 : index + 1;
  if (voisinIndex < 0 || voisinIndex >= listes.length) return;

  const actuelle = listes[index];
  const voisine = listes[voisinIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from("listes_taches").update({ ordre: voisine.ordre }).eq("id", actuelle.id),
    supabase.from("listes_taches").update({ ordre: actuelle.ordre }).eq("id", voisine.id),
  ]);

  if (err1) throw new Error(err1.message);
  if (err2) throw new Error(err2.message);

  // `/taches` ne montre pas les listes avec leurs contrôles de réordonnancement
  // — la page réellement affichée quand ce bouton est cliqué est
  // `/taches/listes`, page serveur sans refetch client : sans la revalider
  // elle aussi (comme le fait déjà `deleteListe`), le nouvel ordre reste
  // écrit en base mais invisible jusqu'à un rechargement (CLICK-PATH-301).
  revalidatePath("/taches");
  revalidatePath("/taches/listes");
  expirerCacheTaches();
}

export async function getListes(): Promise<Tables<"listes_taches">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listes_taches")
    .select("*")
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// --- Tags ---

export type TagFormState = { error: string | null };

export async function createTag(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const nom = String(formData.get("nom") ?? "").trim();
  const couleur = String(formData.get("couleur") ?? "").trim();
  if (!nom) return { error: "Le nom est requis." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("tags").insert({ nom, couleur: couleur || null });

  if (error) return { error: error.message };

  revalidatePath("/taches");
  return { error: null };
}

export async function deleteTag(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("tags").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidateTachesPaths();
  // La table `tags` est partagée : supprimer un tag retire aussi ses liens
  // avec les notes, donc des pastilles de la liste des notes en cache.
  revalidateTag(NOTES_TAG, { expire: 0 });
}

export async function getTags(): Promise<Tables<"tags">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("tags").select("*").order("nom", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// --- Sous-tâches ---
//
// Contrat `ActionResult` (constat T1, vague 1 de l'audit) : ces actions ne
// lèvent plus, elles retournent l'échec avec un message lisible. Appelées
// dans des transitions par SousTachesList (TasksList.tsx) via `runAction`.

export async function createSousTache(tacheId: string, titre: string): Promise<ActionResult> {
  const trimmed = titre.trim();
  if (!trimmed) return fail("Le titre de la sous-tâche est requis.");

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("sous_taches")
    .select("ordre")
    .eq("tache_id", tacheId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("sous_taches").insert({
    tache_id: tacheId,
    titre: trimmed,
    ordre: (derniere?.ordre ?? -1) + 1,
  });

  if (error) return fail("La sous-tâche n'a pas pu être ajoutée. Réessaie.");

  revalidateTachesPaths();
  return ok();
}

export async function toggleSousTache(id: string, fait: boolean): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sous_taches").update({ fait }).eq("id", id);

  if (error) return fail("La sous-tâche n'a pas pu être mise à jour. Réessaie.");

  revalidateTachesPaths();
  return ok();
}

export async function deleteSousTache(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sous_taches").delete().eq("id", id);

  if (error) return fail("La sous-tâche n'a pas pu être supprimée. Réessaie.");

  revalidateTachesPaths();
  return ok();
}

export async function reordonnerSousTaches(
  tacheId: string,
  id: string,
  direction: "haut" | "bas"
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: sousTaches, error } = await supabase
    .from("sous_taches")
    .select("id, ordre")
    .eq("tache_id", tacheId)
    .order("ordre", { ascending: true });

  if (error) return fail("L'ordre des sous-tâches n'a pas pu être modifié. Réessaie.");
  if (!sousTaches) return ok();

  const index = sousTaches.findIndex((s) => s.id === id);
  if (index === -1) return ok();

  const voisinIndex = direction === "haut" ? index - 1 : index + 1;
  if (voisinIndex < 0 || voisinIndex >= sousTaches.length) return ok();

  const actuelle = sousTaches[index];
  const voisine = sousTaches[voisinIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from("sous_taches").update({ ordre: voisine.ordre }).eq("id", actuelle.id),
    supabase.from("sous_taches").update({ ordre: actuelle.ordre }).eq("id", voisine.id),
  ]);

  if (err1 || err2) return fail("L'ordre des sous-tâches n'a pas pu être modifié. Réessaie.");

  revalidateTachesPaths();
  return ok();
}
