// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoresVides, type ChampsIdee } from "@/lib/opinions/types";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { changerStatutIdee, creerIdee, getIdee, modifierIdee, supprimerIdee } from "./opinions";

const ID = "11111111-1111-4111-8111-111111111111";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

const LIGNE = {
  id: ID,
  position: "Retraite à points",
  theme: "travail",
  conviction: "plutot",
  arguments_pour: "",
  arguments_contre: "",
  source: "",
  score_economique: -1,
  score_societal: null,
  score_autorite: null,
  score_ecologie: null,
  score_identite: null,
  statut: "brouillon",
  created_at: "2026-10-18T10:00:00Z",
  updated_at: "2026-10-18T10:00:00Z",
};

const CHAMPS: ChampsIdee = {
  position: "Retraite à points",
  theme: "travail",
  conviction: "plutot",
  arguments_pour: "",
  arguments_contre: "",
  source: "",
  scores: { ...scoresVides(), economique: -1 },
};

function ligneEnBase(surcharge: Record<string, unknown> = {}): Repondre {
  return (a) => {
    if (a.table === "opinions_idees" && a.action === "select") return { data: { ...LIGNE, ...surcharge } };
    if (a.table === "opinions_versions" && a.action === "insert") return { data: { id: "v1" } };
  };
}

beforeEach(() => {
  etat.revalidatePath.mockClear();
});

describe("creerIdee", () => {
  it("range la phrase nettoyée en brouillon", async () => {
    const fake = brancher((a) => (a.action === "insert" ? { data: { id: ID } } : undefined));
    expect(await creerIdee("  Plus de transports en commun  ")).toEqual({ ok: true, data: { id: ID } });
    expect(ecritures(fake.appels, "opinions_idees", "insert")[0].payload).toEqual({ position: "Plus de transports en commun" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/opinions");
  });

  it("refuse une phrase vide ou trop longue sans écrire", async () => {
    const fake = brancher();
    expect((await creerIdee("   ")).ok).toBe(false);
    expect((await creerIdee("x".repeat(281))).ok).toBe(false);
    expect(ecritures(fake.appels, "opinions_idees")).toHaveLength(0);
  });

  it("retourne l'erreur sans lever", async () => {
    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await creerIdee("Une idée")).toEqual({ ok: false, error: "ko" });
  });
});

describe("modifierIdee", () => {
  it("archive l'ancienne version puis met à jour quand un champ change", async () => {
    const fake = brancher(ligneEnBase());
    const resultat = await modifierIdee(ID, { ...CHAMPS, scores: { ...CHAMPS.scores, economique: 2 } });
    expect(resultat).toEqual({ ok: true, data: undefined });

    const versions = ecritures(fake.appels, "opinions_versions", "insert");
    expect(versions).toHaveLength(1);
    expect(versions[0].payload).toMatchObject({ idee_id: ID, position: "Retraite à points", score_economique: -1 });
    expect(ecritures(fake.appels, "opinions_idees", "update")[0].payload).toMatchObject({ score_economique: 2 });
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/opinions/${ID}`);
  });

  it("n'écrit rien quand rien ne change", async () => {
    const fake = brancher(ligneEnBase());
    expect((await modifierIdee(ID, CHAMPS)).ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_versions")).toHaveLength(0);
    expect(ecritures(fake.appels, "opinions_idees")).toHaveLength(0);
  });

  it("refuse des champs invalides ou une idée validée sans thème", async () => {
    const fake = brancher(ligneEnBase({ statut: "validee" }));
    expect((await modifierIdee(ID, { ...CHAMPS, position: " " })).ok).toBe(false);
    expect(await modifierIdee(ID, { ...CHAMPS, theme: null })).toEqual({
      ok: false,
      error: "Une idée validée a besoin d'un thème.",
    });
    expect((await modifierIdee("pas-un-uuid", CHAMPS)).ok).toBe(false);
    expect(ecritures(fake.appels, "opinions_idees")).toHaveLength(0);
  });

  it("supprime l'instantané si la mise à jour échoue", async () => {
    const fake = brancher((a) => {
      if (a.table === "opinions_idees" && a.action === "update") return { error: { message: "ko" } };
      return ligneEnBase()(a);
    });
    expect(await modifierIdee(ID, { ...CHAMPS, source: "livre" })).toEqual({ ok: false, error: "ko" });
    expect(ecritures(fake.appels, "opinions_versions", "delete")).toHaveLength(1);
  });
});

describe("changerStatutIdee", () => {
  it("refuse de valider sans thème", async () => {
    const fake = brancher(ligneEnBase({ theme: null }));
    expect(await changerStatutIdee(ID, "validee")).toEqual({
      ok: false,
      error: "Choisis un thème avant de valider cette idée.",
    });
    expect(ecritures(fake.appels, "opinions_idees")).toHaveLength(0);
  });

  it("valide une idée qui a un thème, et accepte rejet ou retour en brouillon sans thème", async () => {
    const fake = brancher(ligneEnBase());
    expect((await changerStatutIdee(ID, "validee")).ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_idees", "update")[0].payload).toMatchObject({ statut: "validee" });

    brancher(ligneEnBase({ theme: null }));
    expect((await changerStatutIdee(ID, "rejetee")).ok).toBe(true);
  });

  it("refuse un statut inconnu", async () => {
    brancher(ligneEnBase());
    expect((await changerStatutIdee(ID, "zzz" as never)).ok).toBe(false);
  });
});

describe("supprimerIdee et getIdee", () => {
  it("supprime l'idée", async () => {
    const fake = brancher();
    expect((await supprimerIdee(ID)).ok).toBe(true);
    expect(ecritures(fake.appels, "opinions_idees", "delete")).toHaveLength(1);
  });

  it("lit une idée avec ses versions, ou null si l'identifiant est invalide", async () => {
    brancher((a) => {
      if (a.table === "opinions_idees") return { data: LIGNE };
      if (a.table === "opinions_versions") return { data: [{ ...LIGNE, id: "v1", idee_id: ID, created_at: "2026-10-17T09:00:00Z" }] };
    });
    const idee = await getIdee(ID);
    expect(idee?.position).toBe("Retraite à points");
    expect(idee?.versions).toHaveLength(1);
    expect(idee?.scores.economique).toBe(-1);
    expect(idee?.origine).toBeNull();
    expect(await getIdee("nope")).toBeNull();
  });

  it("retrouve la proposition de parti dont l'idée est reprise", async () => {
    brancher((a) => {
      if (a.table === "opinions_idees") return { data: { ...LIGNE, proposition_id: ID } };
      if (a.table === "opinions_propositions") {
        return {
          data: {
            id: ID,
            position: "Baisser la TVA",
            opinions_programmes: { echeance: "Présidentielle 2027", opinions_partis: { nom: "Parti A", sigle: "PA" } },
          },
        };
      }
    });
    const idee = await getIdee(ID);
    expect(idee?.origine).toEqual({ proposition: "Baisser la TVA", parti: "PA", echeance: "Présidentielle 2027" });
  });
});
