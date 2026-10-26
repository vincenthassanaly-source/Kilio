import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Charge le vrai public/sw.js dans un faux `self` (même méthode que
// notificationclick.test.ts) pour vérifier la notification de fin de repos.
const swSource = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

function charger(clientsVisibles: boolean) {
  const listeners: Record<string, (event: unknown) => unknown> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const cache = {
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    addAll: vi.fn().mockResolvedValue(undefined),
  };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue([]), delete: vi.fn() };
  const self = {
    location: { origin: "https://kilio.test" },
    addEventListener: (type: string, handler: (event: unknown) => unknown) => {
      listeners[type] = handler;
    },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue(clientsVisibles ? [{ visibilityState: "visible" }] : []),
    },
    registration: { showNotification },
  };
  new Function("self", "caches", "fetch", swSource)(self, caches, vi.fn());
  return { listeners, showNotification, cache, caches };
}

async function pousser(listeners: Record<string, (e: unknown) => unknown>) {
  let attente: Promise<unknown> = Promise.resolve();
  listeners.push({
    data: { json: () => ({ type: "repos", title: "Repos terminé", body: "Squat · série 2/4", url: "/musculation/seance" }) },
    waitUntil: (p: Promise<unknown>) => (attente = p),
  });
  await attente;
}

describe("service worker : fin de repos", () => {
  it("demande explicitement un son (silent: false) et vibre", async () => {
    const { listeners, showNotification } = charger(false);
    await pousser(listeners);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][1]).toMatchObject({ silent: false, renotify: true, vibrate: [220, 90, 220] });
  });

  it("note dans le journal de diagnostic si la notification a été affichée", async () => {
    const { listeners, cache } = charger(false);
    await pousser(listeners);
    expect(cache.put).toHaveBeenCalled();
    const [cle, reponse] = cache.put.mock.calls.at(-1)!;
    expect(String(cle)).toContain("diag-repos");
    const journal = await (reponse as Response).json();
    expect(journal.at(-1)).toMatchObject({ source: "push", affichee: true });
  });

  it("garde le journal de diagnostic quand le service worker s'active", async () => {
    const { listeners, caches } = charger(false);
    caches.keys.mockResolvedValue(["kilio-diag", "ancien-cache"]);
    let attente: Promise<unknown> = Promise.resolve();
    listeners.activate({ waitUntil: (p: Promise<unknown>) => (attente = p) });
    await attente;
    const supprimes = caches.delete.mock.calls.map((c: unknown[]) => c[0]);
    expect(supprimes).toContain("ancien-cache");
    expect(supprimes).not.toContain("kilio-diag");
  });

  it("note aussi quand l'app visible évite la notification", async () => {
    const { listeners, cache, showNotification } = charger(true);
    await pousser(listeners);
    expect(showNotification).not.toHaveBeenCalled();
    const [, reponse] = cache.put.mock.calls.at(-1)!;
    const journal = await (reponse as Response).json();
    expect(journal.at(-1)).toMatchObject({ source: "push", affichee: false, appVisible: true });
  });
});
