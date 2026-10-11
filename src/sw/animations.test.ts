import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Charge le vrai public/sw.js dans un faux `self` (même méthode que
// notificationclick.test.ts) pour vérifier le service des animations.
const swSource = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

const OCTETS = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
const URL_VIDEO = "https://kilio.test/animations/musculation/developpe-couche.webm";

function chargerServiceWorker(enCache: boolean) {
  const listeners: Record<string, (event: unknown) => unknown> = {};
  const self = {
    location: { origin: "https://kilio.test" },
    addEventListener: (type: string, handler: (event: unknown) => unknown) => {
      listeners[type] = handler;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  const complet = () => new Response(OCTETS, { status: 200, headers: { "Content-Type": "video/webm" } });
  const cache = {
    match: vi.fn().mockImplementation(async () => (enCache ? complet() : undefined)),
    put: vi.fn().mockResolvedValue(undefined),
    addAll: vi.fn().mockResolvedValue(undefined),
  };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue([]), delete: vi.fn() };
  const fetchFictif = vi.fn().mockImplementation(async () => complet());
  new Function("self", "caches", "fetch", swSource)(self, caches, fetchFictif);
  return { listeners, cache, caches, fetchFictif };
}

async function demander(listeners: Record<string, (e: unknown) => unknown>, range?: string) {
  let promesse: Promise<Response> | undefined;
  const request = new Request(URL_VIDEO, { headers: range ? { Range: range } : {} });
  listeners.fetch({ request, respondWith: (p: Promise<Response>) => (promesse = p) });
  expect(promesse).toBeDefined();
  return promesse as Promise<Response>;
}

describe("service worker : animations", () => {
  it("précache les vidéos et les images à l'installation", async () => {
    const { listeners, cache } = chargerServiceWorker(true);
    let attente: Promise<unknown> = Promise.resolve();
    listeners.install({ waitUntil: (p: Promise<unknown>) => (attente = p) });
    await attente;
    const urls: string[] = cache.addAll.mock.calls.flatMap((c) => c[0]);
    expect(urls).toContain("/animations/musculation/elevation-laterale.webm");
    expect(urls).toContain("/animations/musculation/developpe-couche-incline.webp");
  });

  it("sert le fichier entier depuis le cache sans Range", async () => {
    const { listeners, fetchFictif } = chargerServiceWorker(true);
    const r = await demander(listeners);
    expect(r.status).toBe(200);
    expect((await r.arrayBuffer()).byteLength).toBe(100);
    expect(fetchFictif).not.toHaveBeenCalled();
  });

  it("répond 206 à une requête Range, depuis le cache", async () => {
    const { listeners, fetchFictif } = chargerServiceWorker(true);
    const r = await demander(listeners, "bytes=10-19");
    expect(r.status).toBe(206);
    expect(r.headers.get("Content-Range")).toBe("bytes 10-19/100");
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(fetchFictif).not.toHaveBeenCalled();
  });

  it("gère les plages ouvertes et en suffixe", async () => {
    const { listeners } = chargerServiceWorker(true);
    const ouverte = await demander(listeners, "bytes=95-");
    expect(ouverte.headers.get("Content-Range")).toBe("bytes 95-99/100");
    const suffixe = await demander(listeners, "bytes=-4");
    expect(suffixe.headers.get("Content-Range")).toBe("bytes 96-99/100");
  });

  it("répond 416 hors du fichier", async () => {
    const { listeners } = chargerServiceWorker(true);
    expect((await demander(listeners, "bytes=500-600")).status).toBe(416);
  });

  it("va au réseau puis met en cache le fichier entier quand il manque", async () => {
    const { listeners, cache, fetchFictif } = chargerServiceWorker(false);
    const r = await demander(listeners, "bytes=0-9");
    expect(fetchFictif).toHaveBeenCalledWith(URL_VIDEO);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(r.status).toBe(206);
  });

  it("garde le cache des animations à l'activation", async () => {
    const { listeners, caches } = chargerServiceWorker(true);
    caches.keys.mockResolvedValue(["nutrition-app-shell-v4", "kilio-animations-v1", "nutrition-app-shell-v5"]);
    let attente: Promise<unknown> = Promise.resolve();
    listeners.activate({ waitUntil: (p: Promise<unknown>) => (attente = p) });
    await attente;
    expect(caches.delete).toHaveBeenCalledTimes(1);
    expect(caches.delete).toHaveBeenCalledWith("nutrition-app-shell-v4");
  });
});
