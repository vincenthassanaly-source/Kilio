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
  const fetchFictif = vi.fn().mockResolvedValue({ ok: true });
  const executer = new Function("self", "caches", "fetch", swSource);
  executer(self, { open: vi.fn(), keys: vi.fn(), delete: vi.fn() }, fetchFictif);
  return { self, listeners, fetchFictif };
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

// Rappel de séance (supabase/functions/envoyer-rappels-seances) : boutons
// « Commencer » (ouvre la séance en direct) et « Décaler » (route de report).
describe("sw.js rappel de séance", () => {
  const notification = () => ({ data: { url: "/aujourdhui", tacheId: null, seanceId: "s1" }, close: vi.fn() });

  it("affiche Commencer et Décaler sur une notification de séance, et rien sur une notification neutre", () => {
    const { self, listeners } = chargerServiceWorker();
    const evenementPush = (donnees: unknown) => ({
      data: { json: () => donnees },
      waitUntil: vi.fn(),
    });

    listeners.push(evenementPush({ title: "Séance : Renfo", body: "", url: "/aujourdhui", seanceId: "s1" }));
    listeners.push(evenementPush({ title: "Revue", body: "", url: "/revue" }));

    const [[, avecSeance], [, sansSeance]] = self.registration.showNotification.mock.calls;
    expect(avecSeance.actions.map((a: { action: string }) => a.action)).toEqual(["commencer", "decaler-seance"]);
    expect(avecSeance.data.seanceId).toBe("s1");
    expect(sansSeance.actions).toEqual([]);
  });

  it("« Décaler » appelle la route de report sans ouvrir de fenêtre", async () => {
    const { self, listeners, fetchFictif } = chargerServiceWorker();
    const n = notification();
    let attendu: Promise<unknown> = Promise.resolve();

    listeners.notificationclick({
      action: "decaler-seance",
      notification: n,
      waitUntil: (promise: Promise<unknown>) => {
        attendu = promise;
      },
    });
    await attendu;

    expect(fetchFictif).toHaveBeenCalledWith("/api/seances/s1/decaler", { method: "POST" });
    expect(n.close).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  const cliquer = async (self: ReturnType<typeof chargerServiceWorker>, action: string) => {
    let attendu: Promise<unknown> = Promise.resolve();
    self.listeners.notificationclick({
      action,
      notification: notification(),
      waitUntil: (promise: Promise<unknown>) => {
        attendu = promise;
      },
    });
    await attendu;
  };

  it("« Commencer » ouvre la séance en direct liée à la séance planifiée, sans appel réseau", async () => {
    const sw = chargerServiceWorker();
    sw.self.clients.matchAll.mockResolvedValue([]);

    await cliquer(sw, "commencer");

    expect(sw.self.clients.openWindow).toHaveBeenCalledWith("/musculation/seance?seance=s1");
    expect(sw.fetchFictif).not.toHaveBeenCalled();
  });

  it("« Commencer » réutilise la fenêtre déjà ouverte sur la séance en direct", async () => {
    const sw = chargerServiceWorker();
    const fenetre = {
      url: "https://kilio.test/musculation/seance",
      focused: true,
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    };
    sw.self.clients.matchAll.mockResolvedValue([fenetre]);

    await cliquer(sw, "commencer");

    expect(fenetre.navigate).toHaveBeenCalledWith("/musculation/seance?seance=s1");
    expect(fenetre.focus).toHaveBeenCalled();
    expect(sw.self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("un clic sur le corps de la notification ouvre l'app sans cocher", async () => {
    const sw = chargerServiceWorker();
    sw.self.clients.matchAll.mockResolvedValue([]);

    await cliquer(sw, "");

    expect(sw.self.clients.openWindow).toHaveBeenCalledWith("/aujourdhui");
    expect(sw.fetchFictif).not.toHaveBeenCalled();
  });

  it("« Décaler » échoué (hors-ligne) ne lève pas d'exception", async () => {
    const { listeners, fetchFictif } = chargerServiceWorker();
    fetchFictif.mockRejectedValue(new Error("offline"));
    let attendu: Promise<unknown> = Promise.resolve();

    listeners.notificationclick({
      action: "decaler-seance",
      notification: notification(),
      waitUntil: (promise: Promise<unknown>) => {
        attendu = promise;
      },
    });

    await expect(attendu).resolves.toBeUndefined();
  });
});
