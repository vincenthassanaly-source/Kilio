// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoresVides } from "@/lib/opinions/types";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  creerParti,
  creerProgramme,
  creerProposition,
  definirPriorite,
  getPartis,
  getPriorites,
  modifierProposition,
  reprendreProposition,
  supprimerParti,
} from "./opinions-partis";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  etat.revalidatePath.mockClear();
});

describe("creerParti", () => {
  it("nettoie le nom et le sigle puis écrit", async () => {
    const fake = brancher();
    expect(await creerParti("  Renaissance ", " RE ", "corail")).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "opinions_partis", "insert")[0].payload).toEqual({
      nom: "Renaissance",
      sigle: "RE",
      couleur: "corail",
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/opinions");
  });

  it("attribue la première teinte libre quand aucune n'est choisie, et refuse une teinte inconnue", async () => {
    const fake = brancher((a) => (a.table === "opinions_partis" && a.action === "select" ? { data: [{ couleur: "indigo" }] } : undefined));
    expect((await creerParti("Les Verts", "", null)).ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_partis", "insert")[0].payload).toMatchObject({ couleur: "corail" });

    const autre = brancher();
    expect(await creerParti("X", "", "rouge")).toEqual({ ok: false, error: "Couleur invalide." });
    expect(ecritures(autre.appels, "opinions_partis")).toHaveLength(0);
  });

  it("refuse un nom vide sans écrire et nomme le doublon", async () => {
    const fake = brancher();
    expect((await creerParti("  ", "")).ok).toBe(false);
    expect(ecritures(fake.appels, "opinions_partis")).toHaveLength(0);

    brancher((a) => (a.action === "insert" ? { error: { message: "dup", code: "23505" } } : undefined));
    expect(await creerParti("Renaissance", "")).toEqual({ ok: false, error: "Ce parti existe déjà." });
  });
});

describe("programmes et propositions", () => {
  it("crée un programme daté, et refuse une date invalide ou un parti inconnu", async () => {
    const fake = brancher();
    expect((await creerProgramme(ID, " Présidentielle 2027 ", "2027-01-15")).ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_programmes", "insert")[0].payload).toEqual({
      parti_id: ID,
      echeance: "Présidentielle 2027",
      date_programme: "2027-01-15",
    });
    expect((await creerProgramme(ID, "x", "2027-13-01")).ok).toBe(false);
    expect((await creerProgramme("nope", "x", null)).ok).toBe(false);
  });

  it("crée une proposition avec thème et scores en colonnes", async () => {
    const fake = brancher();
    const resultat = await creerProposition(ID, {
      position: " Baisser la TVA ",
      theme: "fiscalite",
      scores: { ...scoresVides(), economique: 1 },
    });
    expect(resultat.ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_propositions", "insert")[0].payload).toMatchObject({
      programme_id: ID,
      position: "Baisser la TVA",
      theme: "fiscalite",
      score_economique: 1,
      score_societal: null,
    });
  });

  it("enregistre les mots-clés d'une proposition", async () => {
    const fake = brancher();
    const resultat = await creerProposition(ID, {
      position: "Baisser la TVA",
      theme: "fiscalite",
      scores: scoresVides(),
      termes: [{ terme: "TVA", definition: "un impôt sur ce qu'on achète" }],
    });
    expect(resultat.ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_propositions", "insert")[0].payload).toMatchObject({
      termes: [{ terme: "TVA", definition: "un impôt sur ce qu'on achète" }],
    });
  });

  it("refuse une proposition sans thème ou avec un score hors domaine, sans écrire", async () => {
    const fake = brancher();
    expect((await creerProposition(ID, { position: "x", theme: null, scores: scoresVides() })).ok).toBe(false);
    expect((await modifierProposition(ID, { position: "x", theme: "sante", scores: { ...scoresVides(), societal: 5 } })).ok).toBe(false);
    expect(ecritures(fake.appels, "opinions_propositions")).toHaveLength(0);
  });

  it("supprime un parti par son identifiant", async () => {
    const fake = brancher();
    expect((await supprimerParti(ID)).ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_partis", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
    expect((await supprimerParti("nope")).ok).toBe(false);
  });
});

describe("reprendreProposition", () => {
  const PROPOSITION = {
    position: "Baisser la TVA",
    theme: "fiscalite",
    score_economique: 1,
    score_societal: null,
    score_autorite: null,
    score_ecologie: null,
    score_identite: null,
  };

  it("crée un brouillon prérempli qui référence la proposition", async () => {
    const fake = brancher((a) => {
      if (a.table === "opinions_propositions") return { data: PROPOSITION };
      if (a.table === "opinions_idees" && a.action === "insert") return { data: { id: ID2 } };
    });
    expect(await reprendreProposition(ID)).toEqual({ ok: true, data: { id: ID2 } });
    expect(ecritures(fake.appels, "opinions_idees", "insert")[0].payload).toMatchObject({
      position: "Baisser la TVA",
      theme: "fiscalite",
      score_economique: 1,
      proposition_id: ID,
    });
  });

  it("refuse de reprendre deux fois la même proposition", async () => {
    const fake = brancher((a) => {
      if (a.table === "opinions_propositions") return { data: PROPOSITION };
      if (a.table === "opinions_idees" && a.action === "select") return { data: [{ id: ID2 }] };
    });
    const resultat = await reprendreProposition(ID);
    expect(resultat.ok).toBe(false);
    expect(ecritures(fake.appels, "opinions_idees")).toHaveLength(0);
  });

  it("échoue si la proposition a disparu", async () => {
    brancher();
    expect(await reprendreProposition(ID)).toEqual({ ok: false, error: "Proposition introuvable." });
  });
});

describe("priorités", () => {
  it("écrit une priorité par thème (upsert) et refuse un niveau inconnu", async () => {
    const fake = brancher();
    expect((await definirPriorite("sante", "prioritaire")).ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_priorites", "upsert")[0].payload).toMatchObject({ theme: "sante", niveau: "prioritaire" });
    expect((await definirPriorite("sante", "zzz" as never)).ok).toBe(false);
    expect((await definirPriorite("zzz" as never, "normal")).ok).toBe(false);
  });

  it("lit les priorités en ignorant les valeurs hors domaine", async () => {
    brancher(() => ({
      data: [
        { theme: "sante", niveau: "prioritaire" },
        { theme: "inconnu", niveau: "normal" },
        { theme: "culture", niveau: "zzz" },
      ],
    }));
    expect(await getPriorites()).toEqual({ sante: "prioritaire" });
  });
});

describe("getPartis", () => {
  it("assemble partis, programmes et propositions, et ignore un thème inconnu", async () => {
    brancher(() => ({
      data: [
        {
          id: ID,
          nom: "Parti A",
          sigle: "PA",
          opinions_programmes: [
            {
              id: ID2,
              echeance: "Présidentielle 2027",
              date_programme: "2027-01-15",
              created_at: "2026-10-18T10:00:00Z",
              opinions_propositions: [
                { id: "p1", position: "Une", theme: "sante", score_economique: -1, score_societal: null, score_autorite: null, score_ecologie: null, score_identite: 9 },
                { id: "p2", position: "Deux", theme: "zzz", score_economique: 1, score_societal: null, score_autorite: null, score_ecologie: null, score_identite: null },
              ],
            },
          ],
        },
      ],
    }));
    const partis = await getPartis();
    expect(partis).toHaveLength(1);
    const propositions = partis[0].programmes[0].propositions;
    expect(propositions).toHaveLength(1);
    expect(propositions[0]).toMatchObject({ id: "p1", theme: "sante" });
    expect(propositions[0].scores.economique).toBe(-1);
    expect(propositions[0].scores.identite).toBeNull();
  });
});
