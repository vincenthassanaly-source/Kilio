// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), updateTag: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath, updateTag: etat.updateTag }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  creerHabitude,
  enregistrerEntreeHabitude,
  getHabitudesDuJour,
  getHistoriqueHabitude,
  modifierHabitude,
  supprimerHabitude,
} from "./habitudes";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function form(champs: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creerHabitude", () => {
  it.each([
    ["nom vide", { nom: " ", type: "boolean" }, "Le nom est requis."],
    ["type inconnu", { nom: "Lire", type: "autre" }, "Type d'habitude invalide."],
    ["objectif négatif", { nom: "Eau", type: "quantifiee", valeur_cible: "-2" }, "L'objectif doit être un nombre positif."],
    ["objectif non numérique", { nom: "Eau", type: "quantifiee", valeur_cible: "beaucoup" }, "L'objectif doit être un nombre positif."],
    ["fréquence 7", { nom: "Lire", type: "boolean", frequence_hebdo: "7" }, "La fréquence doit être un nombre de 1 à 6 fois par semaine."],
    ["fréquence décimale", { nom: "Lire", type: "boolean", frequence_hebdo: "2.5" }, "La fréquence doit être un nombre de 1 à 6 fois par semaine."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await creerHabitude({ error: null }, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });

  it("insère à la suite des habitudes existantes avec unité et cible d'une quantifiée", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { ordre: 3 } } : undefined));

    const res = await creerHabitude(
      { error: null },
      form({ nom: " Eau ", type: "quantifiee", unite: "L", valeur_cible: "2", icone: "💧", frequence_hebdo: "5" })
    );

    expect(res).toEqual({ error: null });
    expect(ecritures(fake.appels, "habitudes", "insert")[0].payload).toEqual({
      nom: "Eau",
      type: "quantifiee",
      frequence_hebdo: 5,
      unite: "L",
      valeur_cible: 2,
      icone: "💧",
      ordre: 4,
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/habitudes");
    expect(etat.updateTag).toHaveBeenCalledWith("habitudes");
  });

  it("ignore unité et cible pour une habitude non quantifiée et démarre l'ordre à 0", async () => {
    const fake = brancher();
    await creerHabitude({ error: null }, form({ nom: "Lire", type: "boolean", unite: "pages", valeur_cible: "10" }));
    expect(ecritures(fake.appels, "habitudes", "insert")[0].payload).toMatchObject({
      unite: null,
      valeur_cible: null,
      icone: null,
      frequence_hebdo: null,
      ordre: 0,
    });
  });

  it("renvoie l'erreur Supabase sans expirer le cache", async () => {
    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await creerHabitude({ error: null }, form({ nom: "Lire", type: "boolean" }))).toEqual({ error: "ko" });
    expect(etat.updateTag).not.toHaveBeenCalled();
  });
});

describe("modifierHabitude", () => {
  it("refuse sans id ou avec une saisie invalide", async () => {
    brancher();
    expect(await modifierHabitude({ error: null }, form({ nom: "x", type: "boolean" }))).toEqual({ error: "Habitude introuvable." });
    expect(await modifierHabitude({ error: null }, form({ id: ID, nom: "", type: "boolean" }))).toEqual({ error: "Le nom est requis." });
  });

  it("met à jour la ligne ciblée", async () => {
    const fake = brancher();
    expect(await modifierHabitude({ error: null }, form({ id: ID, nom: "Lire", type: "streak" }))).toEqual({ error: null });
    const [maj] = ecritures(fake.appels, "habitudes", "update");
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
    expect(maj.payload).toMatchObject({ nom: "Lire", type: "streak" });
    expect(etat.updateTag).toHaveBeenCalledWith("habitudes");
  });

  it("renvoie l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await modifierHabitude({ error: null }, form({ id: ID, nom: "Lire", type: "boolean" }))).toEqual({ error: "ko" });
  });
});

describe("supprimerHabitude", () => {
  it("archive (actif=false, date du jour) au lieu de supprimer l'historique", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    const fake = brancher();

    await supprimerHabitude(ID);

    expect(ecritures(fake.appels, "habitudes", "delete")).toHaveLength(0);
    expect(ecritures(fake.appels, "habitudes", "update")[0].payload).toEqual({ actif: false, archivee_le: "2026-10-09" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/objectifs");
    expect(etat.updateTag).toHaveBeenCalledWith("habitudes");
  });

  it("lève l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(supprimerHabitude(ID)).rejects.toThrow("ko");
  });
});

describe("enregistrerEntreeHabitude", () => {
  it.each([[-1], [NaN], [Infinity]])("refuse la valeur %s sans écrire", async (valeur) => {
    const fake = brancher();
    await expect(enregistrerEntreeHabitude(ID, "2026-10-09", valeur)).rejects.toThrow("Valeur invalide.");
    expect(fake.appels).toHaveLength(0);
  });

  it("enregistre (upsert) une valeur, zéro compris", async () => {
    const fake = brancher();
    await enregistrerEntreeHabitude(ID, "2026-10-09", 0);
    expect(ecritures(fake.appels, "habitude_entries", "upsert")[0].payload).toEqual({
      habitude_id: ID,
      date: "2026-10-09",
      valeur: 0,
    });
    expect(etat.updateTag).toHaveBeenCalledWith("habitudes");
  });

  it("lève l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(enregistrerEntreeHabitude(ID, "2026-10-09", 1)).rejects.toThrow("ko");
  });
});

describe("getHabitudesDuJour", () => {
  const date = "2026-10-09"; // vendredi : lundi de la semaine = 2026-10-05

  const base = { actif: true, valeur_cible: null, frequence_hebdo: null };

  it("renvoie [] sans habitude active et sans lire les entrées", async () => {
    const fake = brancher((a) => (a.table === "habitudes" ? { data: [] } : undefined));
    expect(await getHabitudesDuJour(date)).toEqual([]);
    expect(fake.appels.map((a) => a.table)).toEqual(["habitudes"]);
  });

  it("calcule série, entrée du jour et objectifs en cours uniquement", async () => {
    const fake = brancher((a) => {
      if (a.table === "habitudes") {
        return { data: [{ ...base, id: ID, type: "streak" }, { ...base, id: ID2, type: "boolean" }] };
      }
      if (a.table === "habitude_entries") {
        return {
          data: [
            { habitude_id: ID, date: "2026-10-09", valeur: 1 },
            { habitude_id: ID, date: "2026-10-08", valeur: 1 },
            { habitude_id: ID, date: "2026-10-06", valeur: 1 },
          ],
        };
      }
      if (a.table === "objectif_habitudes") {
        return {
          data: [
            { habitude_id: ID, objectifs: { id: "o1", titre: "Lire plus", statut: "en_cours" } },
            { habitude_id: ID, objectifs: { id: "o2", titre: "Ancien", statut: "atteint" } },
            { habitude_id: ID2, objectifs: null },
          ],
        };
      }
      return undefined;
    });

    const res = await getHabitudesDuJour(date);

    const [streak, simple] = res;
    expect(streak.streak).toBe(2); // 9 et 8 ; le 7 manque
    expect(streak.entreeDuJour).toMatchObject({ date: "2026-10-09", valeur: 1 });
    expect(streak.objectifs).toEqual([{ id: "o1", titre: "Lire plus" }]);
    expect(simple.streak).toBe(0);
    expect(simple.entreeDuJour).toBeNull();
    expect(simple.objectifs).toEqual([]);

    // Une série réclame un an d'historique.
    const lectureEntrees = fake.appels.find((a) => a.table === "habitude_entries")!;
    expect(lectureEntrees.filtres).toContainEqual(["gte", "date", "2025-10-09"]);
  });

  it("ne lit que le jour demandé quand aucune habitude n'a besoin d'historique", async () => {
    const fake = brancher((a) => (a.table === "habitudes" ? { data: [{ ...base, id: ID, type: "boolean" }] } : { data: [] }));
    await getHabitudesDuJour(date);
    const lectureEntrees = fake.appels.find((a) => a.table === "habitude_entries")!;
    expect(lectureEntrees.filtres).toContainEqual(["gte", "date", date]);
  });

  it("compte les jours faits depuis lundi pour une habitude à fréquence hebdomadaire", async () => {
    brancher((a) => {
      if (a.table === "habitudes") return { data: [{ ...base, id: ID, type: "boolean", frequence_hebdo: 3 }] };
      if (a.table === "habitude_entries") {
        return {
          data: [
            { habitude_id: ID, date: "2026-10-04", valeur: 1 }, // dimanche précédent : hors semaine
            { habitude_id: ID, date: "2026-10-05", valeur: 1 },
            { habitude_id: ID, date: "2026-10-07", valeur: 1 },
            { habitude_id: ID, date: "2026-10-08", valeur: 0 }, // zéro : pas fait
          ],
        };
      }
      return { data: [] };
    });

    const [h] = await getHabitudesDuJour(date);
    expect(h.faitsCetteSemaine).toBe(2);
  });

  it("lève les erreurs de lecture", async () => {
    brancher((a) => (a.table === "habitudes" ? { error: { message: "habitudes ko" } } : undefined));
    await expect(getHabitudesDuJour(date)).rejects.toThrow("habitudes ko");

    brancher((a) =>
      a.table === "habitudes"
        ? { data: [{ ...base, id: ID, type: "boolean" }] }
        : a.table === "habitude_entries"
          ? { error: { message: "entrées ko" } }
          : undefined
    );
    await expect(getHabitudesDuJour(date)).rejects.toThrow("entrées ko");

    brancher((a) =>
      a.table === "habitudes"
        ? { data: [{ ...base, id: ID, type: "boolean" }] }
        : a.table === "objectif_habitudes"
          ? { error: { message: "liens ko" } }
          : undefined
    );
    await expect(getHabitudesDuJour(date)).rejects.toThrow("liens ko");
  });
});

describe("getHistoriqueHabitude", () => {
  it("lit les entrées du mois triées par date", async () => {
    const fake = brancher(() => ({ data: [{ date: "2026-10-01" }] }));
    expect(await getHistoriqueHabitude(ID, "2026-10-01", "2026-10-31")).toEqual([{ date: "2026-10-01" }]);
    expect(fake.appels[0].filtres).toEqual([
      ["eq", "habitude_id", ID],
      ["gte", "date", "2026-10-01"],
      ["lte", "date", "2026-10-31"],
    ]);
  });

  it("renvoie [] sans données et lève sur erreur", async () => {
    brancher();
    expect(await getHistoriqueHabitude(ID, "2026-10-01", "2026-10-31")).toEqual([]);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getHistoriqueHabitude(ID, "2026-10-01", "2026-10-31")).rejects.toThrow("ko");
  });
});
