import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Régression : écran verrouillé, Android suspend l'AudioContext ; la fin de repos ne
// faisait alors que vibrer (bip() sortait sans rien dire). Le signal doit tenter de
// relancer l'audio avant de jouer, et laisser une trace de ce qui s'est passé.

type Etat = "running" | "suspended" | "interrupted" | "closed";

function installerAudioContext(etatInitial: Etat, resumeReussit = true) {
  const oscillateurs: number[] = [];
  const instances: FakeContext[] = [];
  class FakeContext {
    state: Etat = etatInitial;
    currentTime = 0;
    destination = {};
    constructor() {
      instances.push(this);
    }
    resume = vi.fn(async () => {
      if (resumeReussit) this.state = "running";
    });
    createGain() {
      const param = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
      return { gain: param, connect: (n: unknown) => n };
    }
    createOscillator() {
      oscillateurs.push(1);
      return { frequency: { value: 0 }, connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() };
    }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  return { oscillateurs, instances };
}

async function charger() {
  vi.resetModules();
  return import("./useMinuteurRepos");
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signalerFinRepos", () => {
  it("relance un AudioContext suspendu avant de sonner", async () => {
    const { oscillateurs, instances } = installerAudioContext("running");
    const { deverrouillerAudio, signalerFinRepos } = await charger();
    deverrouillerAudio();
    instances[0].state = "suspended"; // l'écran s'est verrouillé entre-temps

    signalerFinRepos();
    await vi.waitFor(() => expect(oscillateurs.length).toBe(2));
  });

  it("recrée l'AudioContext s'il a été fermé par le système", async () => {
    const { oscillateurs, instances } = installerAudioContext("running");
    const { deverrouillerAudio, signalerFinRepos } = await charger();
    deverrouillerAudio();
    instances[0].state = "closed";

    signalerFinRepos();
    await vi.waitFor(() => expect(oscillateurs.length).toBe(2));
    expect(instances.length).toBe(2);
  });

  it("vibre quand même et note l'échec quand l'audio reste bloqué", async () => {
    const { oscillateurs, instances } = installerAudioContext("running", false);
    const { deverrouillerAudio, signalerFinRepos } = await charger();
    deverrouillerAudio();
    instances[0].state = "suspended";

    signalerFinRepos();
    const { lireDiagnosticRepos } = await import("./diagnosticRepos");
    await vi.waitFor(() => expect(lireDiagnosticRepos().length).toBeGreaterThan(0));

    expect(navigator.vibrate).toHaveBeenCalled();
    expect(oscillateurs.length).toBe(0);
    expect(lireDiagnosticRepos().at(-1)).toMatchObject({
      source: "page",
      audioAvant: "suspended",
      audioApres: "suspended",
      bips: false,
    });
  });

  it("consigne l'échec même si resume() ne répond jamais (écran verrouillé)", async () => {
    const { instances } = installerAudioContext("running");
    const { deverrouillerAudio, signalerFinRepos } = await charger();
    deverrouillerAudio();
    instances[0].state = "suspended";
    instances[0].resume = vi.fn(() => new Promise<void>(() => {}));

    signalerFinRepos();
    const { lireDiagnosticRepos } = await import("./diagnosticRepos");
    await vi.waitFor(() => expect(lireDiagnosticRepos().length).toBe(1), { timeout: 2000 });
    expect(lireDiagnosticRepos()[0]).toMatchObject({ audioAvant: "suspended", bips: false });
  });

  it("note un signal réussi avec l'état de l'audio", async () => {
    installerAudioContext("running");
    const { deverrouillerAudio, signalerFinRepos } = await charger();
    deverrouillerAudio();

    signalerFinRepos();
    const { lireDiagnosticRepos } = await import("./diagnosticRepos");
    await vi.waitFor(() => expect(lireDiagnosticRepos().length).toBe(1));
    expect(lireDiagnosticRepos()[0]).toMatchObject({ source: "page", audioAvant: "running", bips: true });
  });
});
