// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), gemini: vi.fn(), session: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/vidage/verrou", () => ({ exigerSession: etat.session }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({ appelerGemini: etat.gemini, MESSAGE_QUOTA_GEMINI: "Quota atteint." }));

import {
  enregistrerApercu,
  enregistrerFeuille,
  ajouterTexte,
  enregistrerTranscription,
  getFeuille,
  listerJoursEcrits,
  supprimerTranscription,
  transcrireFeuille,
  updateReglagesVidage,
  validerTranscription,
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
  etat.session.mockResolvedValue({ ok: true, data: undefined });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T20:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("verrou : module fermé", () => {
  it("refuse chaque action du module sans toucher à la base ni à Gemini", async () => {
    const verrouille = { ok: false, error: "Le module est verrouillé." };
    etat.session.mockResolvedValue(verrouille);
    const fake = brancher();
    const formulaire = new FormData();
    formulaire.append("tranche", new File([new Uint8Array(3)], "t.png", { type: "image/png" }));

    const resultats = await Promise.all([
      getFeuille(JOUR),
      enregistrerFeuille(JOUR, [TRAIT], 2000),
      enregistrerApercu(JOUR, png()),
      transcrireFeuille(JOUR, formulaire),
      validerTranscription(JOUR, "texte"),
      ajouterTexte(JOUR, "texte"),
      enregistrerTranscription(JOUR, "texte"),
      supprimerTranscription(JOUR),
      listerJoursEcrits("2026-10"),
    ]);
    for (const r of resultats) expect(r).toEqual(verrouille);
    expect(fake.appels).toHaveLength(0);
    expect(fake.stockage).toHaveLength(0);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("laisse le réglage du rappel accessible : il ne révèle rien du journal", async () => {
    etat.session.mockResolvedValue({ ok: false, error: "Le module est verrouillé." });
    brancher();
    expect((await updateReglagesVidage(true, "21:30")).ok).toBe(true);
  });
});

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
      data: { jour: JOUR, traits: [], hauteur: 2000, apercuUrl: null, updatedAt: null, transcription: null },
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

describe("getFeuille : texte du jour", () => {
  it("renvoie le texte du jour", async () => {
    brancher(() => ({
      data: { jour: JOUR, traits: [TRAIT], hauteur: 2000, apercu_path: null, updated_at: "x", transcription: "10:00\nBonjour" },
    }));
    const r = await getFeuille(JOUR);
    expect(r.ok && r.data.transcription).toBe("10:00\nBonjour");
  });

  it("renvoie « pas de texte » pour une feuille vide ou sans texte", async () => {
    brancher();
    const vide = await getFeuille(JOUR);
    expect(vide.ok && vide.data).toMatchObject({ transcription: null });
    brancher(() => ({ data: { jour: JOUR, traits: [TRAIT], hauteur: 2000, apercu_path: null, updated_at: "x" } }));
    const jamais = await getFeuille(JOUR);
    expect(jamais.ok && jamais.data.transcription).toBeNull();
  });
});

describe("enregistrerFeuille : le texte du jour survit à la feuille", () => {
  it("ne touche pas au texte quand les traits changent", async () => {
    const fake = brancher();
    await enregistrerFeuille(JOUR, [TRAIT, TRAIT], 2000);
    expect(ecritures(fake.appels, "feuilles_vidage", "upsert")[0].payload).not.toHaveProperty("transcription");
  });

  it("garde la ligne, sans traits ni aperçu, quand la feuille est vidée mais qu'il y a du texte", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { transcription: "10:00\nBonjour" } } : undefined));
    const r = await enregistrerFeuille(JOUR, [], 2000);
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "delete")).toHaveLength(0);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toMatchObject({ traits: [], apercu_path: null });
    expect(fake.stockage).toContainEqual({ bucket: "vider-tete", action: "remove", chemins: [`${JOUR}.png`] });
  });
});

describe("transcrireFeuille", () => {
  const tranche = (octets = 10, type = "image/png") => new File([new Uint8Array(octets).fill(1)], "t.png", { type });
  const formulaire = (...fichiers: File[]) => {
    const f = new FormData();
    fichiers.forEach((fichier) => f.append("tranche", fichier));
    return f;
  };
  const ligne = (a: { action: string }) => (a.action === "select" ? { data: { jour: JOUR } } : undefined);

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

  it("envoie les tranches en base64 à Gemini et renvoie le texte lu sans l'enregistrer", async () => {
    etat.gemini.mockResolvedValue({ ok: true, brut: { texte: "  Ma journée  " } });
    const fake = brancher(ligne);
    const r = await transcrireFeuille(JOUR, formulaire(tranche(3), tranche(3)));
    expect(r).toEqual({ ok: true, data: { texte: "Ma journée" } });

    const appel = etat.gemini.mock.calls[0][0];
    expect(appel.images).toEqual([
      { mimeType: "image/png", data: "AQEB" },
      { mimeType: "image/png", data: "AQEB" },
    ]);
    expect(appel.temperature).toBe(0);
    // Seule la validation (validerTranscription) enregistre le texte.
    expect(ecritures(fake.appels, "feuilles_vidage")).toHaveLength(0);
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

describe("validerTranscription et ajouterTexte", () => {
  // 20:00 UTC le 19 octobre 2026 = 22:00 à Paris.
  it("refuse un jour invalide, un texte vide ou un texte du jour qui deviendrait trop long", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { transcription: "a".repeat(49_990) } } : undefined));
    expect((await validerTranscription("hier", "x")).ok).toBe(false);
    expect((await ajouterTexte(JOUR, "   ")).ok).toBe(false);
    expect((await ajouterTexte(JOUR, "b".repeat(20))).ok).toBe(false);
    expect(ecritures(fake.appels, "feuilles_vidage")).toHaveLength(0);
  });

  it("valider ajoute le texte avec l'heure, vide la feuille et supprime l'aperçu", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { transcription: "09:00\nMatin" } } : undefined));
    const r = await validerTranscription(JOUR, "  Soir  ");
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toMatchObject({
      transcription: "09:00\nMatin\n\n22:00\nSoir",
      traits: [],
      apercu_path: null,
    });
    expect(fake.stockage).toContainEqual({ bucket: "vider-tete", action: "remove", chemins: [`${JOUR}.png`] });
  });

  it("ajouter une note tapée garde la feuille et son aperçu", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { transcription: null } } : undefined));
    const r = await ajouterTexte(JOUR, "Une idée");
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({ transcription: "22:00\nUne idée" });
    expect(fake.stockage).toHaveLength(0);
  });

  it("crée la ligne du jour, sans traits, quand il n'y en a pas encore", async () => {
    const fake = brancher();
    const r = await ajouterTexte(JOUR, "Première note");
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "insert")[0].payload).toMatchObject({
      jour: JOUR,
      transcription: "22:00\nPremière note",
      traits: [],
    });
  });

  it("signale un échec de base", async () => {
    brancher(() => ({ error: { message: "boom" } }));
    expect((await ajouterTexte(JOUR, "x")).ok).toBe(false);
  });
});

describe("enregistrerTranscription et supprimerTranscription", () => {
  it("enregistre le texte du jour corrigé à la main", async () => {
    const fake = brancher();
    const r = await enregistrerTranscription(JOUR, "Texte corrigé");
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({ transcription: "Texte corrigé" });
  });

  it("traite un texte vidé comme une suppression, et retire la ligne s'il ne reste pas d'écriture", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { traits: [] } } : undefined));
    await enregistrerTranscription(JOUR, "   ");
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({ transcription: null });
    expect(ecritures(fake.appels, "feuilles_vidage", "delete")).toHaveLength(1);
  });

  it("refuse un jour invalide ou un texte plus long que la limite", async () => {
    brancher();
    expect((await enregistrerTranscription("hier", "x")).ok).toBe(false);
    expect((await enregistrerTranscription(JOUR, "a".repeat(50_001))).ok).toBe(false);
  });

  it("supprime le texte sans toucher aux traits", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { traits: [TRAIT] } } : undefined));
    const r = await supprimerTranscription(JOUR);
    expect(r.ok).toBe(true);
    expect(ecritures(fake.appels, "feuilles_vidage", "update")[0].payload).toEqual({ transcription: null });
    expect(ecritures(fake.appels, "feuilles_vidage", "delete")).toHaveLength(0);
  });

  it("signale un échec de base", async () => {
    brancher(() => ({ error: { message: "boom" } }));
    expect((await supprimerTranscription(JOUR)).ok).toBe(false);
    expect((await enregistrerTranscription(JOUR, "x")).ok).toBe(false);
  });
});
