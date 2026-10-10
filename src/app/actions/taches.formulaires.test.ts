// @vitest-environment node
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre, type RepondreStockage } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("next/cache", () => ({
  revalidatePath: etat.revalidatePath,
  revalidateTag: etat.revalidateTag,
  updateTag: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  createListe,
  createSousTache,
  createTache,
  createTag,
  deleteListe,
  deleteSousTache,
  deleteTag,
  getComptesTachesParListe,
  getListes,
  getTachesAvecRelations,
  getTags,
  reordonnerListes,
  reordonnerSousTaches,
  toggleSousTache,
  updateListe,
  updateTache,
} from "./taches";

const ID = "11111111-1111-4111-8111-111111111111";
const LISTE = "33333333-3333-4333-8333-333333333333";
const IMG1 = "44444444-4444-4444-8444-444444444444";
const BUCKET = "tache-images";
const URL_PUBLIQUE = `https://stockage.test/storage/v1/object/public/${BUCKET}`;

function brancher(repondre?: Repondre, stockage?: RepondreStockage) {
  const fake = fauxSupabase(repondre, stockage);
  etat.client = fake.client;
  return fake;
}

function form(champs: Record<string, string | File | (string | File)[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

async function photo(nom = "p.png") {
  const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  return new File([new Uint8Array(buffer)], nom, { type: "image/png" });
}

const minimal = { titre: "Appeler", liste_id: LISTE };
const creation: Repondre = (a) => (a.table === "taches" && a.action === "insert" ? { data: { id: ID } } : undefined);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createTache : validation", () => {
  it.each([
    ["titre vide", { ...minimal, titre: " " }, "Le titre est requis."],
    ["liste absente", { titre: "x" }, "La liste est requise."],
    ["heure invalide", { ...minimal, heure: "9h" }, "Heure invalide (format HH:MM)."],
    ["heure de fin invalide", { ...minimal, heure_fin: "25:00" }, "Heure de fin invalide (format HH:MM)."],
    ["fin avant le début", { ...minimal, heure: "10:00", heure_fin: "09:00" }, "L'heure de fin doit être après l'heure de début."],
    ["fin égale au début", { ...minimal, heure: "10:00", heure_fin: "10:00" }, "L'heure de fin doit être après l'heure de début."],
    ["durée invalide", { ...minimal, duree_minutes: "0" }, "Durée invalide (entre 1 minute et 24 h)."],
    ["durée décimale", { ...minimal, duree_minutes: "1.5" }, "Durée invalide (entre 1 minute et 24 h)."],
    ["priorité inconnue", { ...minimal, priorite: "urgente" }, "Priorité invalide."],
    ["fréquence inconnue", { ...minimal, recurrence_frequence: "bimensuel" }, "Fréquence de récurrence invalide."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await createTache({ error: null }, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("createTache : normalisation", () => {
  async function creer(champs: Record<string, string>) {
    const fake = brancher(creation);
    await createTache({ error: null }, form(champs));
    return ecritures(fake.appels, "taches", "insert")[0].payload as Record<string, unknown>;
  }

  it("applique les valeurs par défaut", async () => {
    expect(await creer(minimal)).toEqual({
      titre: "Appeler",
      echeance: null,
      heure: null,
      heure_fin: null,
      liste_id: LISTE,
      notes: null,
      priorite: "aucune",
      programme_jour: false,
      recurrence_frequence: null,
      recurrence_fin: null,
      toute_la_journee: false,
      rappel_minutes: null,
      ordre: 0,
    });
  });

  it("force l'échéance à aujourd'hui pour une tâche programmée sur le jour", async () => {
    expect(await creer({ ...minimal, programme_jour: "on" })).toMatchObject({ echeance: "2026-10-09", programme_jour: true });
    expect(await creer({ ...minimal, programme_jour: "on", echeance: "2026-10-20" })).toMatchObject({ echeance: "2026-10-20" });
  });

  it("efface heure, fin et rappel pour une tâche toute la journée, sauf le rappel de la veille", async () => {
    const base = { ...minimal, toute_la_journee: "on", heure: "09:00", heure_fin: "10:00" };
    expect(await creer({ ...base, rappel_minutes: "15" })).toMatchObject({
      heure: null,
      heure_fin: null,
      toute_la_journee: true,
      rappel_minutes: null,
    });
    expect(await creer({ ...base, rappel_minutes: "1440" })).toMatchObject({ rappel_minutes: 1440 });
  });

  it("ne garde un rappel qu'avec une heure précise et une valeur autorisée", async () => {
    expect(await creer({ ...minimal, heure: "09:00", rappel_minutes: "30" })).toMatchObject({ rappel_minutes: 30 });
    expect(await creer({ ...minimal, heure: "09:00", rappel_minutes: "7" })).toMatchObject({ rappel_minutes: null });
    expect(await creer({ ...minimal, rappel_minutes: "30" })).toMatchObject({ rappel_minutes: null });
  });

  it("ignore la fin de récurrence sans fréquence", async () => {
    expect(await creer({ ...minimal, recurrence_fin: "2027-01-01" })).toMatchObject({ recurrence_frequence: null, recurrence_fin: null });
    expect(await creer({ ...minimal, recurrence_frequence: "hebdomadaire", recurrence_fin: "2027-01-01" })).toMatchObject({
      recurrence_frequence: "hebdomadaire",
      recurrence_fin: "2027-01-01",
    });
  });

  it("n'écrit la durée que si elle est saisie ou si elle existait déjà", async () => {
    expect(await creer(minimal)).not.toHaveProperty("duree_minutes");
    expect(await creer({ ...minimal, duree_minutes: "45" })).toMatchObject({ duree_minutes: 45 });
    expect(await creer({ ...minimal, duree_initiale: "30" })).toMatchObject({ duree_minutes: null });
  });

  it("se place à la suite de la liste", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 7 } } : creation(a)));
    await createTache({ error: null }, form(minimal));
    expect((ecritures(fake.appels, "taches", "insert")[0].payload as Record<string, unknown>).ordre).toBe(8);
  });
});

describe("createTache : suites de la création", () => {
  it("renvoie l'id et revalide, sans avertissement quand tout réussit", async () => {
    const fake = brancher(creation);
    const res = await createTache({ error: null }, form({ ...minimal, tag_ids: [LISTE] }));
    expect(res).toEqual({ error: null, id: ID });
    expect(ecritures(fake.appels, "taches_tags", "insert")[0].payload).toEqual([{ tache_id: ID, tag_id: LISTE }]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches");
  });

  it("crée à la volée les nouveaux tags, dédoublonnés", async () => {
    const fake = brancher((a) => (a.table === "tags" ? { data: [{ id: "t1" }] } : creation(a)));
    await createTache({ error: null }, form({ ...minimal, nouveaux_tags: "maison, maison , " }));
    expect(ecritures(fake.appels, "tags", "upsert")[0].payload).toEqual([{ nom: "maison" }]);
    expect(ecritures(fake.appels, "taches_tags", "insert")[0].payload).toEqual([{ tache_id: ID, tag_id: "t1" }]);
  });

  it("renvoie l'erreur d'insertion sans revalider", async () => {
    brancher((a) => (a.table === "taches" && a.action === "insert" ? { error: { message: "insert ko" } } : undefined));
    expect(await createTache({ error: null }, form(minimal))).toEqual({ error: "insert ko" });
    expect(etat.revalidatePath).not.toHaveBeenCalled();
  });

  it("signale un échec de tags comme un avertissement : la tâche existe et le formulaire peut se fermer", async () => {
    brancher((a) => (a.table === "tags" ? { error: { message: "tags ko" } } : creation(a)));
    const res = await createTache({ error: null }, form({ ...minimal, nouveaux_tags: "x" }));
    expect(res).toEqual({
      error: null,
      id: ID,
      avertissement: "Tâche créée, mais l'enregistrement des tags a échoué. Rouvre la tâche pour réessayer.",
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches");
  });

  it("envoie les images compressées et les enregistre", async () => {
    const fake = brancher(creation);
    const res = await createTache({ error: null }, form({ ...minimal, images: [await photo("a.png"), await photo("b.png")] }));
    expect(res).toEqual({ error: null, id: ID });
    expect(fake.stockage.map((s) => [s.bucket, s.contentType])).toEqual([[BUCKET, "image/jpeg"], [BUCKET, "image/jpeg"]]);
    expect(fake.stockage[0].chemin).toMatch(new RegExp(`^${ID}/[0-9a-f-]{36}\\.jpg$`));
    expect(ecritures(fake.appels, "tache_images", "insert").map((i) => (i.payload as { ordre: number }).ordre)).toEqual([0, 1]);
  });

  it("signale un échec d'envoi d'image au singulier ou au pluriel sans refuser la tâche", async () => {
    brancher(creation, () => ({ error: { message: "envoi ko" } }));
    const un = await createTache({ error: null }, form({ ...minimal, images: await photo() }));
    expect(un.avertissement).toBe("Tâche créée, mais l'envoi de l'image a échoué. Rouvre la tâche pour réessayer.");
    const deux = await createTache({ error: null }, form({ ...minimal, images: [await photo(), await photo()] }));
    expect(deux.avertissement).toBe("Tâche créée, mais l'envoi des images a échoué. Rouvre la tâche pour réessayer.");
  });

  it("nettoie le fichier orphelin quand l'enregistrement de l'image échoue", async () => {
    const fake = brancher((a) => (a.table === "tache_images" && a.action === "insert" ? { error: { message: "ligne ko" } } : creation(a)));
    const res = await createTache({ error: null }, form({ ...minimal, images: await photo() }));
    expect(res.avertissement).toContain("l'envoi de l'image a échoué");
    const envoye = fake.stockage.find((s) => s.action === "upload")!;
    expect(fake.stockage.find((s) => s.action === "remove")).toMatchObject({ chemins: [envoye.chemin] });
  });

  it("signale tags et images ensemble", async () => {
    brancher((a) => (a.table === "tags" ? { error: { message: "tags ko" } } : creation(a)), () => ({ error: { message: "envoi ko" } }));
    const res = await createTache({ error: null }, form({ ...minimal, nouveaux_tags: "x", images: await photo() }));
    expect(res.avertissement).toBe("Tâche créée, mais l'enregistrement des tags et l'envoi de l'image ont échoué. Rouvre la tâche pour réessayer.");
  });
});

describe("updateTache", () => {
  const existante = { echeance: "2026-10-12", heure: "09:00", rappel_minutes: 15 };
  const champs = { id: ID, ...minimal, echeance: "2026-10-12", heure: "09:00", rappel_minutes: "15" };
  const lecture = (donnees: unknown = existante): Repondre => (a) =>
    a.table === "taches" && a.action === "select" ? { data: donnees } : undefined;

  it("refuse un id invalide ou une saisie invalide", async () => {
    const fake = brancher();
    expect(await updateTache({ error: null }, form({ ...minimal, id: "x" }))).toEqual({ error: "Tâche introuvable." });
    expect(await updateTache({ error: null }, form({ id: ID, titre: "", liste_id: LISTE }))).toEqual({ error: "Le titre est requis." });
    expect(fake.appels).toHaveLength(0);
  });

  it("renvoie l'erreur de lecture", async () => {
    brancher((a) => (a.action === "select" ? { error: { message: "lecture ko" } } : undefined));
    expect(await updateTache({ error: null }, form(champs))).toEqual({ error: "lecture ko" });
  });

  it("conserve le rappel déjà envoyé quand date, heure et rappel sont inchangés", async () => {
    const fake = brancher(lecture());
    expect(await updateTache({ error: null }, form(champs))).toEqual({ error: null });
    const [maj] = ecritures(fake.appels, "taches", "update");
    expect(maj.payload).not.toHaveProperty("rappel_envoye_le");
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
  });

  it.each([
    ["l'échéance", { echeance: "2026-10-13" }],
    ["l'heure", { heure: "10:00" }],
    ["le rappel", { rappel_minutes: "30" }],
  ])("réarme le rappel quand %s change", async (_nom, changement) => {
    const fake = brancher(lecture());
    await updateTache({ error: null }, form({ ...champs, ...changement }));
    expect(ecritures(fake.appels, "taches", "update")[0].payload).toMatchObject({ rappel_envoye_le: null });
  });

  it("remplace les tags de la tâche", async () => {
    const fake = brancher(lecture());
    await updateTache({ error: null }, form({ ...champs, tag_ids: [LISTE] }));
    expect(ecritures(fake.appels, "taches_tags", "delete")[0].filtres).toContainEqual(["eq", "tache_id", ID]);
    expect(ecritures(fake.appels, "taches_tags", "insert")[0].payload).toEqual([{ tache_id: ID, tag_id: LISTE }]);
  });

  it("renvoie l'erreur de mise à jour, de tags, de suppression d'images et d'envoi, en revalidant", async () => {
    brancher((a) => (a.table === "taches" && a.action === "update" ? { error: { message: "maj ko" } } : lecture()(a)));
    expect(await updateTache({ error: null }, form(champs))).toEqual({ error: "maj ko" });

    brancher((a) => (a.table === "taches_tags" && a.action === "delete" ? { error: { message: "tags ko" } } : lecture()(a)));
    expect(await updateTache({ error: null }, form(champs))).toEqual({ error: "tags ko" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches");

    brancher((a) => (a.table === "tache_images" ? { error: { message: "images ko" } } : lecture()(a)));
    expect(await updateTache({ error: null }, form({ ...champs, delete_image_ids: IMG1 }))).toEqual({ error: "images ko" });

    brancher(lecture(), () => ({ error: { message: "envoi ko" } }));
    expect(await updateTache({ error: null }, form({ ...champs, images: await photo() }))).toEqual({ error: "envoi ko" });
  });

  it("supprime du stockage puis de la base les seules images rattachées à la tâche", async () => {
    const fake = brancher((a) => {
      if (a.table === "tache_images" && a.action === "select" && a.terminal === undefined && a.filtres.some((f) => f[0] === "in")) {
        return { data: [{ id: IMG1, url: `${URL_PUBLIQUE}/${ID}/a.jpg` }] };
      }
      return lecture()(a);
    });

    await updateTache({ error: null }, form({ ...champs, delete_image_ids: [IMG1, IMG1, "pas-un-uuid"] }));

    const lecteur = fake.appels.find((a) => a.table === "tache_images" && a.action === "select")!;
    expect(lecteur.filtres).toEqual([["eq", "tache_id", ID], ["in", "id", [IMG1]]]);
    expect(fake.stockage).toEqual([{ bucket: BUCKET, action: "remove", chemins: [`${ID}/a.jpg`] }]);
    expect(ecritures(fake.appels, "tache_images", "delete")[0].filtres).toEqual([["eq", "tache_id", ID], ["in", "id", [IMG1]]]);
  });

  it("ne touche ni au stockage ni à la base quand aucune image à supprimer n'est valide", async () => {
    const fake = brancher(lecture());
    await updateTache({ error: null }, form({ ...champs, delete_image_ids: "pas-un-uuid" }));
    expect(fake.stockage).toHaveLength(0);
    expect(fake.appels.some((a) => a.table === "tache_images")).toBe(false);
  });

  it("garde la ligne d'image si la suppression du fichier échoue", async () => {
    const fake = brancher(
      (a) =>
        a.table === "tache_images" && a.action === "select" ? { data: [{ id: IMG1, url: `${URL_PUBLIQUE}/${ID}/a.jpg` }] } : lecture()(a),
      () => ({ error: { message: "stockage ko" } })
    );
    expect(await updateTache({ error: null }, form({ ...champs, delete_image_ids: IMG1 }))).toEqual({ error: "stockage ko" });
    expect(ecritures(fake.appels, "tache_images", "delete")).toHaveLength(0);
  });
});

describe("listes", () => {
  it("createListe valide, se place à la suite et revalide", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 2 } } : undefined));
    expect(await createListe({ error: null }, form({ nom: " " }))).toEqual({ error: "Le nom est requis." });
    expect(await createListe({ error: null }, form({ nom: " Maison ", couleur: "#fff" }))).toEqual({ error: null });
    expect(ecritures(fake.appels, "listes_taches", "insert")[0].payload).toEqual({ nom: "Maison", couleur: "#fff", ordre: 3 });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches/listes");
    expect(etat.revalidateTag).toHaveBeenCalledWith("taches", { expire: 0 });

    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await createListe({ error: null }, form({ nom: "x" }))).toEqual({ error: "ko" });
  });

  it("updateListe valide et met à jour la liste ciblée", async () => {
    const fake = brancher();
    expect(await updateListe({ error: null }, form({ nom: "x" }))).toEqual({ error: "Liste introuvable." });
    expect(await updateListe({ error: null }, form({ id: ID, nom: " " }))).toEqual({ error: "Le nom est requis." });
    expect(await updateListe({ error: null }, form({ id: ID, nom: " Travail " }))).toEqual({ error: null });
    const [maj] = ecritures(fake.appels, "listes_taches", "update");
    expect(maj.payload).toEqual({ nom: "Travail", couleur: null });
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);

    brancher(() => ({ error: { message: "ko" } }));
    expect(await updateListe({ error: null }, form({ id: ID, nom: "x" }))).toEqual({ error: "ko" });
  });

  it("reordonnerListes échange l'ordre avec la voisine et ignore les extrémités", async () => {
    const listes = [{ id: "a", ordre: 0 }, { id: "b", ordre: 1 }];
    const fake = brancher((a) => (a.action === "select" ? { data: listes } : undefined));
    await reordonnerListes("a", "bas");
    expect(ecritures(fake.appels, "listes_taches", "update").map((m) => [m.payload, m.filtres[0]])).toEqual([
      [{ ordre: 1 }, ["eq", "id", "a"]],
      [{ ordre: 0 }, ["eq", "id", "b"]],
    ]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches/listes");

    const sans = brancher((a) => (a.action === "select" ? { data: listes } : undefined));
    await reordonnerListes("a", "haut");
    await reordonnerListes("b", "bas");
    await reordonnerListes("zzz", "bas");
    expect(ecritures(sans.appels, "listes_taches")).toHaveLength(0);
  });

  it("reordonnerListes lève les erreurs", async () => {
    brancher(() => ({ error: { message: "lecture ko" } }));
    await expect(reordonnerListes("a", "bas")).rejects.toThrow("lecture ko");
    brancher((a) => (a.action === "select" ? { data: [{ id: "a", ordre: 0 }, { id: "b", ordre: 1 }] } : { error: { message: "maj ko" } }));
    await expect(reordonnerListes("a", "bas")).rejects.toThrow("maj ko");
  });

  it("getListes, getTags et getComptesTachesParListe lisent et lèvent sur erreur", async () => {
    brancher(() => ({ data: [{ id: "l1" }] }));
    expect(await getListes()).toEqual([{ id: "l1" }]);
    expect(await getTags()).toEqual([{ id: "l1" }]);
    brancher(() => ({ data: [{ liste_id: "A", fait: true }, { liste_id: "A", fait: false }, { liste_id: "B", fait: false }] }));
    expect(await getComptesTachesParListe()).toEqual({ A: { total: 2, faites: 1 }, B: { total: 1, faites: 0 } });
    brancher();
    expect(await getListes()).toEqual([]);
    expect(await getComptesTachesParListe()).toEqual({});
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getListes()).rejects.toThrow("ko");
    await expect(getTags()).rejects.toThrow("ko");
    await expect(getComptesTachesParListe()).rejects.toThrow("ko");
  });
});

describe("deleteListe", () => {
  const tachesDeLaListe = [{ id: "t1", fait: true }, { id: "t2", fait: false }];

  function scenario(surcharge: Repondre = () => undefined, stockage?: RepondreStockage) {
    return brancher((a) => {
      const personnalise = surcharge(a);
      if (personnalise) return personnalise;
      if (a.table === "listes_taches" && a.action === "select") return { data: { nom: "Projets" } };
      if (a.table === "taches" && a.action === "select") return { data: tachesDeLaListe };
      if (a.table === "tache_images") return { data: [{ url: `${URL_PUBLIQUE}/t1/a.jpg` }] };
      return undefined;
    }, stockage);
  }

  it("considère une liste déjà supprimée comme un succès", async () => {
    brancher();
    expect(await deleteListe(ID)).toEqual({ error: null });
  });

  it("refuse de supprimer la liste Général", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { nom: "Général" } } : undefined));
    expect(await deleteListe(ID, true)).toEqual({ error: 'La liste "Général" ne peut pas être supprimée.' });
    expect(ecritures(fake.appels, "listes_taches")).toHaveLength(0);
  });

  it("demande confirmation avec le nombre exact de tâches avant de supprimer quoi que ce soit", async () => {
    const fake = scenario();
    expect(await deleteListe(ID)).toEqual({ error: null, confirmation: { total: 2, faites: 1 } });
    expect(ecritures(fake.appels, "taches")).toHaveLength(0);
    expect(fake.stockage).toHaveLength(0);
  });

  it("redemande confirmation si le nombre de tâches a changé depuis la confirmation", async () => {
    const fake = scenario();
    expect(await deleteListe(ID, true, 5)).toEqual({ error: null, confirmation: { total: 2, faites: 1 } });
    expect(ecritures(fake.appels, "taches")).toHaveLength(0);
  });

  it("supprime les images, les tâches puis la liste une fois confirmé", async () => {
    const fake = scenario();
    expect(await deleteListe(ID, true, 2)).toEqual({ error: null });
    expect(fake.stockage).toEqual([{ bucket: BUCKET, action: "remove", chemins: ["t1/a.jpg"] }]);
    expect(ecritures(fake.appels, "taches", "delete")[0].filtres).toContainEqual(["in", "id", ["t1", "t2"]]);
    expect(ecritures(fake.appels, "listes_taches", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches/listes");
  });

  it("supprime directement une liste vide, sans confirmation", async () => {
    const fake = scenario((a) => (a.table === "taches" && a.action === "select" ? { data: [] } : undefined));
    expect(await deleteListe(ID)).toEqual({ error: null });
    expect(ecritures(fake.appels, "taches")).toHaveLength(0);
    expect(ecritures(fake.appels, "listes_taches", "delete")).toHaveLength(1);
  });

  it("n'accepte pas de totalAttendu vide pour une suppression non confirmée", async () => {
    scenario();
    expect(await deleteListe(ID, false, 2)).toEqual({ error: null, confirmation: { total: 2, faites: 1 } });
  });

  it("ne supprime rien si les images ne peuvent pas être listées ou supprimées", async () => {
    const lecture = scenario((a) => (a.table === "tache_images" ? { error: { message: "x" } } : undefined));
    expect((await deleteListe(ID, true)).error).toContain("rien n'a été supprimé");
    expect(ecritures(lecture.appels, "taches")).toHaveLength(0);

    const stockage = scenario(undefined, () => ({ error: { message: "x" } }));
    expect((await deleteListe(ID, true)).error).toContain("aucune tâche ni liste n'a été supprimée");
    expect(ecritures(stockage.appels, "taches")).toHaveLength(0);
  });

  it("explique l'échec en cours de route de la suppression des tâches", async () => {
    const fake = scenario((a) => (a.table === "taches" && a.action === "delete" ? { error: { message: "x" } } : undefined));
    expect((await deleteListe(ID, true)).error).toContain("a échoué en cours de route");
    expect(ecritures(fake.appels, "listes_taches")).toHaveLength(0);
  });

  it("explique l'échec de la suppression de la liste et les erreurs de lecture", async () => {
    scenario((a) => (a.table === "listes_taches" && a.action === "delete" ? { error: { message: "x" } } : undefined));
    expect((await deleteListe(ID, true)).error).toContain("La liste n'a pas pu être supprimée");

    scenario((a) => (a.table === "listes_taches" && a.action === "select" ? { error: { message: "x" } } : undefined));
    expect((await deleteListe(ID)).error).toBe("Impossible de lire la liste. Réessaie.");

    scenario((a) => (a.table === "taches" && a.action === "select" ? { error: { message: "x" } } : undefined));
    expect((await deleteListe(ID)).error).toBe("Impossible de compter les tâches de la liste. Réessaie.");
  });

  it("supprime les tâches par lots de 100", async () => {
    const beaucoup = Array.from({ length: 250 }, (_, i) => ({ id: `t${i}`, fait: false }));
    const fake = scenario((a) => (a.table === "taches" && a.action === "select" ? { data: beaucoup } : a.table === "tache_images" ? { data: [] } : undefined));
    await deleteListe(ID, true, 250);
    const lots = ecritures(fake.appels, "taches", "delete").map((d) => (d.filtres[0][2] as string[]).length);
    expect(lots).toEqual([100, 100, 50]);
  });
});

describe("tags", () => {
  it("createTag valide, insère et revalide", async () => {
    const fake = brancher();
    expect(await createTag({ error: null }, form({ nom: " " }))).toEqual({ error: "Le nom est requis." });
    expect(await createTag({ error: null }, form({ nom: " urgent ", couleur: "#f00" }))).toEqual({ error: null });
    expect(ecritures(fake.appels, "tags", "insert")[0].payload).toEqual({ nom: "urgent", couleur: "#f00" });
    brancher(() => ({ error: { message: "ko" } }));
    expect(await createTag({ error: null }, form({ nom: "x" }))).toEqual({ error: "ko" });
  });

  it("deleteTag expire aussi le cache des notes", async () => {
    const fake = brancher();
    await deleteTag(ID);
    expect(ecritures(fake.appels, "tags", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
    expect(etat.revalidateTag).toHaveBeenCalledWith("notes", { expire: 0 });
    brancher(() => ({ error: { message: "ko" } }));
    await expect(deleteTag(ID)).rejects.toThrow("ko");
  });
});

describe("sous-tâches", () => {
  it("createSousTache valide, se place à la suite et masque l'erreur technique", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 1 } } : undefined));
    expect(await createSousTache(ID, " ")).toEqual({ ok: false, error: "Le titre de la sous-tâche est requis." });
    expect(await createSousTache(ID, " Réserver ")).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "sous_taches", "insert")[0].payload).toEqual({ tache_id: ID, titre: "Réserver", ordre: 2 });

    brancher((a) => (a.action === "insert" ? { error: { message: "violates fk" } } : undefined));
    expect(await createSousTache(ID, "x")).toEqual({ ok: false, error: "La sous-tâche n'a pas pu être ajoutée. Réessaie." });
  });

  it("toggleSousTache et deleteSousTache ciblent la ligne et renvoient un message lisible", async () => {
    const fake = brancher();
    expect(await toggleSousTache(ID, true)).toMatchObject({ ok: true });
    expect(await deleteSousTache(ID)).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "sous_taches", "update")[0].payload).toEqual({ fait: true });
    expect(ecritures(fake.appels, "sous_taches", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);

    brancher(() => ({ error: { message: "ko" } }));
    expect(await toggleSousTache(ID, true)).toEqual({ ok: false, error: "La sous-tâche n'a pas pu être mise à jour. Réessaie." });
    expect(await deleteSousTache(ID)).toEqual({ ok: false, error: "La sous-tâche n'a pas pu être supprimée. Réessaie." });
  });

  it("reordonnerSousTaches échange avec la voisine, ignore les extrémités, renvoie un message en cas d'échec", async () => {
    const items = [{ id: "a", ordre: 0 }, { id: "b", ordre: 1 }];
    const fake = brancher((a) => (a.action === "select" ? { data: items } : undefined));
    expect(await reordonnerSousTaches(ID, "b", "haut")).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "sous_taches", "update").map((m) => [m.payload, m.filtres[0]])).toEqual([
      [{ ordre: 0 }, ["eq", "id", "b"]],
      [{ ordre: 1 }, ["eq", "id", "a"]],
    ]);

    const sans = brancher((a) => (a.action === "select" ? { data: items } : undefined));
    await reordonnerSousTaches(ID, "a", "haut");
    await reordonnerSousTaches(ID, "zzz", "bas");
    expect(ecritures(sans.appels, "sous_taches")).toHaveLength(0);

    const message = { ok: false, error: "L'ordre des sous-tâches n'a pas pu être modifié. Réessaie." };
    brancher(() => ({ error: { message: "ko" } }));
    expect(await reordonnerSousTaches(ID, "a", "bas")).toEqual(message);
    brancher((a) => (a.action === "select" ? { data: items } : { error: { message: "ko" } }));
    expect(await reordonnerSousTaches(ID, "a", "bas")).toEqual(message);
  });
});

describe("getTachesAvecRelations", () => {
  it("aplatit les tags, écarte les tags null et renomme les images", async () => {
    brancher(() => ({
      data: [
        {
          id: ID,
          titre: "x",
          sous_taches: [{ id: "s1" }],
          taches_tags: [{ tag: { id: "t1", nom: "a" } }, { tag: null }],
          tache_images: [{ id: "i1" }],
        },
      ],
    }));
    const [tache] = await getTachesAvecRelations();
    expect(tache.tags).toEqual([{ id: "t1", nom: "a" }]);
    expect(tache.images).toEqual([{ id: "i1" }]);
    expect(tache.sous_taches).toEqual([{ id: "s1" }]);
    expect(tache).not.toHaveProperty("taches_tags");
    expect(tache).not.toHaveProperty("tache_images");
  });

  it("renvoie [] sans données et lève sur erreur", async () => {
    brancher();
    expect(await getTachesAvecRelations()).toEqual([]);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getTachesAvecRelations()).rejects.toThrow("ko");
  });
});
