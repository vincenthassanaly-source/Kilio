// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { enregistrerApercu, enregistrerFeuille, getFeuille, listerJoursEcrits, updateReglagesVidage } from "./vidage";
import type { Trait } from "@/lib/vidage/traits";

const JOUR = "2026-10-19";
const TRAIT: Trait = { e: 2, p: [10, 20, 50, 30, 40, 60] };

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

const png = (octets = 3) => {
  const f = new FormData();
  f.set("apercu", new File([new Uint8Array(octets).fill(1)], "a.png", { type: "image/png" }));
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T20:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("getFeuille", () => {
  it("refuse un jour invalide sans interroger la base", async () => {
    const fake = brancher();
    const r = await getFeuille("hier");
    expect(r).toEqual({ ok: false, error: "Jour invalide." });
    expect(fake.appels).toHaveLength(0);
  });

  it("renvoie une feuille vide quand le jour n'a pas de ligne", async () => {
    brancher();
    const r = await getFeuille(JOUR);
    expect(r).toEqual({ ok: true, data: { jour: JOUR, traits: [], hauteur: 2000, apercuUrl: null, updatedAt: null } });
  });

  it("renvoie les traits et une URL signée (jamais publique) pour l'aperçu", async () => {
    brancher((a) =>
      a.table === "feuilles_vidage"
        ? { data: { jour: JOUR, traits: [TRAIT], hauteur: 2500, apercu_path: `${JOUR}.png`, updated_at: "2026-10-19T19:00:00Z" } }
        : undefined
    );
    const r = await getFeuille(JOUR);
    expect(r.ok && r.data.traits).toEqual([TRAIT]);
    expect(r.ok && r.data.hauteur).toBe(2500);
    expect(r.ok && r.data.apercuUrl).toContain("/object/sign/vider-tete/");
    expect(r.ok && r.data.apercuUrl).not.toContain("/public/");
  });

  it("refuse un contenu corrompu en base", async () => {
    brancher(() => ({ data: { jour: JOUR, traits: "abc", hauteur: 2000, apercu_path: null, updated_at: "x" } }));
    expect(await getFeuille(JOUR)).toEqual({ ok: false, error: "La feuille est illisible." });
  });

  it("remonte une erreur de base sans détail technique", async () => {
    brancher(() => ({ error: { message: "boom" } }));
    expect(await getFeuille(JOUR)).toEqual({ ok: false, error: "La feuille n'a pas pu être chargée. Réessaie." });
  });
});

describe("enregistrerFeuille", () => {
  it("valide le jour et la feuille avant toute écriture", async () => {
    const fake = brancher();
    expect((await enregistrerFeuille("2030-01-01", [TRAIT], 2000)).ok).toBe(false);
    expect((await enregistrerFeuille(JOUR, [{ e: 9, p: [] } as unknown as Trait], 2000)).ok).toBe(false);
    expect(ecritures(fake.appels, "feuilles_vidage")).toHaveLength(0);
  });

  it("enregistre la feuille par upsert", async () => {
    const fake = brancher();
    const r = await enregistrerFeuille(JOUR, [TRAIT], 2500);
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "upsert")[0].payload).toMatchObject({
      jour: JOUR,
      traits: [TRAIT],
      hauteur: 2500,
    });
  });

  it("supprime la ligne et l'aperçu quand la feuille est vidée", async () => {
    const fake = brancher();
    const r = await enregistrerFeuille(JOUR, [], 2000);
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "delete")).toHaveLength(1);
    expect(fake.stockage).toContainEqual({ bucket: "vider-tete", action: "remove", chemins: [`${JOUR}.png`] });
  });

  it("signale l'échec d'enregistrement", async () => {
    brancher((a) => (a.action === "upsert" ? { error: { message: "boom" } } : undefined));
    expect(await enregistrerFeuille(JOUR, [TRAIT], 2000)).toEqual({
      ok: false,
      error: "La feuille n'a pas pu être enregistrée. Réessaie.",
    });
  });
});

describe("enregistrerApercu", () => {
  it("refuse un fichier absent, d'un autre type ou trop gros", async () => {
    brancher();
    expect((await enregistrerApercu(JOUR, new FormData())).ok).toBe(false);
    const jpeg = new FormData();
    jpeg.set("apercu", new File([new Uint8Array(3)], "a.jpg", { type: "image/jpeg" }));
    expect((await enregistrerApercu(JOUR, jpeg)).ok).toBe(false);
    expect((await enregistrerApercu(JOUR, png(2_000_000))).ok).toBe(false);
  });

  it("envoie le PNG dans le bucket privé puis relie le chemin à la feuille", async () => {
    const fake = brancher();
    const r = await enregistrerApercu(JOUR, png());
    expect(r.ok).toBe(true);
    expect(fake.stockage).toContainEqual({
      bucket: "vider-tete",
      action: "upload",
      chemin: `${JOUR}.png`,
      contentType: "image/png",
    });
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({ apercu_path: `${JOUR}.png` });
  });
});

describe("listerJoursEcrits", () => {
  it("refuse un mois invalide", async () => {
    expect((await listerJoursEcrits("2026-13")).ok).toBe(false);
  });

  it("borne la requête au mois et renvoie les jours", async () => {
    const fake = brancher(() => ({ data: [{ jour: "2026-10-03" }, { jour: "2026-10-19" }] }));
    const r = await listerJoursEcrits("2026-10");
    expect(r).toEqual({ ok: true, data: ["2026-10-03", "2026-10-19"] });
    expect(fake.appels[0].filtres).toEqual([
      ["gte", "jour", "2026-10-01"],
      ["lte", "jour", "2026-10-31"],
    ]);
  });
});

describe("updateReglagesVidage", () => {
  it("refuse une heure invalide", async () => {
    expect(await updateReglagesVidage(true, "25:00")).toEqual({ ok: false, error: "Heure invalide (format HH:MM)." });
  });

  it("met à jour l'activation et l'heure sans toucher au dernier envoi", async () => {
    const fake = brancher();
    const r = await updateReglagesVidage(true, "21:30");
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "reglages_briefing", "update")[0].payload).toEqual({ vidage_actif: true, vidage_heure: "21:30" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/reglages");
  });
});
