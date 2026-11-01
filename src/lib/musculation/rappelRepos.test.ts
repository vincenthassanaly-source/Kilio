// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const brouillon = (finA: string | null) =>
  ({
    id: "b",
    nom: "Push",
    routineId: null,
    debutA: "2026-11-01T10:00:00.000Z",
    repos: finA ? { debutA: "2026-11-01T10:00:00.000Z", finA, dureeS: 90, exerciceCle: "c" } : null,
    exercices: [
      { cle: "c", exerciceId: "x", nom: "Développé couché", mode: "poids_reps", reposS: 90, series: [{ id: "s1", fait: false, type: "normale" }], precedent: [] },
    ],
  }) as never;

describe("synchroniserRappelRepos", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("Notification", { permission: "granted" });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("programme le rappel avec keepalive pour survivre à la mise en veille", async () => {
    const { synchroniserRappelRepos } = await import("./rappelRepos");
    synchroniserRappelRepos(brouillon("2026-11-01T10:01:30.000Z"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rappel-repos");
    expect(options.method).toBe("POST");
    expect(options.keepalive).toBe(true);
  });

  it("n'envoie rien sans autorisation de notifications, mais annule quand même", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    const { synchroniserRappelRepos } = await import("./rappelRepos");
    synchroniserRappelRepos(brouillon("2026-11-01T10:01:30.000Z"));
    expect(fetchMock).not.toHaveBeenCalled();
    synchroniserRappelRepos(brouillon(null));
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("retente après un échec réseau, sans attendre une nouvelle saisie", async () => {
    fetchMock.mockRejectedValueOnce(new Error("hors ligne")).mockResolvedValue({ ok: true, status: 200 });
    const { synchroniserRappelRepos } = await import("./rappelRepos");
    synchroniserRappelRepos(brouillon("2026-11-01T10:01:30.000Z"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Une fois confirmé, plus aucun renvoi.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ne renvoie pas deux fois le même état", async () => {
    const { synchroniserRappelRepos } = await import("./rappelRepos");
    synchroniserRappelRepos(brouillon("2026-11-01T10:01:30.000Z"));
    await vi.advanceTimersByTimeAsync(0);
    synchroniserRappelRepos(brouillon("2026-11-01T10:01:30.000Z"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
