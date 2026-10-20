// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  configure: true,
  desactive: false,
  session: false,
  defi: null as string | null,
  ouvrirSession: vi.fn(),
  fermerSession: vi.fn(),
  memoriserDefi: vi.fn(),
  exigerSession: vi.fn(),
  genererInscription: vi.fn(),
  verifierInscription: vi.fn(),
  genererConnexion: vi.fn(),
  verifierConnexion: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/vidage/verrou", () => ({
  verrouConfigure: () => etat.configure,
  verrouDesactive: () => etat.desactive,
  sessionValide: async () => etat.session,
  ouvrirSession: etat.ouvrirSession,
  fermerSession: etat.fermerSession,
  memoriserDefi: etat.memoriserDefi,
  consommerDefi: async () => etat.defi,
  exigerSession: etat.exigerSession,
  origineAttendue: async () => ({ rpID: "kilio.test", origin: "https://kilio.test" }),
}));
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: etat.genererInscription,
  verifyRegistrationResponse: etat.verifierInscription,
  generateAuthenticationOptions: etat.genererConnexion,
  verifyAuthenticationResponse: etat.verifierConnexion,
}));

import {
  etatVerrou,
  optionsConnexion,
  optionsInscription,
  prolongerSession,
  verifierConnexion,
  verifierInscription,
  verrouiller,
} from "./verrou";

const CLE = { credential_id: "cred-1", public_key: "AQID", counter: 4, transports: ["internal"] };
const REPONSE = { id: "cred-1" } as never;

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}
const avecCle: Repondre = (a) => (a.action === "select" ? { data: CLE } : undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(etat, { configure: true, desactive: false, session: false, defi: "defi-1" });
  etat.memoriserDefi.mockResolvedValue(true);
  etat.ouvrirSession.mockResolvedValue(true);
  etat.exigerSession.mockResolvedValue({ ok: true, data: undefined });
  etat.genererInscription.mockResolvedValue({ challenge: "defi-1" });
  etat.genererConnexion.mockResolvedValue({ challenge: "defi-1" });
});

describe("etatVerrou", () => {
  it("signale un verrou non configuré sans interroger la base", async () => {
    etat.configure = false;
    const fake = brancher();
    expect(await etatVerrou()).toEqual({ ok: true, data: { configure: false, inscrit: false, ouvert: false } });
    expect(fake.appels).toHaveLength(0);
  });

  it("dit si un appareil est enregistré et si la session est ouverte", async () => {
    brancher();
    expect(await etatVerrou()).toEqual({ ok: true, data: { configure: true, inscrit: false, ouvert: false } });
    etat.session = true;
    brancher(avecCle);
    expect(await etatVerrou()).toEqual({ ok: true, data: { configure: true, inscrit: true, ouvert: true } });
  });

  it("est ouvert d'office quand le banc d'essai désactive le verrou", async () => {
    etat.desactive = true;
    const fake = brancher();
    expect(await etatVerrou()).toEqual({ ok: true, data: { configure: true, inscrit: true, ouvert: true } });
    expect(fake.appels).toHaveLength(0);
  });

  it("remonte une erreur de base sans détail technique", async () => {
    brancher(() => ({ error: { message: "boom" } }));
    expect(await etatVerrou()).toEqual({ ok: false, error: "Le verrou n'a pas pu être vérifié. Réessaie." });
  });
});

describe("inscription (premier appareil)", () => {
  it("propose une passkey du capteur de l'appareil, avec vérification obligatoire", async () => {
    brancher();
    const r = await optionsInscription();
    expect(r.ok).toBe(true);
    expect(etat.genererInscription.mock.calls[0][0]).toMatchObject({
      rpID: "kilio.test",
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
    });
    expect(etat.memoriserDefi).toHaveBeenCalledWith("defi-1", "inscription");
  });

  it("refuse de proposer l'inscription quand un appareil est déjà enregistré", async () => {
    brancher(avecCle);
    expect(await optionsInscription()).toEqual({ ok: false, error: "Un appareil est déjà enregistré." });
    expect(etat.genererInscription).not.toHaveBeenCalled();
  });

  it("refuse sans défi en attente (expiré ou déjà utilisé)", async () => {
    etat.defi = null;
    const fake = brancher();
    expect(await verifierInscription(REPONSE)).toEqual({ ok: false, error: "La demande a expiré. Recommence." });
    expect(etat.verifierInscription).not.toHaveBeenCalled();
    expect(ecritures(fake.appels, "vidage_passkey")).toHaveLength(0);
  });

  it("refuse une réponse non vérifiée, qu'elle soit fausse ou qu'elle lève une erreur", async () => {
    const fake = brancher();
    etat.verifierInscription.mockResolvedValueOnce({ verified: false });
    expect((await verifierInscription(REPONSE)).ok).toBe(false);
    etat.verifierInscription.mockRejectedValueOnce(new Error("mauvaise origine"));
    expect((await verifierInscription(REPONSE)).ok).toBe(false);
    expect(ecritures(fake.appels, "vidage_passkey")).toHaveLength(0);
    expect(etat.ouvrirSession).not.toHaveBeenCalled();
  });

  it("enregistre la clé publique (id = 1) et ouvre la session", async () => {
    etat.verifierInscription.mockResolvedValue({
      verified: true,
      registrationInfo: { credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] } },
    });
    const fake = brancher();
    expect((await verifierInscription(REPONSE)).ok).toBe(true);
    expect(etat.verifierInscription.mock.calls[0][0]).toMatchObject({
      expectedChallenge: "defi-1",
      expectedOrigin: "https://kilio.test",
      expectedRPID: "kilio.test",
      requireUserVerification: true,
    });
    expect(ecritures(fake.appels, "vidage_passkey", "insert")[0].payload).toEqual({
      id: 1,
      credential_id: "cred-1",
      public_key: "AQID",
      counter: 0,
      transports: ["internal"],
    });
    expect(etat.ouvrirSession).toHaveBeenCalledTimes(1);
  });

  it("n'ouvre pas la session si un autre appareil s'est inscrit entre-temps", async () => {
    etat.verifierInscription.mockResolvedValue({
      verified: true,
      registrationInfo: { credential: { id: "cred-2", publicKey: new Uint8Array([1]), counter: 0 } },
    });
    brancher((a) => (a.action === "insert" ? { error: { message: "duplicate key" } } : undefined));
    expect(await verifierInscription(REPONSE)).toEqual({ ok: false, error: "Un appareil est déjà enregistré." });
    expect(etat.ouvrirSession).not.toHaveBeenCalled();
  });
});

describe("connexion", () => {
  it("n'accepte que l'appareil enregistré, avec vérification obligatoire", async () => {
    brancher(avecCle);
    expect((await optionsConnexion()).ok).toBe(true);
    expect(etat.genererConnexion.mock.calls[0][0]).toMatchObject({
      rpID: "kilio.test",
      allowCredentials: [{ id: "cred-1", transports: ["internal"] }],
      userVerification: "required",
    });
    expect(etat.memoriserDefi).toHaveBeenCalledWith("defi-1", "connexion");
  });

  it("n'a rien à proposer tant qu'aucun appareil n'est enregistré", async () => {
    brancher();
    expect(await optionsConnexion()).toEqual({ ok: false, error: "Aucun appareil n'est enregistré." });
  });

  it("refuse sans défi, ou quand la lecture n'est pas vérifiée", async () => {
    brancher(avecCle);
    etat.defi = null;
    expect((await verifierConnexion(REPONSE)).ok).toBe(false);
    etat.defi = "defi-1";
    etat.verifierConnexion.mockResolvedValueOnce({ verified: false });
    expect((await verifierConnexion(REPONSE)).ok).toBe(false);
    etat.verifierConnexion.mockRejectedValueOnce(new Error("signature invalide"));
    expect((await verifierConnexion(REPONSE)).ok).toBe(false);
    expect(etat.ouvrirSession).not.toHaveBeenCalled();
  });

  it("ouvre la session et met à jour le compteur quand la lecture est vérifiée", async () => {
    etat.verifierConnexion.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5 } });
    const fake = brancher(avecCle);
    expect((await verifierConnexion(REPONSE)).ok).toBe(true);
    expect(etat.verifierConnexion.mock.calls[0][0]).toMatchObject({
      expectedChallenge: "defi-1",
      credential: { id: "cred-1", counter: 4, publicKey: new Uint8Array([1, 2, 3]) },
      requireUserVerification: true,
    });
    expect(ecritures(fake.appels, "vidage_passkey", "update")[0].payload).toEqual({ counter: 5 });
    expect(etat.ouvrirSession).toHaveBeenCalledTimes(1);
  });
});

describe("session", () => {
  it("se prolonge pendant l'activité en passant par la même garde que les actions du module", async () => {
    expect(await prolongerSession()).toEqual({ ok: true, data: undefined });
    expect(etat.exigerSession).toHaveBeenCalledTimes(1);
  });

  it("se referme à la demande", async () => {
    expect((await verrouiller()).ok).toBe(true);
    expect(etat.fermerSession).toHaveBeenCalledTimes(1);
  });
});
