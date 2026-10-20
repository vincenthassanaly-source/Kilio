import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeuilleVidage } from "@/app/actions/vidage";
import type { Trait } from "./traits";

type Ligne = { jour: string; traits: unknown; hauteur: number; modifie_le: string; a_envoyer: 0 | 1; erreur?: string };

// Faux Dexie en mémoire : seule la surface utilisée par local.ts.
const etat = vi.hoisted(() => ({
  lignes: new Map<string, Ligne>(),
  enregistrerFeuille: vi.fn(),
}));

vi.mock("@/lib/offline/db", () => {
  const trier = () => [...etat.lignes.values()].sort((a, b) => (a.jour < b.jour ? -1 : 1));
  return {
    db: {
      vidage_feuilles: {
        get: async (jour: string) => etat.lignes.get(jour),
        put: async (l: Ligne) => void etat.lignes.set(l.jour, { ...l }),
        update: async (jour: string, patch: Partial<Ligne>) => {
          const l = etat.lignes.get(jour);
          if (l) etat.lignes.set(jour, { ...l, ...patch });
        },
        delete: async (jour: string) => void etat.lignes.delete(jour),
        toArray: async () => trier(),
        orderBy: () => ({ toArray: async () => trier() }),
      },
    },
  };
});
vi.mock("@/app/actions/vidage", () => ({ enregistrerFeuille: etat.enregistrerFeuille }));

import {
  choisirFeuille,
  compterFeuillesEnAttente,
  ecrireFeuilleLocale,
  lireFeuilleLocale,
  memoriserFeuilleServeur,
  synchroniserFeuilles,
} from "./local";

const T: Trait = { e: 1, p: [1, 2, 50, 3, 4, 50] };
const serveur = (traits: Trait[] = [T]): FeuilleVidage => ({
  jour: "2026-10-19",
  traits,
  hauteur: 2500,
  apercuUrl: null,
  updatedAt: "2026-10-19T19:00:00.000Z",
});

beforeEach(() => {
  etat.lignes.clear();
  etat.enregistrerFeuille.mockReset();
  etat.enregistrerFeuille.mockResolvedValue({ ok: true, data: { updatedAt: "x" } });
  vi.useRealTimers();
});

describe("écriture locale", () => {
  it("marque la feuille à envoyer et garde les traits", async () => {
    await ecrireFeuilleLocale("2026-10-19", [T], 2000);
    expect(await lireFeuilleLocale("2026-10-19")).toMatchObject({ traits: [T], hauteur: 2000, a_envoyer: 1 });
    expect(await compterFeuillesEnAttente()).toBe(1);
  });

  it("donne une valeur modifie_le différente à deux écritures dans la même milliseconde", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T20:00:00.000Z"));
    await ecrireFeuilleLocale("2026-10-19", [T], 2000);
    const a = (await lireFeuilleLocale("2026-10-19"))!.modifie_le;
    await ecrireFeuilleLocale("2026-10-19", [T, T], 2000);
    const b = (await lireFeuilleLocale("2026-10-19"))!.modifie_le;
    expect(b).not.toBe(a);
  });
});

describe("memoriserFeuilleServeur", () => {
  it("met en cache la version du serveur", async () => {
    await memoriserFeuilleServeur(serveur());
    expect(await lireFeuilleLocale("2026-10-19")).toMatchObject({ a_envoyer: 0, hauteur: 2500 });
  });

  it("n'écrase jamais des modifications locales non envoyées", async () => {
    await ecrireFeuilleLocale("2026-10-19", [T, T], 3000);
    await memoriserFeuilleServeur(serveur());
    expect(await lireFeuilleLocale("2026-10-19")).toMatchObject({ a_envoyer: 1, hauteur: 3000 });
  });
});

describe("choisirFeuille", () => {
  const local = (a_envoyer: 0 | 1): Parameters<typeof choisirFeuille>[0] => ({
    jour: "2026-10-19",
    traits: [T],
    hauteur: 3000,
    modifie_le: "x",
    a_envoyer,
  });

  it("préfère le local quand il n'est pas encore envoyé", () => {
    expect(choisirFeuille(local(1), serveur([]), 2000)).toMatchObject({ source: "local", hauteur: 3000 });
  });

  it("préfère le serveur quand le local est déjà envoyé", () => {
    expect(choisirFeuille(local(0), serveur(), 2000)).toMatchObject({ source: "serveur", hauteur: 2500 });
  });

  it("retombe sur le cache local hors ligne, puis sur une feuille vide", () => {
    expect(choisirFeuille(local(0), null, 2000).source).toBe("local");
    expect(choisirFeuille(null, null, 2000)).toEqual({ traits: [], hauteur: 2000, source: "vide" });
  });
});

describe("synchroniserFeuilles", () => {
  it("envoie les feuilles en attente dans l'ordre des jours puis les marque envoyées", async () => {
    await ecrireFeuilleLocale("2026-10-19", [T], 2000);
    await ecrireFeuilleLocale("2026-10-18", [T], 2000);
    const r = await synchroniserFeuilles();
    expect(r).toEqual({ envoyees: 2, restantes: 0, refus: [] });
    expect(etat.enregistrerFeuille.mock.calls.map((c) => c[0])).toEqual(["2026-10-18", "2026-10-19"]);
    expect((await lireFeuilleLocale("2026-10-18"))!.a_envoyer).toBe(0);
  });

  it("s'arrête sur une erreur réseau et garde tout en attente", async () => {
    await ecrireFeuilleLocale("2026-10-18", [T], 2000);
    await ecrireFeuilleLocale("2026-10-19", [T], 2000);
    etat.enregistrerFeuille.mockRejectedValue(new Error("Failed to fetch"));
    const r = await synchroniserFeuilles();
    expect(r.envoyees).toBe(0);
    expect(r.restantes).toBe(2);
    expect(etat.enregistrerFeuille).toHaveBeenCalledTimes(1);
  });

  it("garde une feuille refusée avec son message et continue avec les suivantes", async () => {
    await ecrireFeuilleLocale("2026-10-18", [T], 2000);
    await ecrireFeuilleLocale("2026-10-19", [T], 2000);
    etat.enregistrerFeuille.mockResolvedValueOnce({ ok: false, error: "Feuille invalide." });
    const r = await synchroniserFeuilles();
    expect(r).toEqual({ envoyees: 1, restantes: 1, refus: ["Feuille invalide."] });
    expect(await lireFeuilleLocale("2026-10-18")).toMatchObject({ a_envoyer: 1, erreur: "Feuille invalide." });
  });

  it("laisse en attente une feuille modifiée pendant son envoi", async () => {
    await ecrireFeuilleLocale("2026-10-19", [T], 2000);
    etat.enregistrerFeuille.mockImplementation(async () => {
      await ecrireFeuilleLocale("2026-10-19", [T, T], 2000);
      return { ok: true, data: { updatedAt: "x" } };
    });
    const r = await synchroniserFeuilles();
    expect(r.restantes).toBe(1);
    expect((await lireFeuilleLocale("2026-10-19"))!.traits).toHaveLength(2);
  });

  it("purge les feuilles déjà envoyées et anciennes, jamais celles en attente", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T20:00:00Z"));
    etat.lignes.set("2026-09-01", { jour: "2026-09-01", traits: [], hauteur: 2000, modifie_le: "x", a_envoyer: 0 });
    etat.lignes.set("2026-09-02", { jour: "2026-09-02", traits: [], hauteur: 2000, modifie_le: "x", a_envoyer: 1 });
    etat.enregistrerFeuille.mockResolvedValue({ ok: false, error: "refus" });
    await synchroniserFeuilles();
    expect(etat.lignes.has("2026-09-01")).toBe(false);
    expect(etat.lignes.has("2026-09-02")).toBe(true);
  });
});
