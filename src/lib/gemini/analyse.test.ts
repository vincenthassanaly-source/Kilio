// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGE_QUOTA_GEMINI, type AppelGemini, type ResultatGemini } from "./appel";
import { analyserPaquet, messageEchec, type Analyse } from "./analyse";

// Le seam est l'appel Gemini : un faux le remplace, sans réseau.
function fauxGemini(repondre: (appel: AppelGemini) => ResultatGemini | Promise<ResultatGemini>) {
  const appels: AppelGemini[] = [];
  const gemini = async (appel: AppelGemini) => {
    appels.push(appel);
    return repondre(appel);
  };
  return { gemini, appels };
}

const ok = (brut: unknown): ResultatGemini => ({ ok: true, brut });

/** Analyse de test : l'élément est une chaîne, la suggestion est le champ `t` de la réponse. */
function analyse(extra: Partial<Analyse<string, string, string>> = {}): Analyse<string, string, string> {
  return {
    etiquette: "test-analyse",
    schema: { type: "OBJECT" },
    verbe: "lire cet élément",
    tailleMax: 3,
    preparer: (element) => ({ prompt: `Analyse ${element}`, contexte: element }),
    lire: (brut, contexte) => `${contexte}:${(brut as { t: string }).t}`,
    ...extra,
  };
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("messageEchec", () => {
  it("renvoie le message de quota, qu'il vienne d'un résultat Gemini ou d'un échec converti", () => {
    expect(messageEchec({ code: "quota", detail: "429" })).toBe(MESSAGE_QUOTA_GEMINI);
    expect(messageEchec({ quota: true, detail: "429" }, "Intro")).toBe(MESSAGE_QUOTA_GEMINI);
  });

  it("ajoute la consigne de réessayer au détail des autres échecs", () => {
    expect(messageEchec({ code: "echec", detail: "Délai dépassé." })).toBe("Délai dépassé. Réessaie.");
    expect(messageEchec({ quota: false, detail: "Délai dépassé." })).toBe("Délai dépassé. Réessaie.");
  });

  it("place le détail entre parenthèses derrière l'introduction de la feature", () => {
    expect(messageEchec({ code: "echec", detail: "Délai dépassé" }, "La recherche n'a pas abouti")).toBe(
      "La recherche n'a pas abouti (Délai dépassé). Réessaie."
    );
  });
});

describe("analyserPaquet", () => {
  it("renvoie une suggestion par élément, dans l'ordre, en repassant le contexte à la lecture", async () => {
    const { gemini } = fauxGemini((a) => ok({ t: a.prompt.slice(-1) }));
    const r = await analyserPaquet(analyse(), ["a", "b"], { gemini });
    expect(r).toEqual([
      { statut: "ok", suggestion: "a:a" },
      { statut: "ok", suggestion: "b:b" },
    ]);
  });

  it("transmet prompt, images, schéma, étiquette et température, avec 45 s de délai par défaut", async () => {
    const images = [{ mimeType: "image/png", data: "AAAA" }];
    const { gemini, appels } = fauxGemini(() => ok({ t: "x" }));
    await analyserPaquet(
      analyse({ temperature: 0.1, preparer: (e) => ({ prompt: `P ${e}`, images, contexte: e }) }),
      ["a"],
      { gemini }
    );
    expect(appels[0]).toEqual({
      prompt: "P a",
      images,
      schema: { type: "OBJECT" },
      timeoutMs: 45_000,
      temperature: 0.1,
      etiquette: "test-analyse",
    });
  });

  it("laisse chaque feature surcharger le délai", async () => {
    const { gemini, appels } = fauxGemini(() => ok({ t: "x" }));
    await analyserPaquet(analyse({ timeoutMs: 30_000 }), ["a"], { gemini });
    expect(appels[0].timeoutMs).toBe(30_000);
  });

  it("signale le quota sur l'élément concerné sans faire échouer les autres", async () => {
    const { gemini } = fauxGemini((a) => (a.prompt.endsWith("b") ? { ok: false, code: "quota", detail: "429" } : ok({ t: "x" })));
    const r = await analyserPaquet(analyse(), ["a", "b", "c"], { gemini });
    expect(r.map((x) => x.statut)).toEqual(["ok", "echec", "ok"]);
    expect(r[1]).toEqual({ statut: "echec", erreur: MESSAGE_QUOTA_GEMINI, quota: true });
  });

  it("garde le détail d'un autre échec Gemini, dans la phrase de la feature", async () => {
    const { gemini } = fauxGemini(() => ({ ok: false, code: "echec", detail: "Délai dépassé" }));
    const [r] = await analyserPaquet(analyse({ verbe: "ranger cet élément" }), ["a"], { gemini });
    expect(r).toEqual({ statut: "echec", erreur: "Gemini n'a pas pu ranger cet élément (Délai dépassé)", quota: false });
  });

  it("classe une réponse que la lecture refuse comme illisible", async () => {
    const { gemini } = fauxGemini(() => ok({ t: "x" }));
    const [r] = await analyserPaquet(
      analyse({
        lire: () => {
          throw new Error("schéma invalide");
        },
      }),
      ["a"],
      { gemini }
    );
    expect(r).toEqual({ statut: "echec", erreur: "Gemini n'a pas pu lire cet élément (réponse illisible)", quota: false });
  });

  it("accepte une suggestion nulle (aucun choix) sans la prendre pour une réponse illisible", async () => {
    const { gemini } = fauxGemini(() => ok({}));
    const [r] = await analyserPaquet(analyse({ lire: () => null as unknown as string }), ["a"], { gemini });
    expect(r).toEqual({ statut: "ok", suggestion: null });
  });

  it("refuse l'élément sans appeler Gemini quand la préparation le refuse", async () => {
    const { gemini, appels } = fauxGemini(() => ok({ t: "x" }));
    const [r] = await analyserPaquet(analyse({ preparer: () => ({ refus: "Élément introuvable." }) }), ["a"], { gemini });
    expect(r).toEqual({ statut: "echec", erreur: "Élément introuvable.", quota: false });
    expect(appels).toHaveLength(0);
  });

  it("isole un élément dont la préparation lève, sans faire échouer les autres", async () => {
    const { gemini } = fauxGemini(() => ok({ t: "x" }));
    const r = await analyserPaquet(
      analyse({
        preparer: (e) => {
          if (e === "b") throw new Error("base en panne");
          return { prompt: e, contexte: e };
        },
      }),
      ["a", "b"],
      { gemini }
    );
    expect(r[0].statut).toBe("ok");
    expect(r[1]).toEqual({ statut: "echec", erreur: "L'analyse a échoué de façon inattendue.", quota: false });
  });

  it("refuse un paquet trop grand sans rien préparer ni appeler", async () => {
    const preparer = vi.fn();
    const { gemini, appels } = fauxGemini(() => ok({ t: "x" }));
    const r = await analyserPaquet(analyse({ tailleMax: 2, preparer }), ["a", "b", "c"], { gemini });
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.statut === "echec")).toBe(true);
    expect(preparer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("lance les analyses en parallèle, pas l'une après l'autre", async () => {
    let actifs = 0;
    let maximum = 0;
    const { gemini } = fauxGemini(async () => {
      actifs += 1;
      maximum = Math.max(maximum, actifs);
      await new Promise((resolve) => setTimeout(resolve, 20));
      actifs -= 1;
      return ok({ t: "x" });
    });
    await analyserPaquet(analyse(), ["a", "b"], { gemini });
    expect(maximum).toBe(2);
  });

  it("renvoie une liste vide pour un paquet vide", async () => {
    const { gemini, appels } = fauxGemini(() => ok({ t: "x" }));
    expect(await analyserPaquet(analyse(), [], { gemini })).toEqual([]);
    expect(appels).toHaveLength(0);
  });
});
