// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const magasin = vi.hoisted(() => ({
  valeurs: new Map<string, string>(),
  options: new Map<string, unknown>(),
  entetes: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) => (magasin.valeurs.has(nom) ? { name: nom, value: magasin.valeurs.get(nom) } : undefined),
    set: (nom: string, valeur: string, options: unknown) => {
      magasin.valeurs.set(nom, valeur);
      magasin.options.set(nom, options);
    },
    delete: (nom: string) => magasin.valeurs.delete(nom),
  }),
  headers: async () => ({ get: (nom: string) => magasin.entetes.get(nom) ?? null }),
}));

import {
  consommerDefi,
  exigerSession,
  fermerSession,
  memoriserDefi,
  origineAttendue,
  ouvrirSession,
  sessionValide,
  verrouConfigure,
  verrouDesactive,
} from "./verrou";

const SECRET = "k".repeat(40);

beforeEach(() => {
  magasin.valeurs.clear();
  magasin.options.clear();
  magasin.entetes.clear();
  vi.stubEnv("VIDAGE_SESSION_SECRET", SECRET);
  vi.stubEnv("E2E_VERROU_DESACTIVE", "");
  vi.stubEnv("EXPOSE_TESTING_API", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("session de 15 minutes", () => {
  it("reste fermée sans secret configuré, même avec un cookie", async () => {
    await ouvrirSession();
    vi.stubEnv("VIDAGE_SESSION_SECRET", "trop-court");
    expect(verrouConfigure()).toBe(false);
    expect(await sessionValide()).toBe(false);
    expect(await ouvrirSession()).toBe(false);
  });

  it("s'ouvre avec un cookie signé, httpOnly et sameSite strict, de 15 minutes", async () => {
    expect(await sessionValide()).toBe(false);
    expect(await ouvrirSession()).toBe(true);
    expect(await sessionValide()).toBe(true);
    expect(magasin.options.get("kilio_vidage")).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 });
  });

  it("refuse un cookie falsifié ou signé avec un autre secret", async () => {
    await ouvrirSession();
    const [corps] = magasin.valeurs.get("kilio_vidage")!.split(".");
    magasin.valeurs.set("kilio_vidage", `${corps}.signature-bidon`);
    expect(await sessionValide()).toBe(false);

    await ouvrirSession();
    vi.stubEnv("VIDAGE_SESSION_SECRET", "z".repeat(40));
    expect(await sessionValide()).toBe(false);
  });

  it("se referme à la demande", async () => {
    await ouvrirSession();
    await fermerSession();
    expect(await sessionValide()).toBe(false);
  });

  it("exigerSession refuse quand c'est fermé, et renouvelle le cookie quand c'est ouvert", async () => {
    expect(await exigerSession()).toEqual({ ok: false, error: expect.stringContaining("verrouillé") });
    expect(magasin.valeurs.has("kilio_vidage")).toBe(false);

    await ouvrirSession();
    const avant = magasin.valeurs.get("kilio_vidage");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 60_000);
    expect((await exigerSession()).ok).toBe(true);
    vi.useRealTimers();
    expect(magasin.valeurs.get("kilio_vidage")).not.toBe(avant);
  });
});

describe("désactivation pour le banc d'essai", () => {
  it("exige les deux drapeaux : E2E_VERROU_DESACTIVE seul ne désactive jamais le verrou", async () => {
    vi.stubEnv("E2E_VERROU_DESACTIVE", "1");
    expect(verrouDesactive()).toBe(false);
    expect(await sessionValide()).toBe(false);

    vi.stubEnv("EXPOSE_TESTING_API", "1");
    expect(verrouDesactive()).toBe(true);
    expect(await sessionValide()).toBe(true);
    expect((await exigerSession()).ok).toBe(true);
    expect(magasin.valeurs.has("kilio_vidage")).toBe(false);
  });
});

describe("défi WebAuthn", () => {
  it("ne sert qu'une fois et seulement pour son type", async () => {
    await memoriserDefi("abc", "inscription");
    expect(await consommerDefi("connexion")).toBeNull();

    await memoriserDefi("abc", "inscription");
    expect(await consommerDefi("inscription")).toBe("abc");
    expect(await consommerDefi("inscription")).toBeNull();
  });

  it("n'est pas lu comme une session, et inversement", async () => {
    // Un jeton de défi glissé dans le cookie de session n'ouvre rien.
    await memoriserDefi("abc", "connexion");
    magasin.valeurs.set("kilio_vidage", magasin.valeurs.get("kilio_vidage_defi")!);
    expect(await sessionValide()).toBe(false);

    // Un jeton de session glissé dans le cookie de défi n'en est pas un.
    await ouvrirSession();
    magasin.valeurs.set("kilio_vidage_defi", magasin.valeurs.get("kilio_vidage")!);
    expect(await consommerDefi("connexion")).toBeNull();
  });
});

describe("origine attendue", () => {
  it("prend l'hôte transmis par le proxy, en https", async () => {
    magasin.entetes.set("x-forwarded-host", "kilio.example.com");
    magasin.entetes.set("host", "interne:3000");
    expect(await origineAttendue()).toEqual({ rpID: "kilio.example.com", origin: "https://kilio.example.com" });
  });

  it("retire le port de l'identifiant mais le garde dans l'origine (localhost en http)", async () => {
    magasin.entetes.set("host", "localhost:3100");
    expect(await origineAttendue()).toEqual({ rpID: "localhost", origin: "http://localhost:3100" });
  });
});
