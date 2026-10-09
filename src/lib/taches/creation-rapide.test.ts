import { describe, expect, it, vi } from "vitest";
import { creerTacheRapide } from "./creation-rapide";

type Reponse = { data: unknown; error: { message: string } | null };

// Faux client Supabase : chaque appel terminal (maybeSingle / single) consomme
// la réponse suivante, dans l'ordre des requêtes de creerTacheRapide
// (liste, dernière tâche, insertion). Les appels de chaîne renvoient le même
// constructeur.
function fauxClient(reponses: Reponse[]) {
  const insert = vi.fn();
  const eq = vi.fn();
  const file = [...reponses];
  const suivante = () => Promise.resolve(file.shift() ?? { data: null, error: null });
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit"]) builder[m] = vi.fn(() => builder);
  builder.eq = eq.mockImplementation(() => builder);
  builder.insert = insert.mockImplementation(() => builder);
  builder.maybeSingle = vi.fn(suivante);
  builder.single = vi.fn(suivante);
  const client = { from: vi.fn(() => builder) };
  return { client: client as never, insert, eq, from: client.from };
}

describe("creerTacheRapide", () => {
  it("refuse un titre vide sans interroger la base", async () => {
    const { client, from } = fauxClient([]);
    expect(await creerTacheRapide(client, { titre: "   " })).toEqual({ ok: false, error: "Le titre est requis." });
    expect(from).not.toHaveBeenCalled();
  });

  it("remonte l'erreur de lecture de la liste", async () => {
    const { client } = fauxClient([{ data: null, error: { message: "boom" } }]);
    expect(await creerTacheRapide(client, { titre: "a" })).toEqual({ ok: false, error: "boom" });
  });

  it("demande de créer une liste quand il n'y en a aucune", async () => {
    const { client } = fauxClient([{ data: null, error: null }]);
    expect(await creerTacheRapide(client, { titre: "a" })).toEqual({
      ok: false,
      error: "Crée d'abord une liste de tâches.",
    });
  });

  it("insère en fin de liste avec titre et notes nettoyés", async () => {
    const { client, insert, eq } = fauxClient([
      { data: { id: "L1" }, error: null },
      { data: { ordre: 4 }, error: null },
      { data: { id: "T9" }, error: null },
    ]);
    const res = await creerTacheRapide(client, { titre: "  Appeler  ", notes: "  détail  ", note_id: "N1" });

    expect(res).toEqual({ ok: true, id: "T9" });
    expect(eq).toHaveBeenCalledWith("liste_id", "L1");
    expect(insert).toHaveBeenCalledWith({
      titre: "Appeler",
      notes: "détail",
      note_id: "N1",
      liste_id: "L1",
      ordre: 5,
    });
  });

  it("commence à l'ordre 0 dans une liste vide et met notes et note_id à null", async () => {
    const { client, insert } = fauxClient([
      { data: { id: "L1" }, error: null },
      { data: null, error: null },
      { data: { id: "T1" }, error: null },
    ]);
    await creerTacheRapide(client, { titre: "x", notes: "   " });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ordre: 0, notes: null, note_id: null }));
  });

  it("remonte l'erreur d'insertion", async () => {
    const { client } = fauxClient([
      { data: { id: "L1" }, error: null },
      { data: null, error: null },
      { data: null, error: { message: "insert ko" } },
    ]);
    expect(await creerTacheRapide(client, { titre: "x" })).toEqual({ ok: false, error: "insert ko" });
  });
});
