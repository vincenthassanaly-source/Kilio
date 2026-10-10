import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = { id?: number; module: string; action_name: string; payload: unknown[]; created_at: string; tentatives?: number };

// Faux Dexie en mémoire : seule la surface utilisée par queue.ts.
const etat = vi.hoisted(() => ({ lignes: [] as Ligne[], prochainId: 1 }));

vi.mock("./db", () => {
  const table = {
    toArray: async () => [...etat.lignes],
    orderBy: () => ({
      toArray: async () =>
        [...etat.lignes].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id! - b.id!)),
    }),
    add: async (l: Ligne) => {
      etat.lignes.push({ ...l, id: etat.prochainId++ });
    },
    bulkDelete: async (ids: number[]) => {
      etat.lignes = etat.lignes.filter((l) => !ids.includes(l.id!));
    },
    delete: async (id: number) => {
      etat.lignes = etat.lignes.filter((l) => l.id !== id);
    },
    update: async (id: number, patch: Partial<Ligne>) => {
      etat.lignes = etat.lignes.map((l) => (l.id === id ? { ...l, ...patch } : l));
    },
    count: async () => etat.lignes.length,
  };
  return { db: { pending_actions: table, transaction: async (_m: string, _t: unknown, fn: () => Promise<void>) => fn() } };
});

vi.mock("@/components/toast/toast-store", () => ({ showToast: vi.fn() }));
vi.mock("@/app/actions/taches", () => ({ setTacheFait: vi.fn(), deleteTache: vi.fn() }));
vi.mock("@/app/actions/notes", () => ({ toggleNoteItem: vi.fn(), deleteNote: vi.fn() }));
vi.mock("@/app/actions/courses", () => ({
  createCourseItem: vi.fn(),
  toggleCourseItem: vi.fn(),
  deleteCourseItem: vi.fn(),
  updateCourseItem: vi.fn(),
  deleteCourseItems: vi.fn(),
  restoreCourseItems: vi.fn(),
  ajouterArticlesCourses: vi.fn(),
}));
vi.mock("@/app/actions/habitudes", () => ({ enregistrerEntreeHabitude: vi.fn(), supprimerHabitude: vi.fn() }));
vi.mock("@/app/actions/pharmacie", () => ({ noterCarte: vi.fn() }));

import { showToast } from "@/components/toast/toast-store";
import { setTacheFait, deleteTache } from "@/app/actions/taches";
import { toggleNoteItem } from "@/app/actions/notes";
import { toggleCourseItem } from "@/app/actions/courses";
import { enqueueAction, EVENEMENT_FILE_AJOUT, flushQueue } from "./queue";

let horloge = 0;
function ajouter(module: string, action_name: string, payload: unknown[], tentatives?: number) {
  // created_at croissant et déterministe pour fixer l'ordre de rejeu.
  etat.lignes.push({
    id: etat.prochainId++,
    module,
    action_name,
    payload,
    created_at: new Date(1_700_000_000_000 + horloge++ * 1000).toISOString(),
    ...(tentatives === undefined ? {} : { tentatives }),
  });
}

beforeEach(() => {
  etat.lignes = [];
  etat.prochainId = 1;
  horloge = 0;
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("enqueueAction", () => {
  it("ajoute l'action avec created_at et émet l'évènement de mise en file", async () => {
    const ecoute = vi.fn();
    window.addEventListener(EVENEMENT_FILE_AJOUT, ecoute);
    await enqueueAction("notes", "toggleNoteItem", ["n1", true]);
    window.removeEventListener(EVENEMENT_FILE_AJOUT, ecoute);

    expect(etat.lignes).toHaveLength(1);
    expect(etat.lignes[0]).toMatchObject({ module: "notes", action_name: "toggleNoteItem", payload: ["n1", true] });
    expect(typeof etat.lignes[0].created_at).toBe("string");
    expect(ecoute).toHaveBeenCalledTimes(1);
  });

  it("ne garde que la dernière coche d'une même tâche", async () => {
    await enqueueAction("taches", "setTacheFait", ["t1", true]);
    await enqueueAction("taches", "setTacheFait", ["t2", true]);
    await enqueueAction("taches", "setTacheFait", ["t1", false]);

    expect(etat.lignes.map((l) => l.payload)).toEqual([["t2", true], ["t1", false]]);
  });

  it("n'écrase pas les actions qui ne sont pas des états absolus", async () => {
    await enqueueAction("taches", "deleteTache", ["t1"]);
    await enqueueAction("taches", "deleteTache", ["t1"]);
    expect(etat.lignes).toHaveLength(2);
  });
});

describe("flushQueue", () => {
  it("ne fait rien sur une file vide", async () => {
    expect(await flushQueue()).toEqual({ synced: 0, abandoned: 0, restantes: 0 });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("rejoue dans l'ordre, vide la file et annonce le nombre d'actions", async () => {
    ajouter("taches", "setTacheFait", ["t1", true]);
    ajouter("taches", "deleteTache", ["t2"]);
    const ordre: string[] = [];
    vi.mocked(setTacheFait).mockImplementation(async () => void ordre.push("fait"));
    vi.mocked(deleteTache).mockImplementation(async () => void ordre.push("delete"));

    expect(await flushQueue()).toEqual({ synced: 2, abandoned: 0, restantes: 0 });
    expect(ordre).toEqual(["fait", "delete"]);
    expect(setTacheFait).toHaveBeenCalledWith("t1", true);
    expect(showToast).toHaveBeenCalledWith("2 actions synchronisées");
  });

  it("accorde le singulier pour une seule action", async () => {
    ajouter("taches", "deleteTache", ["t2"]);
    await flushQueue();
    expect(showToast).toHaveBeenCalledWith("1 action synchronisée");
  });

  it("s'arrête sur une erreur réseau sans compter de tentative", async () => {
    ajouter("taches", "setTacheFait", ["t1", true]);
    ajouter("taches", "deleteTache", ["t2"]);
    vi.mocked(setTacheFait).mockRejectedValue(new Error("Failed to fetch"));

    expect(await flushQueue()).toEqual({ synced: 0, abandoned: 0, restantes: 2 });
    expect(deleteTache).not.toHaveBeenCalled();
    expect(etat.lignes[0].tentatives).toBeUndefined();
  });

  it("compte une tentative sur une erreur serveur puis s'arrête", async () => {
    ajouter("taches", "setTacheFait", ["t1", true]);
    ajouter("taches", "deleteTache", ["t2"]);
    vi.mocked(setTacheFait).mockRejectedValue(new Error("Erreur serveur"));

    expect(await flushQueue()).toEqual({ synced: 0, abandoned: 0, restantes: 2 });
    expect(etat.lignes[0].tentatives).toBe(1);
    expect(deleteTache).not.toHaveBeenCalled();
  });

  it("abandonne l'action au 3e échec non réseau et continue avec les suivantes", async () => {
    ajouter("taches", "setTacheFait", ["t1", true], 2);
    ajouter("notes", "toggleNoteItem", ["n1", true]);
    vi.mocked(setTacheFait).mockRejectedValue(new Error("Erreur serveur"));

    expect(await flushQueue()).toEqual({ synced: 1, abandoned: 1, restantes: 0 });
    expect(toggleNoteItem).toHaveBeenCalledWith("n1", true);
    expect(showToast).toHaveBeenCalledWith("1 action synchronisée");
    expect(showToast).toHaveBeenCalledWith("1 action hors ligne n'a pas pu être synchronisée et a été abandonnée.", 5000);
  });

  it("purge sans appel serveur une action courses visant un id temporaire", async () => {
    ajouter("courses", "toggleCourseItem", ["temp-123", true]);
    ajouter("notes", "toggleNoteItem", ["n1", true]);

    expect(await flushQueue()).toEqual({ synced: 1, abandoned: 1, restantes: 0 });
    expect(toggleCourseItem).not.toHaveBeenCalled();
  });

  it("supprime sans bruit une action dont le module ou le nom est inconnu", async () => {
    ajouter("inconnu", "nimporte", []);
    ajouter("taches", "actionDisparue", []);

    expect(await flushQueue()).toEqual({ synced: 0, abandoned: 0, restantes: 0 });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("pluralise le message d'abandon", async () => {
    ajouter("taches", "setTacheFait", ["t1", true], 2);
    ajouter("taches", "deleteTache", ["t2"], 2);
    vi.mocked(setTacheFait).mockRejectedValue(new Error("ko"));
    vi.mocked(deleteTache).mockRejectedValue(new Error("ko"));

    expect(await flushQueue()).toMatchObject({ abandoned: 2 });
    expect(showToast).toHaveBeenCalledWith("2 actions hors ligne n'ont pas pu être synchronisées et ont été abandonnées.", 5000);
  });

  it("signale qu'il reste des actions quand un rejeu est déjà en cours", async () => {
    ajouter("taches", "setTacheFait", ["t1", true]);
    let liberer: () => void = () => {};
    vi.mocked(setTacheFait).mockImplementation(() => new Promise<void>((r) => (liberer = r)));

    const premier = flushQueue();
    await vi.waitFor(() => expect(setTacheFait).toHaveBeenCalled());
    expect(await flushQueue()).toEqual({ synced: 0, abandoned: 0, restantes: 1 });

    liberer();
    expect(await premier).toMatchObject({ synced: 1 });
  });
});
