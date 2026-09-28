import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Charge le vrai public/sw.js (script non bundlé, servi tel quel) dans un
// faux `self` pour tester son comportement réel plutôt qu'une copie qui
// pourrait diverger du fichier déployé.
const swSource = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

type FakeClient = {
  url: string;
  focused: boolean;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
};

function chargerServiceWorker() {
  const listeners: Record<string, (event: unknown) => unknown> = {};
  const self = {
    location: { origin: "https://kilio.test" },
    addEventListener: (type: string, handler: (event: unknown) => unknown) => {
      listeners[type] = handler;
    },
    skipWaiting: vi.fn(),
    clients: {
      matchAll: vi.fn(),
      openWindow: vi.fn(),
      claim: vi.fn(),
    },
    registration: { showNotification: vi.fn() },
  };
  const executer = new Function("self", "caches", "fetch", swSource);
  executer(self, { open: vi.fn(), keys: vi.fn(), delete: vi.fn() }, vi.fn());
  return { self, listeners };
}

function creerNotification(url: string, tacheId: string) {
  return { data: { url, tacheId }, close: vi.fn() };
}

// CLICK-PATH-605 : un tap sur une notification de rappel de tâche doit
// ramener la PWA au premier plan même si son window client est en
// arrière-plan/minimisé sur Android — `focus()` seul ne le garantit pas
// (limite Chromium connue), il faut passer par `openWindow()` dans ce cas.
describe("sw.js notificationclick (CLICK-PATH-605)", () => {
  it("appelle openWindow() plutôt que focus() quand la fenêtre existante n'est pas au premier plan", async () => {
    const { self, listeners } = chargerServiceWorker();
    const fenetreArrierePlan: FakeClient = {
      url: "https://kilio.test/agenda",
      focused: false,
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    };
    self.clients.matchAll.mockResolvedValue([fenetreArrierePlan]);

    let attendu: Promise<unknown> = Promise.resolve();
    const event = {
      action: "",
      notification: creerNotification("/agenda?tache=abc", "abc"),
      waitUntil: (promise: Promise<unknown>) => {
        attendu = promise;
      },
    };

    listeners.notificationclick(event);
    await attendu;

    expect(self.clients.openWindow).toHaveBeenCalledWith("/agenda?tache=abc");
    expect(fenetreArrierePlan.focus).not.toHaveBeenCalled();
  });

  it("réutilise focus() + navigate() sans openWindow() quand la fenêtre existante est déjà au premier plan", async () => {
    const { self, listeners } = chargerServiceWorker();
    const fenetreAuPremierPlan: FakeClient = {
      url: "https://kilio.test/agenda",
      focused: true,
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    };
    self.clients.matchAll.mockResolvedValue([fenetreAuPremierPlan]);

    let attendu: Promise<unknown> = Promise.resolve();
    const event = {
      action: "",
      notification: creerNotification("/agenda?tache=xyz", "xyz"),
      waitUntil: (promise: Promise<unknown>) => {
        attendu = promise;
      },
    };

    listeners.notificationclick(event);
    await attendu;

    expect(fenetreAuPremierPlan.navigate).toHaveBeenCalledWith("/agenda?tache=xyz");
    expect(fenetreAuPremierPlan.focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });
});
