// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Appel, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  getPharmacieSnapshot,
  getReferentielSnapshot,
  modifierMolecule,
  modifierNotion,
  noterCarte,
  supprimerNotion,
} from "./pharmacie";

const ID = "11111111-1111-4111-8111-111111111111";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPharmacieSnapshot", () => {
  it("assemble matières, chapitres, notions et cartes avec la date de génération", async () => {
    const fake = brancher((a) => ({
      data: [{ id: `${a.table}-1` }],
    }));

    const res = await getPharmacieSnapshot();

    expect(res.matieres).toEqual([{ id: "pharma_matieres-1" }]);
    expect(res.chapitres).toEqual([{ id: "pharma_chapitres-1" }]);
    expect(res.notions).toEqual([{ id: "pharma_notions-1" }]);
    expect(res.cartes).toEqual([{ id: "pharma_cartes-1" }]);
    expect(Number.isNaN(Date.parse(res.genereLe))).toBe(false);
    expect(fake.appels.map((a) => a.table).sort()).toEqual(["pharma_cartes", "pharma_chapitres", "pharma_matieres", "pharma_notions"]);
  });

  it("lit plusieurs pages quand une table dépasse 1000 lignes", async () => {
    const fake = brancher((a: Appel) => {
      if (a.table !== "pharma_cartes") return { data: [] };
      const plage = a.modificateurs.find((m) => m[0] === "range")!;
      return plage[1] === 0
        ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}` })) }
        : { data: [{ id: "c1000" }, { id: "c1001" }] };
    });

    const res = await getPharmacieSnapshot();

    expect(res.cartes).toHaveLength(1002);
    const lectures = fake.appels.filter((a) => a.table === "pharma_cartes");
    expect(lectures.map((a) => a.modificateurs.find((m) => m[0] === "range"))).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
  });

  it("lève l'erreur d'une table", async () => {
    brancher((a) => (a.table === "pharma_notions" ? { error: { message: "notions ko" } } : { data: [] }));
    await expect(getPharmacieSnapshot()).rejects.toThrow("notions ko");
  });
});

describe("noterCarte", () => {
  const carte = { intervalle_jours: 0, facilite: 2.5, repetitions: 0 };
  const quand = "2026-10-09T10:00:00.000Z";

  it("refuse une note inconnue et une date invalide sans toucher à la base", async () => {
    const fake = brancher();
    await expect(noterCarte(ID, "excellent")).rejects.toThrow("Note de révision invalide.");
    await expect(noterCarte(ID, "bien", "pas une date")).rejects.toThrow("Date invalide.");
    expect(fake.appels).toHaveLength(0);
  });

  it("ne fait rien quand la carte a été supprimée entre-temps", async () => {
    const fake = brancher();
    await expect(noterCarte(ID, "bien", quand)).resolves.toBeUndefined();
    expect(ecritures(fake.appels, "pharma_cartes")).toHaveLength(0);
  });

  it("planifie la prochaine révision à partir de l'instant réel de la réponse", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: carte } : undefined));
    await noterCarte(ID, "bien", quand);
    const [maj] = ecritures(fake.appels, "pharma_cartes", "update");
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
    expect(maj.payload).toMatchObject({
      intervalle_jours: 1,
      repetitions: 1,
      dernier_passage: quand,
      echeance: "2026-10-10T10:00:00.000Z",
    });
  });

  it("remet à zéro une carte à revoir", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { intervalle_jours: 6, facilite: 2.5, repetitions: 3 } } : undefined));
    await noterCarte(ID, "a-revoir", quand);
    expect(ecritures(fake.appels, "pharma_cartes", "update")[0].payload).toMatchObject({ intervalle_jours: 0, repetitions: 0 });
  });

  it("utilise l'heure courante sans instant fourni", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    try {
      const fake = brancher((a) => (a.action === "select" ? { data: carte } : undefined));
      await noterCarte(ID, "facile");
      expect(ecritures(fake.appels, "pharma_cartes", "update")[0].payload).toMatchObject({
        dernier_passage: "2026-10-09T10:00:00.000Z",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("lève l'erreur pour que la file hors ligne rejoue l'action", async () => {
    brancher((a) => (a.action === "select" ? { error: { message: "lecture ko" } } : undefined));
    await expect(noterCarte(ID, "bien", quand)).rejects.toThrow("lecture ko");
    brancher((a) => (a.action === "select" ? { data: carte } : { error: { message: "maj ko" } }));
    await expect(noterCarte(ID, "bien", quand)).rejects.toThrow("maj ko");
  });
});

describe("modifierNotion", () => {
  it("refuse un titre ou un contenu vide", async () => {
    const fake = brancher();
    expect(await modifierNotion(ID, { titre: " ", contenu: "x", tags: [] })).toEqual({ ok: false, error: "Le titre est requis." });
    expect(await modifierNotion(ID, { titre: "x", contenu: " ", tags: [] })).toEqual({ ok: false, error: "Le contenu est requis." });
    expect(fake.appels).toHaveLength(0);
  });

  it("nettoie les tags : minuscules, sans doublon ni vide, 12 au maximum", async () => {
    const fake = brancher();
    const tags = [" Cardio ", "cardio", "", "  ", ...Array.from({ length: 20 }, (_, i) => `t${i}`)];
    expect(await modifierNotion(ID, { titre: " Titre ", contenu: " Contenu ", tags })).toMatchObject({ ok: true });
    const payload = ecritures(fake.appels, "pharma_notions", "update")[0].payload as { titre: string; contenu: string; tags: string[]; updated_at: string };
    expect(payload.titre).toBe("Titre");
    expect(payload.contenu).toBe("Contenu");
    expect(payload.tags).toHaveLength(12);
    expect(payload.tags.slice(0, 3)).toEqual(["cardio", "t0", "t1"]);
    expect(Number.isNaN(Date.parse(payload.updated_at))).toBe(false);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/pharmacie");
  });

  it("renvoie l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await modifierNotion(ID, { titre: "x", contenu: "y", tags: [] })).toEqual({ ok: false, error: "ko" });
  });
});

describe("supprimerNotion", () => {
  it("supprime la notion ciblée, revalide et renvoie l'erreur Supabase", async () => {
    const fake = brancher();
    expect(await supprimerNotion(ID)).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "pharma_notions", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/pharmacie");

    brancher(() => ({ error: { message: "ko" } }));
    expect(await supprimerNotion(ID)).toEqual({ ok: false, error: "ko" });
  });
});

describe("référentiel", () => {
  it("getReferentielSnapshot assemble les six tables", async () => {
    const fake = brancher((a) => ({ data: [{ id: a.table }] }));
    const res = await getReferentielSnapshot();
    expect(res.classes).toEqual([{ id: "pharma_ref_classes" }]);
    expect(res.molecules).toEqual([{ id: "pharma_ref_molecules" }]);
    expect(res.specialites).toEqual([{ id: "pharma_ref_specialites" }]);
    expect(res.pathologies).toEqual([{ id: "pharma_ref_pathologies" }]);
    expect(res.lignes).toEqual([{ id: "pharma_ref_lignes" }]);
    expect(res.items).toEqual([{ id: "pharma_ref_ligne_items" }]);
    expect(fake.appels).toHaveLength(6);
  });

  it("getReferentielSnapshot lève l'erreur d'une table", async () => {
    brancher((a) => (a.table === "pharma_ref_lignes" ? { error: { message: "lignes ko" } } : { data: [] }));
    await expect(getReferentielSnapshot()).rejects.toThrow("lignes ko");
  });

  it("modifierMolecule exige au moins une indication", async () => {
    const fake = brancher();
    expect(await modifierMolecule(ID, { indications: [" ", ""], particularites: "x" })).toEqual({
      ok: false,
      error: "Au moins une indication est requise.",
    });
    expect(fake.appels).toHaveLength(0);
  });

  it("modifierMolecule nettoie les indications (dédoublonnées, 20 au maximum) et les particularités", async () => {
    const fake = brancher();
    const indications = [" HTA ", "HTA", ...Array.from({ length: 30 }, (_, i) => `i${i}`)];
    expect(await modifierMolecule(ID, { indications, particularites: "  " })).toMatchObject({ ok: true });
    const payload = ecritures(fake.appels, "pharma_ref_molecules", "update")[0].payload as { indications: string[]; particularites: string | null };
    expect(payload.indications).toHaveLength(20);
    expect(payload.indications.slice(0, 2)).toEqual(["HTA", "i0"]);
    expect(payload.particularites).toBeNull();
    expect(etat.revalidatePath).toHaveBeenCalledWith("/pharmacie/referentiel");
  });

  it("modifierMolecule conserve les particularités saisies et renvoie l'erreur Supabase", async () => {
    const fake = brancher();
    await modifierMolecule(ID, { indications: ["HTA"], particularites: " Prendre le matin " });
    expect(ecritures(fake.appels, "pharma_ref_molecules", "update")[0].payload).toMatchObject({ particularites: "Prendre le matin" });

    brancher(() => ({ error: { message: "ko" } }));
    expect(await modifierMolecule(ID, { indications: ["HTA"], particularites: "" })).toEqual({ ok: false, error: "ko" });
  });
});
