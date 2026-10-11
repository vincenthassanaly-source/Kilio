// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ecritures, fauxSupabase, type Appel, type Reponse } from "@/test/fake-supabase";
import { commencerSeance, decalerSeance, lireSemaine } from "./serveur";

// Semaine du lundi 2026-10-12 au dimanche 2026-10-18.
const ligne = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  creneau_id: id,
  date_prevue: date,
  date,
  heure: "18:00:00",
  type: "Renfo",
  statut: "prevue",
  reportee: false,
  ...extra,
});

const creneauLundi = { id: "c1", jour_semaine: 1, heure: "18:00:00", type: "Renfo", actif: true };

describe("lireSemaine", () => {
  it("crée les occurrences manquantes de la semaine, une seule fois", async () => {
    let lectures = 0;
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "creneaux_seance") return { data: [creneauLundi] };
      if (a.table === "seances" && a.action === "select") {
        lectures++;
        return { data: lectures === 1 ? [] : [ligne("c1", "2026-10-12")] };
      }
      return undefined;
    });

    const semaine = await lireSemaine(fake.client as never, "2026-10-12", "09:00");

    const [upsert] = ecritures(fake.appels, "seances", "upsert");
    expect(upsert.payload).toEqual([
      { creneau_id: "c1", date_prevue: "2026-10-12", date: "2026-10-12", heure: "18:00:00", type: "Renfo" },
    ]);
    expect(semaine.seances.map((s) => s.id)).toEqual(["c1"]);
    expect(ecritures(fake.appels, "seances", "update")).toHaveLength(0);
  });

  it("replace une séance manquée sur un jour libre, sans la recréer", async () => {
    let lectures = 0;
    const fake = fauxSupabase((a: Appel): Reponse | undefined => {
      if (a.table === "creneaux_seance") return { data: [creneauLundi] };
      if (a.table === "seances" && a.action === "select") {
        lectures++;
        return { data: [ligne("c1", "2026-10-12", lectures > 1 ? { date: "2026-10-14", reportee: true } : {})] };
      }
      return undefined;
    });

    // Mercredi matin : le créneau de lundi est passé, la séance de lundi est manquée.
    const semaine = await lireSemaine(fake.client as never, "2026-10-14", "08:00");

    expect(ecritures(fake.appels, "seances", "upsert")).toHaveLength(0);
    const [maj] = ecritures(fake.appels, "seances", "update");
    expect(maj.payload).toEqual({ date: "2026-10-14", reportee: true, rappel_envoye_le: null });
    expect(maj.filtres).toContainEqual(["eq", "id", "c1"]);
    expect(semaine.seances[0]).toMatchObject({ date: "2026-10-14", reportee: true });
  });

  it("lève l'erreur de lecture des créneaux", async () => {
    const fake = fauxSupabase((a) => (a.table === "creneaux_seance" ? { error: { message: "ko" } } : undefined));
    await expect(lireSemaine(fake.client as never, "2026-10-12", "09:00")).rejects.toThrow("ko");
  });
});

describe("decalerSeance", () => {
  function brancher(seance: Record<string, unknown> | null, semaine: Record<string, unknown>[]) {
    return fauxSupabase((a) => {
      if (a.table !== "seances" || a.action !== "select") return undefined;
      return a.terminal === "maybeSingle" ? { data: seance } : { data: semaine };
    });
  }

  it("décale au prochain jour libre de la semaine", async () => {
    const mardi = ligne("a", "2026-10-13");
    const fake = brancher(mardi, [mardi, ligne("b", "2026-10-14")]);

    expect(await decalerSeance(fake.client as never, "a", "2026-10-13")).toEqual({ error: null, date: "2026-10-15" });
    const [maj] = ecritures(fake.appels, "seances", "update");
    expect(maj.payload).toEqual({ date: "2026-10-15", reportee: true, rappel_envoye_le: null });
  });

  it("ne replace jamais une séance manquée dans le passé", async () => {
    const lundi = ligne("a", "2026-10-12");
    const fake = brancher(lundi, [lundi]);

    expect(await decalerSeance(fake.client as never, "a", "2026-10-14")).toEqual({ error: null, date: "2026-10-14" });
  });

  it("refuse une séance déjà faite, introuvable, ou sans jour libre", async () => {
    const faite = ligne("a", "2026-10-13", { statut: "faite" });
    expect(await decalerSeance(brancher(faite, [faite]).client as never, "a", "2026-10-13")).toEqual({
      error: "Cette séance est déjà faite.",
    });
    expect(await decalerSeance(brancher(null, []).client as never, "a", "2026-10-13")).toEqual({
      error: "Séance introuvable.",
    });
    const dimanche = ligne("a", "2026-10-18");
    expect(await decalerSeance(brancher(dimanche, [dimanche]).client as never, "a", "2026-10-18")).toEqual({
      error: "Aucun jour libre d'ici dimanche.",
    });
  });
});

describe("commencerSeance", () => {
  it("coche la séance et fait du jour un jour d'entraînement", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "seances" && a.action === "select" ? { data: { date: "2026-10-14", statut: "prevue" } } : undefined
    );
    expect(await commencerSeance(fake.client as never, "a")).toEqual({ error: null, date: "2026-10-14" });
    expect(ecritures(fake.appels, "seances", "update")[0].payload).toEqual({ statut: "faite" });
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")[0].payload).toMatchObject({
      date: "2026-10-14",
      entraine: true,
    });
  });

  it("séance déjà faite : refus sans écriture", async () => {
    const fake = fauxSupabase((a: Appel): Reponse | undefined =>
      a.table === "seances" && a.action === "select" ? { data: { date: "2026-10-14", statut: "faite" } } : undefined
    );
    expect(await commencerSeance(fake.client as never, "a")).toEqual({ error: "Cette séance est déjà faite." });
    expect(ecritures(fake.appels, "seances")).toHaveLength(0);
  });

  it("séance introuvable : refus sans écriture", async () => {
    const fake = fauxSupabase();
    expect(await commencerSeance(fake.client as never, "a")).toEqual({ error: "Séance introuvable." });
    expect(ecritures(fake.appels, "seances")).toHaveLength(0);
  });
});
