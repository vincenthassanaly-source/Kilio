// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), gemini: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({ appelerGemini: etat.gemini, MESSAGE_QUOTA_GEMINI: "Quota atteint." }));

import {
  enregistrerApercu,
  enregistrerFeuille,
  enregistrerTranscription,
  getFeuille,
  listerJoursEcrits,
  supprimerTranscription,
  transcrireFeuille,
  updateReglagesVidage,
} from "./vidage";
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
    expect(r).toEqual({
      ok: true,
      data: { jour: JOUR, traits: [], hauteur: 2000, apercuUrl: null, updatedAt: null, transcription: null, transcriptionModifiee: false },
    });
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

  it("borne la requête au mois et renvoie les jours avec une vignette signée quand elle existe", async () => {
    const fake = brancher(() => ({
      data: [
        { jour: "2026-10-03", apercu_path: null },
        { jour: "2026-10-19", apercu_path: "2026-10-19.png" },
      ],
    }));
    const r = await listerJoursEcrits("2026-10");
    expect(r.ok && r.data).toEqual([
      { jour: "2026-10-03", apercuUrl: null },
      { jour: "2026-10-19", apercuUrl: expect.stringContaining("/object/sign/vider-tete/2026-10-19.png") },
    ]);
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

describe("getFeuille : transcription", () => {
  it("renvoie le texte transcrit et s'il a été corrigé à la main", async () => {
    brancher(() => ({
      data: { jour: JOUR, traits: [TRAIT], hauteur: 2000, apercu_path: null, updated_at: "x", transcription: "Bonjour", transcription_modifiee: true },
    }));
    const r = await getFeuille(JOUR);
    expect(r.ok && r.data.transcription).toBe("Bonjour");
    expect(r.ok && r.data.transcriptionModifiee).toBe(true);
  });

  it("renvoie « pas de transcription » pour une feuille vide ou jamais transcrite", async () => {
    brancher();
    const vide = await getFeuille(JOUR);
    expect(vide.ok && vide.data).toMatchObject({ transcription: null, transcriptionModifiee: false });
    brancher(() => ({ data: { jour: JOUR, traits: [TRAIT], hauteur: 2000, apercu_path: null, updated_at: "x" } }));
    const jamais = await getFeuille(JOUR);
    expect(jamais.ok && jamais.data.transcription).toBeNull();
  });
});

describe("enregistrerFeuille : le texte suit la feuille", () => {
  const payloadUpsert = (fake: ReturnType<typeof brancher>) =>
    ecritures(fake.appels, "feuilles_vidage", "upsert")[0].payload as Record<string, unknown>;

  it("efface la transcription quand les traits changent", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { traits: [TRAIT] } } : undefined));
    await enregistrerFeuille(JOUR, [TRAIT, TRAIT], 2000);
    expect(payloadUpsert(fake)).toMatchObject({ transcription: null, transcription_modifiee: false });
  });

  it("garde la transcription quand la même feuille est renvoyée (reprise après coupure)", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { traits: [{ p: TRAIT.p, e: TRAIT.e }] } } : undefined));
    await enregistrerFeuille(JOUR, [TRAIT], 2000);
    expect(payloadUpsert(fake)).not.toHaveProperty("transcription");
  });

  it("n'écrit pas de transcription pour une feuille neuve", async () => {
    const fake = brancher();
    await enregistrerFeuille(JOUR, [TRAIT], 2000);
    expect(payloadUpsert(fake)).not.toHaveProperty("transcription");
  });

  it("efface le texte par précaution si la feuille existante est illisible", async () => {
    const fake = brancher((a) => (a.action === "select" ? { error: { message: "boom" } } : undefined));
    await enregistrerFeuille(JOUR, [TRAIT], 2000);
    expect(payloadUpsert(fake)).toMatchObject({ transcription: null });
  });
});

describe("transcrireFeuille", () => {
  const tranche = (octets = 10, type = "image/png") => new File([new Uint8Array(octets).fill(1)], "t.png", { type });
  const formulaire = (...fichiers: File[]) => {
    const f = new FormData();
    fichiers.forEach((fichier) => f.append("tranche", fichier));
    return f;
  };
  const ligne = (a: { action: string }) => (a.action === "select" ? { data: { updated_at: "2026-10-19T19:00:00Z" } } : undefined);

  it("refuse un jour invalide, l'absence d'image, un mauvais type et trop d'images", async () => {
    brancher(ligne);
    expect((await transcrireFeuille("hier", formulaire(tranche()))).ok).toBe(false);
    expect((await transcrireFeuille(JOUR, formulaire())).ok).toBe(false);
    expect((await transcrireFeuille(JOUR, formulaire(tranche(10, "image/jpeg")))).ok).toBe(false);
    expect((await transcrireFeuille(JOUR, formulaire(...Array.from({ length: 9 }, () => tranche())))).ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("refuse des images trop lourdes pour la limite de requête", async () => {
    brancher(ligne);
    const r = await transcrireFeuille(JOUR, formulaire(tranche(2_000_000), tranche(2_000_000)));
    expect(r.ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("demande d'abord d'enregistrer la feuille si le serveur ne l'a pas encore", async () => {
    brancher();
    const r = await transcrireFeuille(JOUR, formulaire(tranche()));
    expect(r.ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("envoie les tranches en base64 à Gemini et enregistre le texte lu", async () => {
    etat.gemini.mockResolvedValue({ ok: true, brut: { texte: "  Ma journée  " } });
    const fake = brancher((a) =>
      a.action === "select" ? { data: { updated_at: "2026-10-19T19:00:00Z" } } : a.action === "update" ? { data: [{ jour: JOUR }] } : undefined
    );
    const r = await transcrireFeuille(JOUR, formulaire(tranche(3), tranche(3)));
    expect(r).toEqual({ ok: true, data: { texte: "Ma journée" } });

    const appel = etat.gemini.mock.calls[0][0];
    expect(appel.images).toEqual([
      { mimeType: "image/png", data: "AQEB" },
      { mimeType: "image/png", data: "AQEB" },
    ]);
    expect(appel.temperature).toBe(0);
    const maj = ecritures(fake.appels, "feuilles_vidage", "update")[0];
    expect(maj.payload).toEqual({ transcription: "Ma journée", transcription_modifiee: false });
    // N'écrit que si la feuille n'a pas changé pendant l'appel.
    expect(maj.filtres).toContainEqual(["eq", "updated_at", "2026-10-19T19:00:00Z"]);
  });

  it("refuse d'enregistrer si la feuille a changé pendant la transcription", async () => {
    etat.gemini.mockResolvedValue({ ok: true, brut: { texte: "Ancien texte" } });
    brancher((a) => (a.action === "select" ? { data: { updated_at: "x" } } : a.action === "update" ? { data: [] } : undefined));
    const r = await transcrireFeuille(JOUR, formulaire(tranche()));
    expect(r).toEqual({ ok: false, error: "La feuille a changé pendant la transcription. Relance-la." });
  });

  it("signale le quota atteint, un échec de Gemini et une réponse illisible, sans rien enregistrer", async () => {
    const fake = brancher(ligne);
    etat.gemini.mockResolvedValueOnce({ ok: false, code: "quota", detail: "429" });
    expect(await transcrireFeuille(JOUR, formulaire(tranche()))).toEqual({ ok: false, error: "Quota atteint." });

    etat.gemini.mockResolvedValueOnce({ ok: false, code: "echec", detail: "Délai dépassé" });
    const echec = await transcrireFeuille(JOUR, formulaire(tranche()));
    expect(!echec.ok && echec.error).toContain("Délai dépassé");

    etat.gemini.mockResolvedValueOnce({ ok: true, brut: { autre: 1 } });
    expect((await transcrireFeuille(JOUR, formulaire(tranche()))).ok).toBe(false);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")).toHaveLength(0);
  });

  it("dit qu'il n'y a rien de lisible plutôt que d'enregistrer un texte vide", async () => {
    etat.gemini.mockResolvedValue({ ok: true, brut: { texte: "   " } });
    const fake = brancher(ligne);
    const r = await transcrireFeuille(JOUR, formulaire(tranche()));
    expect(r).toEqual({ ok: false, error: "Aucune écriture lisible sur la feuille." });
    expect(ecritures(fake.appels, "feuilles_vidage", "update")).toHaveLength(0);
  });
});

describe("enregistrerTranscription et supprimerTranscription", () => {
  it("enregistre le texte corrigé et le marque comme modifié à la main", async () => {
    const fake = brancher();
    const r = await enregistrerTranscription(JOUR, "Texte corrigé");
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({
      transcription: "Texte corrigé",
      transcription_modifiee: true,
    });
  });

  it("traite un texte vidé comme une suppression", async () => {
    const fake = brancher();
    await enregistrerTranscription(JOUR, "   ");
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({
      transcription: null,
      transcription_modifiee: false,
    });
  });

  it("refuse un jour invalide ou un texte plus long que la limite", async () => {
    brancher();
    expect((await enregistrerTranscription("hier", "x")).ok).toBe(false);
    expect((await enregistrerTranscription(JOUR, "a".repeat(50_001))).ok).toBe(false);
  });

  it("supprime le texte sans toucher aux traits", async () => {
    const fake = brancher();
    const r = await supprimerTranscription(JOUR);
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({
      transcription: null,
      transcription_modifiee: false,
    });
  });

  it("signale un échec de base", async () => {
    brancher(() => ({ error: { message: "boom" } }));
    expect((await supprimerTranscription(JOUR)).ok).toBe(false);
    expect((await enregistrerTranscription(JOUR, "x")).ok).toBe(false);
  });
});
