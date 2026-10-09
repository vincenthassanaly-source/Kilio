// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath, updateTag: etat.updateTag }));
vi.mock("next/navigation", () => ({ redirect: etat.redirect }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  ajouterEtape,
  changerStatutObjectif,
  creerObjectif,
  deplacerEtape,
  enregistrerEntreeObjectif,
  getHabitudeIdsDeLObjectif,
  getHabitudesActives,
  getObjectif,
  getObjectifs,
  modifierObjectif,
  supprimerEntreeObjectif,
  supprimerEtape,
  supprimerObjectif,
  toggleEtape,
} from "./objectifs";

const ID = "11111111-1111-4111-8111-111111111111";
const H1 = "22222222-2222-4222-8222-222222222222";
const H2 = "33333333-3333-4333-8333-333333333333";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function form(champs: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

const base = { titre: "Courir 10 km", categorie: "perso", type_suivi: "binaire" };

beforeEach(() => {
  vi.clearAllMocks();
  etat.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creerObjectif : validation", () => {
  it.each([
    ["titre vide", { ...base, titre: " " }, "Le titre est requis."],
    ["catégorie inconnue", { ...base, categorie: "loisir" }, "Catégorie invalide."],
    ["type de suivi inconnu", { ...base, type_suivi: "magique" }, "Type de suivi invalide."],
    ["habitudes sans habitude", { ...base, type_suivi: "habitudes" }, "Choisis au moins une habitude à rattacher."],
    ["valeur cible négative", { ...base, type_suivi: "valeur", valeur_cible: "-5" }, "La valeur cible doit être un nombre positif."],
    ["valeur cible non numérique", { ...base, type_suivi: "valeur", valeur_cible: "dix" }, "La valeur cible doit être un nombre positif."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await creerObjectif({ error: null }, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("creerObjectif", () => {
  it("insère à la suite, sans habitude liée, et expire le cache des habitudes", async () => {
    const fake = brancher((a) => {
      if (a.table === "objectifs" && a.action === "select") return { data: { ordre: 2 } };
      if (a.table === "objectifs" && a.action === "insert") return { data: { id: ID } };
      return undefined;
    });

    const res = await creerObjectif(
      { error: null },
      form({ ...base, description: " Pour l'été ", date_echeance: "2027-06-01", unite: "km" })
    );

    expect(res).toEqual({ error: null });
    expect(ecritures(fake.appels, "objectifs", "insert")[0].payload).toEqual({
      titre: "Courir 10 km",
      description: "Pour l'été",
      categorie: "perso",
      type_suivi: "binaire",
      date_echeance: "2027-06-01",
      valeur_cible: null,
      unite: null, // l'unité n'a de sens que pour un suivi par valeur
      ordre: 3,
    });
    // Aucune habitude : seul le nettoyage des liens est exécuté.
    expect(ecritures(fake.appels, "objectif_habitudes", "delete")).toHaveLength(1);
    expect(ecritures(fake.appels, "objectif_habitudes", "insert")).toHaveLength(0);
    expect(etat.updateTag).toHaveBeenCalledWith("habitudes");
    expect(etat.revalidatePath).toHaveBeenCalledWith("/objectifs");
  });

  it("garde unité et valeur cible pour un suivi par valeur", async () => {
    const fake = brancher((a) => (a.action === "insert" ? { data: { id: ID } } : undefined));
    await creerObjectif({ error: null }, form({ ...base, type_suivi: "valeur", valeur_cible: "10", unite: "km" }));
    expect(ecritures(fake.appels, "objectifs", "insert")[0].payload).toMatchObject({ valeur_cible: 10, unite: "km", ordre: 0 });
  });

  it("rattache les habitudes choisies (dédoublonnées) pour un suivi par habitudes", async () => {
    const fake = brancher((a) => (a.table === "objectifs" && a.action === "insert" ? { data: { id: ID } } : undefined));

    await creerObjectif({ error: null }, form({ ...base, type_suivi: "habitudes", habitude_ids: [H1, H2, H1] }));

    expect(ecritures(fake.appels, "objectif_habitudes", "insert")[0].payload).toEqual([
      { objectif_id: ID, habitude_id: H1 },
      { objectif_id: ID, habitude_id: H2 },
    ]);
  });

  it("refuse un second objectif Nutrition, qui est permanent et sans échéance", async () => {
    const fake = brancher((a) =>
      a.table === "objectifs" && a.action === "select" && a.filtres.some((f) => f[0] === "eq" && f[1] === "type_suivi")
        ? { data: [{ id: "autre" }] }
        : undefined
    );
    expect(await creerObjectif({ error: null }, form({ ...base, type_suivi: "nutrition" }))).toEqual({
      error: "Tu as déjà un objectif Nutrition : un seul est possible.",
    });
    expect(ecritures(fake.appels, "objectifs")).toHaveLength(0);
  });

  it("crée un objectif Nutrition sans échéance quand il n'y en a pas encore", async () => {
    const fake = brancher((a) => (a.action === "insert" ? { data: { id: ID } } : undefined));
    expect(
      await creerObjectif({ error: null }, form({ ...base, type_suivi: "nutrition", date_echeance: "2027-01-01" }))
    ).toEqual({ error: null });
    expect(ecritures(fake.appels, "objectifs", "insert")[0].payload).toMatchObject({ date_echeance: null });
  });

  it("remonte l'erreur d'insertion et celle du rattachement des habitudes", async () => {
    brancher((a) => (a.table === "objectifs" && a.action === "insert" ? { error: { message: "insert ko" } } : undefined));
    expect(await creerObjectif({ error: null }, form(base))).toEqual({ error: "insert ko" });

    brancher((a) => {
      if (a.table === "objectifs" && a.action === "insert") return { data: { id: ID } };
      if (a.table === "objectif_habitudes" && a.action === "delete") return { error: { message: "suppression ko" } };
      return undefined;
    });
    expect(await creerObjectif({ error: null }, form(base))).toEqual({ error: "suppression ko" });
    expect(etat.updateTag).not.toHaveBeenCalled();
  });
});

describe("modifierObjectif", () => {
  it("refuse sans id et valide la saisie", async () => {
    brancher();
    expect(await modifierObjectif({ error: null }, form(base))).toEqual({ error: "Objectif introuvable." });
    expect(await modifierObjectif({ error: null }, form({ ...base, id: ID, titre: "" }))).toEqual({ error: "Le titre est requis." });
  });

  it("met à jour la ligne ciblée, remplace les habitudes et revalide le détail", async () => {
    const fake = brancher();
    expect(
      await modifierObjectif({ error: null }, form({ ...base, id: ID, type_suivi: "habitudes", habitude_ids: [H1] }))
    ).toEqual({ error: null });

    const [maj] = ecritures(fake.appels, "objectifs", "update");
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
    expect(maj.payload).not.toHaveProperty("habitude_ids");
    expect(ecritures(fake.appels, "objectif_habitudes", "insert")[0].payload).toEqual([{ objectif_id: ID, habitude_id: H1 }]);
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/objectifs/${ID}`);
  });

  it("ignore l'objectif édité dans la recherche de doublon Nutrition", async () => {
    const fake = brancher();
    await modifierObjectif({ error: null }, form({ ...base, id: ID, type_suivi: "nutrition" }));
    const verif = fake.appels.find((a) => a.table === "objectifs" && a.action === "select")!;
    expect(verif.filtres).toContainEqual(["neq", "id", ID]);
  });

  it("remonte l'erreur de mise à jour", async () => {
    brancher((a) => (a.action === "update" ? { error: { message: "maj ko" } } : undefined));
    expect(await modifierObjectif({ error: null }, form({ ...base, id: ID }))).toEqual({ error: "maj ko" });
  });
});

describe("statut, suppression et lectures simples", () => {
  it("changerStatutObjectif refuse un statut inconnu et met à jour sinon", async () => {
    const fake = brancher();
    await expect(changerStatutObjectif(ID, "perdu" as never)).rejects.toThrow("Statut invalide.");
    expect(fake.appels).toHaveLength(0);

    await changerStatutObjectif(ID, "atteint");
    expect(ecritures(fake.appels, "objectifs", "update")[0].payload).toEqual({ statut: "atteint" });
    expect(etat.updateTag).toHaveBeenCalledWith("habitudes");

    brancher(() => ({ error: { message: "ko" } }));
    await expect(changerStatutObjectif(ID, "abandonne")).rejects.toThrow("ko");
  });

  it("supprimerObjectif supprime puis redirige vers la liste", async () => {
    const fake = brancher();
    await expect(supprimerObjectif(ID)).rejects.toThrow("REDIRECT:/objectifs");
    expect(ecritures(fake.appels, "objectifs", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
  });

  it("supprimerObjectif ne redirige pas si la suppression échoue", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(supprimerObjectif(ID)).rejects.toThrow("ko");
    expect(etat.redirect).not.toHaveBeenCalled();
  });

  it("getObjectifs, getHabitudesActives et getHabitudeIdsDeLObjectif lisent et lèvent sur erreur", async () => {
    brancher(() => ({ data: [{ id: ID }] }));
    expect(await getObjectifs()).toEqual([{ id: ID }]);
    brancher(() => ({ data: [{ habitude_id: H1 }, { habitude_id: H2 }] }));
    expect(await getHabitudeIdsDeLObjectif(ID)).toEqual([H1, H2]);
    brancher();
    expect(await getObjectifs()).toEqual([]);
    expect(await getHabitudesActives()).toEqual([]);

    brancher(() => ({ error: { message: "ko" } }));
    await expect(getObjectifs()).rejects.toThrow("ko");
    await expect(getHabitudesActives()).rejects.toThrow("ko");
    await expect(getHabitudeIdsDeLObjectif(ID)).rejects.toThrow("ko");
  });
});

describe("getObjectif", () => {
  const objectif = (type_suivi: string) => ({
    id: ID,
    type_suivi,
    created_at: "2026-10-01T08:00:00Z",
    date_echeance: null,
  });

  it("renvoie null pour un objectif inconnu et lève sur erreur de lecture", async () => {
    brancher();
    expect(await getObjectif(ID)).toBeNull();
    brancher((a) => (a.table === "objectifs" ? { error: { message: "ko" } } : undefined));
    await expect(getObjectif(ID)).rejects.toThrow("ko");
  });

  it("renvoie étapes et entrées sans calcul pour un suivi simple", async () => {
    brancher((a) => {
      if (a.table === "objectifs") return { data: objectif("etapes") };
      if (a.table === "objectif_etapes") return { data: [{ id: "e1" }] };
      if (a.table === "objectif_entries") return { data: [{ id: "m1" }] };
      return undefined;
    });
    const res = await getObjectif(ID);
    expect(res).toMatchObject({ etapes: [{ id: "e1" }], entries: [{ id: "m1" }], habitudes: [], progression: null, suiviNutrition: null });
  });

  it("lève l'erreur de lecture des étapes ou des entrées", async () => {
    brancher((a) =>
      a.table === "objectifs" ? { data: objectif("etapes") } : a.table === "objectif_etapes" ? { error: { message: "étapes ko" } } : undefined
    );
    await expect(getObjectif(ID)).rejects.toThrow("étapes ko");
    brancher((a) =>
      a.table === "objectifs" ? { data: objectif("etapes") } : a.table === "objectif_entries" ? { error: { message: "entrées ko" } } : undefined
    );
    await expect(getObjectif(ID)).rejects.toThrow("entrées ko");
  });

  it("calcule la progression d'un objectif par habitudes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    const habitude = {
      id: H1,
      nom: "Lire",
      icone: "📚",
      type: "boolean",
      valeur_cible: null,
      frequence_hebdo: null,
      actif: true,
      created_at: "2026-09-01T00:00:00Z",
      archivee_le: null,
    };
    brancher((a) => {
      if (a.table === "objectifs") return { data: objectif("habitudes") };
      if (a.table === "objectif_habitudes") return { data: [{ habitudes: habitude }, { habitudes: null }] };
      if (a.table === "habitude_entries") return { data: [{ habitude_id: H1, date: "2026-10-02", valeur: 1 }] };
      return undefined;
    });

    const res = await getObjectif(ID);

    expect(res!.habitudes).toHaveLength(1);
    expect(res!.habitudes[0]).toMatchObject({ id: H1, nom: "Lire", actif: true });
    expect(res!.progression).toEqual(expect.any(Number));
    expect(res!.progression).toBeGreaterThan(0);
    expect(res!.progression).toBeLessThanOrEqual(1);
  });

  it("renvoie une progression de 0 quand aucune habitude n'est rattachée", async () => {
    brancher((a) => (a.table === "objectifs" ? { data: objectif("habitudes") } : undefined));
    expect(await getObjectif(ID)).toMatchObject({ habitudes: [], progression: 0 });
  });

  it("lève l'erreur de lecture des liens ou des entrées d'habitudes", async () => {
    brancher((a) =>
      a.table === "objectifs" ? { data: objectif("habitudes") } : a.table === "objectif_habitudes" ? { error: { message: "liens ko" } } : undefined
    );
    await expect(getObjectif(ID)).rejects.toThrow("liens ko");

    brancher((a) => {
      if (a.table === "objectifs") return { data: objectif("habitudes") };
      if (a.table === "objectif_habitudes") return { data: [{ habitudes: { id: H1, nom: "x", type: "boolean", created_at: "2026-09-01T00:00:00Z" } }] };
      if (a.table === "habitude_entries") return { error: { message: "entrées ko" } };
      return undefined;
    });
    await expect(getObjectif(ID)).rejects.toThrow("entrées ko");
  });

  it("construit le suivi Nutrition sur 90 jours, sans cible tant qu'aucune n'est définie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    brancher((a) => (a.table === "objectifs" ? { data: objectif("nutrition") } : undefined));

    const res = await getObjectif(ID);

    expect(res!.suiviNutrition!.jours).toHaveLength(90);
    expect(res!.suiviNutrition!.aDesCibles).toBe(false);
  });

  it("détecte les cibles du Journal pour le suivi Nutrition", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    brancher((a) => {
      if (a.table === "objectifs") return { data: objectif("nutrition") };
      if (a.table === "objectifs_nutritionnels") {
        return { data: [{ jour_type: "repos", kcal_cible: 2000, proteines_cible_g: 100, glucides_cible_g: 200, lipides_cible_g: 60 }] };
      }
      return undefined;
    });
    expect((await getObjectif(ID))!.suiviNutrition!.aDesCibles).toBe(true);
  });

  it("lève l'erreur de lecture des cibles nutritionnelles", async () => {
    brancher((a) =>
      a.table === "objectifs"
        ? { data: objectif("nutrition") }
        : a.table === "objectifs_nutritionnels"
          ? { error: { message: "cibles ko" } }
          : undefined
    );
    await expect(getObjectif(ID)).rejects.toThrow("cibles ko");
  });
});

describe("étapes", () => {
  it("ajouterEtape refuse un titre vide et se place en fin de liste", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 4 } } : undefined));
    await expect(ajouterEtape(ID, "  ")).rejects.toThrow("Le titre de l'étape est requis.");
    expect(fake.appels).toHaveLength(0);

    await ajouterEtape(ID, " Acheter des chaussures ");
    expect(ecritures(fake.appels, "objectif_etapes", "insert")[0].payload).toEqual({
      objectif_id: ID,
      titre: "Acheter des chaussures",
      ordre: 5,
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/objectifs/${ID}`);
  });

  it("toggleEtape et supprimerEtape ciblent l'étape et lèvent sur erreur", async () => {
    const fake = brancher();
    await toggleEtape(ID, H1, true);
    await supprimerEtape(ID, H1);
    expect(ecritures(fake.appels, "objectif_etapes", "update")[0].payload).toEqual({ fait: true });
    expect(ecritures(fake.appels, "objectif_etapes", "delete")[0].filtres).toContainEqual(["eq", "id", H1]);

    brancher(() => ({ error: { message: "ko" } }));
    await expect(toggleEtape(ID, H1, true)).rejects.toThrow("ko");
    await expect(supprimerEtape(ID, H1)).rejects.toThrow("ko");
    await expect(ajouterEtape(ID, "x")).rejects.toThrow("ko");
  });

  const etapes = [{ id: "a", ordre: 0 }, { id: "b", ordre: 1 }, { id: "c", ordre: 2 }];

  it("deplacerEtape échange l'ordre avec la voisine", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: etapes } : undefined));
    await deplacerEtape(ID, "b", "haut");
    const majs = ecritures(fake.appels, "objectif_etapes", "update");
    expect(majs.map((m) => [m.payload, m.filtres[0]])).toEqual([
      [{ ordre: 0 }, ["eq", "id", "b"]],
      [{ ordre: 1 }, ["eq", "id", "a"]],
    ]);
  });

  it("deplacerEtape ne fait rien aux extrémités ni pour une étape inconnue", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: etapes } : undefined));
    await deplacerEtape(ID, "a", "haut");
    await deplacerEtape(ID, "c", "bas");
    await deplacerEtape(ID, "zzz", "bas");
    expect(ecritures(fake.appels, "objectif_etapes")).toHaveLength(0);
  });

  it("deplacerEtape lève les erreurs de lecture et d'écriture", async () => {
    brancher(() => ({ error: { message: "lecture ko" } }));
    await expect(deplacerEtape(ID, "b", "bas")).rejects.toThrow("lecture ko");

    brancher((a) => (a.action === "select" ? { data: etapes } : { error: { message: "maj ko" } }));
    await expect(deplacerEtape(ID, "b", "bas")).rejects.toThrow("maj ko");
  });
});

describe("entrées de mesure", () => {
  it.each([
    ["vide", "", "Saisis une valeur, ou supprime la mesure de ce jour."],
    ["espaces", "   ", "Saisis une valeur, ou supprime la mesure de ce jour."],
    ["texte", "abc", "Valeur invalide : saisis un nombre."],
  ])("refuse une valeur %s", async (_nom, saisie, erreur) => {
    const fake = brancher();
    expect(await enregistrerEntreeObjectif(ID, "2026-10-09", saisie)).toEqual({ ok: false, error: erreur });
    expect(fake.appels).toHaveLength(0);
  });

  it("refuse une date invalide", async () => {
    expect(await enregistrerEntreeObjectif(ID, "9 octobre", "12")).toEqual({ ok: false, error: "Date invalide." });
  });

  it("accepte la virgule décimale et le zéro, et enregistre par upsert", async () => {
    const fake = brancher();
    expect(await enregistrerEntreeObjectif(ID, "2026-10-09", " 72,5 ")).toMatchObject({ ok: true });
    expect(await enregistrerEntreeObjectif(ID, "2026-10-09", 0)).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "objectif_entries", "upsert").map((e) => e.payload)).toEqual([
      { objectif_id: ID, date: "2026-10-09", valeur: 72.5 },
      { objectif_id: ID, date: "2026-10-09", valeur: 0 },
    ]);
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/objectifs/${ID}`);
  });

  it("masque l'erreur Supabase derrière un message utilisateur", async () => {
    brancher(() => ({ error: { message: "duplicate key value violates" } }));
    expect(await enregistrerEntreeObjectif(ID, "2026-10-09", "5")).toEqual({
      ok: false,
      error: "La valeur n'a pas pu être enregistrée. Réessaie.",
    });
  });

  it("supprimerEntreeObjectif cible l'objectif et la date", async () => {
    const fake = brancher();
    expect(await supprimerEntreeObjectif(ID, "2026-10-09")).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "objectif_entries", "delete")[0].filtres).toEqual([
      ["eq", "objectif_id", ID],
      ["eq", "date", "2026-10-09"],
    ]);

    brancher(() => ({ error: { message: "ko" } }));
    expect(await supprimerEntreeObjectif(ID, "2026-10-09")).toEqual({
      ok: false,
      error: "La mesure n'a pas pu être supprimée. Réessaie.",
    });
  });
});
