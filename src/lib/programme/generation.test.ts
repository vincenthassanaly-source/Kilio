import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  construirePrompt,
  genererProgrammeParGemini,
  interpreterProgramme,
  type ContexteJour,
  type EntreeProgramme,
} from "./generation";

const p = (debut: string, fin: string) => ({ debut, fin });

// Jour travaillé 09:00-17:00 ; il est 17:10 : reste 17:10-18:00 et 19:00-22:00.
const contexte: ContexteJour = {
  maintenant: "17:10",
  creneauxTravail: [p("09:00", "17:00")],
  plagesLibres: [p("17:10", "18:00"), p("19:00", "22:00")],
  plafond: 3,
};

const entree: EntreeProgramme = {
  taches: [{ titre: "Appeler la banque", heure: null, heureFin: null, priorite: "haute", enRetard: false }],
  notes: [],
  habitudes: [{ nom: "Lecture", faite: false }],
  contexte,
};

describe("construirePrompt", () => {
  it("situe la journée : heure, travail, plages libres et temps libre", () => {
    const prompt = construirePrompt(entree);

    expect(prompt).toContain("Il est 17:10 à Paris.");
    expect(prompt).toContain("jour travaillé (créneaux de travail : 09:00–17:00)");
    expect(prompt).toContain('[{"debut":"17:10","fin":"18:00"},{"debut":"19:00","fin":"22:00"}]');
    // 50 min + 3 h = 3 h 50
    expect(prompt).toContain("temps libre total : 3 h 50");
    expect(prompt).toContain("3 suggestions maximum");
  });

  it("demande un créneau contenu dans une plage libre et interdit d'en inventer", () => {
    const prompt = construirePrompt(entree);

    expect(prompt).toContain("`creneau`");
    expect(prompt).toContain("entièrement contenu dans UNE des plages libres");
    expect(prompt).toContain("N'invente jamais de plage libre");
    expect(prompt).toContain("ne leur donne pas de créneau");
  });

  it("jour de repos avec beaucoup de temps : pas de consigne de sobriété", () => {
    const prompt = construirePrompt({
      ...entree,
      contexte: { ...contexte, creneauxTravail: [], plagesLibres: [p("09:00", "22:00")], plafond: 5 },
    });

    expect(prompt).toContain("jour de repos (aucun créneau de travail)");
    expect(prompt).not.toContain("propose peu de choses");
  });

  it("jour travaillé ou peu de temps : demande de rester sobre", () => {
    expect(construirePrompt(entree)).toContain("propose peu de choses");
    expect(construirePrompt({ ...entree, contexte: { ...contexte, creneauxTravail: [], plafond: 2 } })).toContain(
      "propose peu de choses"
    );
  });

  it("garde le contenu des tâches, notes et habitudes", () => {
    const prompt = construirePrompt(entree);
    expect(prompt).toContain("Appeler la banque");
    expect(prompt).toContain("Lecture");
  });
});

describe("interpreterProgramme", () => {
  const brut = (propositions: unknown[]) => ({ intro: "Une soirée légère.", propositions });

  it("garde un créneau valide et l'affiche avec un tiret demi-cadratin", () => {
    const r = interpreterProgramme(
      brut([{ texte: "Appeler la banque", source: "tache", creneau: "17:15-17:45" }]),
      contexte
    );

    expect(r).toEqual({
      intro: "Une soirée légère.",
      propositions: [{ texte: "Appeler la banque", source: "tache", creneau: "17:15–17:45" }],
    });
  });

  it("retire un créneau qui chevauche le travail mais garde la suggestion", () => {
    const r = interpreterProgramme(brut([{ texte: "Lire", source: "habitude", creneau: "16:00-17:00" }]), contexte);

    expect(r?.propositions).toEqual([{ texte: "Lire", source: "habitude", creneau: null }]);
  });

  it("retire un créneau à cheval sur une plage occupée (18:00-19:00)", () => {
    const r = interpreterProgramme(brut([{ texte: "Lire", source: "habitude", creneau: "17:30-19:30" }]), contexte);
    expect(r?.propositions[0].creneau).toBeNull();
  });

  it("retire le créneau d'une suggestion qui chevauche une précédente", () => {
    const r = interpreterProgramme(
      brut([
        { texte: "A", source: "tache", creneau: "19:00-20:00" },
        { texte: "B", source: "tache", creneau: "19:30-20:30" },
        { texte: "C", source: "tache", creneau: "20:00-21:00" },
      ]),
      contexte
    );

    expect(r?.propositions.map((x) => [x.texte, x.creneau])).toEqual([
      ["A", "19:00–20:00"],
      ["C", "20:00–21:00"],
      ["B", null],
    ]);
  });

  it("trie dans l'ordre de la journée, celles sans créneau à la suite (ordre conservé)", () => {
    const r = interpreterProgramme(
      brut([
        { texte: "Sans horaire 1", source: "general", creneau: "" },
        { texte: "Tard", source: "tache", creneau: "20:00-21:00" },
        { texte: "Sans horaire 2", source: "note", creneau: "" },
        { texte: "Tôt", source: "tache", creneau: "17:10-17:40" },
      ]),
      { ...contexte, plafond: 5 }
    );

    expect(r?.propositions.map((x) => x.texte)).toEqual(["Tôt", "Tard", "Sans horaire 1", "Sans horaire 2"]);
  });

  it("respecte le plafond", () => {
    const r = interpreterProgramme(
      brut(Array.from({ length: 6 }, (_, i) => ({ texte: `T${i}`, source: "general", creneau: "" }))),
      contexte
    );

    expect(r?.propositions).toHaveLength(3);
  });

  it("source inconnue ou absente : « general » ; créneau absent : null", () => {
    const r = interpreterProgramme(brut([{ texte: "X", source: "inconnue" }, { texte: "Y" }]), contexte);

    expect(r?.propositions).toEqual([
      { texte: "X", source: "general", creneau: null },
      { texte: "Y", source: "general", creneau: null },
    ]);
  });

  it("écarte les entrées sans texte", () => {
    const r = interpreterProgramme(
      brut([{ source: "tache" }, null, "vrac", { texte: "Ok", source: "tache", creneau: "" }]),
      contexte
    );
    expect(r?.propositions.map((x) => x.texte)).toEqual(["Ok"]);
  });

  it("null quand la structure est invalide", () => {
    expect(interpreterProgramme(null, contexte)).toBeNull();
    expect(interpreterProgramme("texte", contexte)).toBeNull();
    expect(interpreterProgramme({ intro: 3, propositions: [] }, contexte)).toBeNull();
    expect(interpreterProgramme({ intro: "ok" }, contexte)).toBeNull();
  });
});

describe("genererProgrammeParGemini", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", "cle-de-test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function reponse(json: unknown, status = 200) {
    return new Response(JSON.stringify(json), { status });
  }

  it("envoie un schéma avec `creneau` obligatoire, sans `nullable`, borné au plafond", async () => {
    fetchMock.mockResolvedValue(
      reponse({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intro: "Ok", propositions: [] }) }] } }] })
    );

    await genererProgrammeParGemini(entree);

    const corps = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const schema = corps.generationConfig.responseSchema;
    expect(JSON.stringify(schema)).not.toContain("nullable");
    expect(schema.properties.propositions.maxItems).toBe(3);
    expect(schema.properties.propositions.items.required).toEqual(["texte", "source", "creneau"]);
    expect(corps.contents[0].parts[0].text).toContain("Il est 17:10 à Paris.");
  });

  it("renvoie le programme avec ses créneaux validés", async () => {
    const texte = JSON.stringify({
      intro: "Ce soir, du calme.",
      propositions: [
        { texte: "Appeler la banque", source: "tache", creneau: "17:15-17:45" },
        { texte: "Lecture", source: "habitude", creneau: "10:00-11:00" },
      ],
    });
    fetchMock.mockResolvedValue(reponse({ candidates: [{ content: { parts: [{ text: texte }] } }] }));

    const r = await genererProgrammeParGemini(entree);

    expect(r).toEqual({
      ok: true,
      programme: {
        intro: "Ce soir, du calme.",
        propositions: [
          { texte: "Appeler la banque", source: "tache", creneau: "17:15–17:45" },
          { texte: "Lecture", source: "habitude", creneau: null },
        ],
      },
    });
  });

  it("n'expose jamais la clé dans l'URL", async () => {
    fetchMock.mockResolvedValue(
      reponse({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intro: "Ok", propositions: [] }) }] } }] })
    );

    await genererProgrammeParGemini(entree);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("cle-de-test");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("cle-de-test");
  });

  it("rapporte la cause d'un refus de Google (clé invalide, par exemple)", async () => {
    fetchMock.mockResolvedValue(reponse({ error: { message: "API key not valid. Please pass a valid API key." } }, 400));

    const r = await genererProgrammeParGemini(entree);

    expect(r).toEqual({
      ok: false,
      code: "echec",
      detail: "Gemini a répondu 400 : API key not valid. Please pass a valid API key.",
    });
  });

  it("distingue le quota", async () => {
    fetchMock.mockResolvedValue(reponse({ error: { message: "quota" } }, 429));

    expect(await genererProgrammeParGemini(entree)).toMatchObject({ ok: false, code: "quota" });
  });

  it("rapporte un modèle introuvable (404) avec le message de Google", async () => {
    fetchMock.mockResolvedValue(reponse({ error: { message: "models/xyz is not found for API version v1beta" } }, 404));

    const r = await genererProgrammeParGemini(entree);

    expect(!r.ok && r.detail).toBe("Gemini a répondu 404 : models/xyz is not found for API version v1beta");
  });

  it("rapporte une réponse sans texte, un JSON illisible et une structure invalide", async () => {
    fetchMock.mockResolvedValueOnce(reponse({ candidates: [{ finishReason: "SAFETY" }] }));
    const sansTexte = await genererProgrammeParGemini(entree);
    expect(!sansTexte.ok && sansTexte.detail).toBe("Réponse Gemini sans texte (SAFETY).");

    fetchMock.mockResolvedValueOnce(reponse({ candidates: [{ content: { parts: [{ text: "{pas du json" }] } }] }));
    const illisible = await genererProgrammeParGemini(entree);
    expect(!illisible.ok && illisible.detail).toBe("Réponse Gemini illisible.");

    fetchMock.mockResolvedValueOnce(
      reponse({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intro: 1 }) }] } }] })
    );
    const invalide = await genererProgrammeParGemini(entree);
    expect(!invalide.ok && invalide.detail).toMatch(/Réponse Gemini invalide/);
  });

  it("nomme le délai dépassé et la clé absente (sans appeler Google)", async () => {
    const delai = new Error("timeout");
    delai.name = "TimeoutError";
    fetchMock.mockRejectedValueOnce(delai);
    const r = await genererProgrammeParGemini(entree);
    expect(!r.ok && r.detail).toMatch(/Délai dépassé \(8 s\)/);

    vi.stubEnv("GEMINI_API_KEY", "");
    fetchMock.mockClear();
    const sansCle = await genererProgrammeParGemini(entree);
    expect(!sansCle.ok && sansCle.detail).toMatch(/GEMINI_API_KEY absente/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
