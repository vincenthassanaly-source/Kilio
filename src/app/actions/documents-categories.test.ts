// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  creerCategorie,
  fusionnerCategories,
  getCategories,
  getCategoriesAvecCompte,
  renommerCategorie,
  supprimerCategorie,
} from "./documents-categories";

const SANTE = { id: "C1", nom: "Santé" };
const AUTRE = { id: "C2", nom: "Autre" };

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe("getCategories", () => {
  it("retombe sur les catégories d'origine quand la table est absente (migration pas appliquée)", async () => {
    brancher((a) =>
      a.table === "documents_categories" ? { error: { message: 'relation "documents_categories" does not exist' } } : undefined
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const categories = await getCategories();

    expect(categories.map((c) => c.nom)).toEqual(["Assurance", "Autre", "Identité", "Logement", "Santé", "Véhicule"]);
  });
});

describe("getCategoriesAvecCompte", () => {
  it("compte les documents par catégorie, triées par nom", async () => {
    brancher((a) => {
      if (a.table === "documents_categories") return { data: [SANTE, AUTRE] };
      if (a.table === "documents") return { data: [{ categorie: "Santé" }, { categorie: "Santé" }, { categorie: "Inconnue" }] };
      return undefined;
    });

    expect(await getCategoriesAvecCompte()).toEqual([
      { ...AUTRE, nb: 0 },
      { ...SANTE, nb: 2 },
    ]);
  });
});

describe("creerCategorie", () => {
  it("crée la catégorie avec un nom nettoyé", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: [SANTE] } : undefined));

    expect(await creerCategorie("  Banque  ")).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "documents_categories", "insert")[0].payload).toEqual({ nom: "Banque" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/documents/categories");
  });

  it("refuse un doublon malgré la casse et les accents", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: [SANTE] } : undefined));

    expect(await creerCategorie("sante")).toEqual({ ok: false, error: "Cette catégorie existe déjà." });
    expect(ecritures(fake.appels, "documents_categories")).toHaveLength(0);
  });

  it("refuse un nom vide ou trop long", async () => {
    const fake = brancher();
    expect(await creerCategorie("   ")).toMatchObject({ ok: false });
    expect(await creerCategorie("x".repeat(41))).toMatchObject({ ok: false });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("renommerCategorie", () => {
  it("renomme la catégorie et suit ses documents", async () => {
    const fake = brancher((a) => (a.table === "documents_categories" && a.action === "select" ? { data: [SANTE, AUTRE] } : undefined));

    expect(await renommerCategorie("C1", "Santé & mutuelle")).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "documents_categories", "update")[0].payload).toEqual({ nom: "Santé & mutuelle" });
    const documents = ecritures(fake.appels, "documents", "update")[0];
    expect(documents.payload).toEqual({ categorie: "Santé & mutuelle" });
    expect(documents.filtres).toContainEqual(["eq", "categorie", "Santé"]);
  });

  it("refuse le nom d'une autre catégorie : c'est une fusion", async () => {
    const fake = brancher((a) => (a.table === "documents_categories" && a.action === "select" ? { data: [SANTE, AUTRE] } : undefined));

    expect(await renommerCategorie("C1", "autre")).toMatchObject({ ok: false });
    expect(ecritures(fake.appels, "documents_categories")).toHaveLength(0);
  });

  it("remet l'ancien nom quand les documents ne suivent pas", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories" && a.action === "select") return { data: [SANTE] };
      if (a.table === "documents" && a.action === "update") return { error: { message: "boom" } };
      return undefined;
    });

    expect(await renommerCategorie("C1", "Mutuelle")).toMatchObject({ ok: false });
    const miseAJour = ecritures(fake.appels, "documents_categories", "update");
    expect(miseAJour.map((a) => a.payload)).toEqual([{ nom: "Mutuelle" }, { nom: "Santé" }]);
  });

  it("signale une catégorie introuvable", async () => {
    brancher((a) => (a.action === "select" ? { data: [AUTRE] } : undefined));
    expect(await renommerCategorie("C1", "Mutuelle")).toEqual({ ok: false, error: "Catégorie introuvable." });
  });
});

describe("supprimerCategorie", () => {
  it("retire la catégorie des documents sans les supprimer", async () => {
    const fake = brancher((a) => (a.table === "documents_categories" && a.action === "select" ? { data: SANTE } : undefined));

    expect(await supprimerCategorie("C1")).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "documents", "update")[0].payload).toEqual({ categorie: null });
    expect(ecritures(fake.appels, "documents", "delete")).toHaveLength(0);
    expect(ecritures(fake.appels, "documents_categories", "delete")).toHaveLength(1);
  });

  it("garde la catégorie quand les documents n'ont pas pu être mis à jour", async () => {
    const fake = brancher((a) => {
      if (a.table === "documents_categories" && a.action === "select") return { data: SANTE };
      if (a.table === "documents" && a.action === "update") return { error: { message: "boom" } };
      return undefined;
    });

    expect(await supprimerCategorie("C1")).toMatchObject({ ok: false });
    expect(ecritures(fake.appels, "documents_categories", "delete")).toHaveLength(0);
  });
});

describe("fusionnerCategories", () => {
  it("reverse les documents dans la cible puis supprime la source", async () => {
    const fake = brancher((a) => (a.table === "documents_categories" && a.action === "select" ? { data: [SANTE, AUTRE] } : undefined));

    expect(await fusionnerCategories("C1", "C2")).toEqual({ ok: true, data: undefined });
    const documents = ecritures(fake.appels, "documents", "update")[0];
    expect(documents.payload).toEqual({ categorie: "Autre" });
    expect(documents.filtres).toContainEqual(["eq", "categorie", "Santé"]);
    expect(ecritures(fake.appels, "documents_categories", "delete")[0].filtres).toContainEqual(["eq", "id", "C1"]);
  });

  it("refuse de fusionner une catégorie avec elle-même", async () => {
    const fake = brancher();
    expect(await fusionnerCategories("C1", "C1")).toMatchObject({ ok: false });
    expect(fake.appels).toHaveLength(0);
  });
});
