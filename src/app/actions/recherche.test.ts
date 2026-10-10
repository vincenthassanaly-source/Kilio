// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase, type Appel, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { rechercheGlobale } from "./recherche";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

const parTable =
  (donnees: Record<string, unknown[]>): Repondre =>
  (a: Appel) =>
    donnees[a.table] ? { data: donnees[a.table] } : undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rechercheGlobale", () => {
  it.each([[""], ["a"], [" a "], ["   "]])("renvoie [] sans interroger la base pour %j", async (query) => {
    const fake = brancher();
    expect(await rechercheGlobale(query)).toEqual([]);
    expect(fake.appels).toHaveLength(0);
  });

  it("interroge les sept sources avec un motif « contient » échappé, limité à 5 résultats", async () => {
    const fake = brancher();
    await rechercheGlobale("  50%_  ");

    expect(fake.appels.map((a) => a.table).sort()).toEqual(
      ["courses_items", "evenements", "note_items", "notes", "objectifs", "recettes", "taches"].sort()
    );
    const taches = fake.appels.find((a) => a.table === "taches")!;
    expect(taches.filtres).toContainEqual(["ilike", "titre", "%50\\%\\_%"]);
    const notes = fake.appels.find((a) => a.table === "notes")!;
    expect(notes.filtres[0][0]).toBe("or");
    // Entre guillemets PostgREST, l'antislash est doublé (décodé en `\` côté serveur).
    expect(String(notes.filtres[0][1])).toBe('titre.ilike."%50\\\\%\\\\_%",contenu.ilike."%50\\\\%\\\\_%"');
    for (const appel of fake.appels) expect(appel.modificateurs).toContainEqual(["limit", 5]);
  });

  it("construit un résultat par module avec le bon lien", async () => {
    brancher(
      parTable({
        notes: [{ id: "n1", titre: "Idées", contenu: "voyage" }],
        taches: [
          { id: "t1", titre: "Voyage dentiste", echeance: "2026-10-12", liste: { nom: "Santé" } },
          { id: "t2", titre: "Voyage sans date", echeance: null, liste: null },
        ],
        evenements: [{ id: "e1", titre: "Voyage Rome", date: "2026-10-20", heure: "09:30:00" }],
        recettes: [{ id: "r1", nom: "Voyage au Maroc" }],
        objectifs: [{ id: "o1", titre: "Voyager plus" }],
        courses_items: [{ id: "c1", libelle: "Valise voyage" }],
      })
    );

    const res = await rechercheGlobale("voy");
    const par = (id: string) => res.find((r) => r.id === id)!;

    expect(par("n1")).toEqual({ id: "n1", module: "notes", titre: "Idées", sousTitre: "voyage", href: "/notes" });
    expect(par("t1")).toEqual({ id: "t1", module: "taches", titre: "Voyage dentiste", sousTitre: "Santé", href: "/agenda?tache=t1" });
    expect(par("t2")).toMatchObject({ href: "/taches", sousTitre: undefined });
    expect(par("e1")).toEqual({ id: "e1", module: "evenements", titre: "Voyage Rome", sousTitre: "2026-10-20 09:30", href: "/agenda?date=2026-10-20" });
    expect(par("r1")).toMatchObject({ module: "recettes", href: "/nutrition/recettes/r1" });
    expect(par("o1")).toMatchObject({ module: "objectifs", href: "/objectifs/o1" });
    expect(par("c1")).toMatchObject({ module: "courses", href: "/courses" });
  });

  it("met une note sans contenu sans sous-titre", async () => {
    brancher(parTable({ notes: [{ id: "n1", titre: "Vide", contenu: "" }] }));
    const [note] = await rechercheGlobale("vi");
    expect(note.sousTitre).toBeUndefined();
  });

  it("ajoute une note trouvée par un élément de checklist, une seule fois et jamais en doublon d'une note déjà trouvée", async () => {
    brancher(
      parTable({
        notes: [{ id: "n1", titre: "Courses lait", contenu: "" }],
        note_items: [
          { note_id: "n1", libelle: "lait", note: { titre: "Courses lait" } },
          { note_id: "n2", libelle: "lait entier", note: { titre: "Frigo" } },
          { note_id: "n2", libelle: "lait écrémé", note: { titre: "Frigo" } },
          { note_id: "n3", libelle: "lait de coco", note: null },
        ],
      })
    );

    const res = await rechercheGlobale("lait");

    expect(res.filter((r) => r.module === "notes").map((r) => [r.id, r.titre, r.sousTitre])).toEqual([
      ["n1", "Courses lait", undefined],
      ["n2", "Frigo", "lait entier"],
      ["n3", "Note", "lait de coco"],
    ]);
  });

  it("place d'abord les titres qui commencent par la recherche, sans tenir compte de la casse", async () => {
    brancher(
      parTable({
        taches: [
          { id: "t1", titre: "Acheter du pain", echeance: null, liste: null },
          { id: "t2", titre: "PAIN complet", echeance: null, liste: null },
        ],
        recettes: [{ id: "r1", nom: "Gratin de pain" }, { id: "r2", nom: "Pain perdu" }],
      })
    );

    const res = await rechercheGlobale("pain");

    expect(res.map((r) => r.id)).toEqual(["t2", "r2", "t1", "r1"]);
  });

  it("une source en erreur ou sans données n'empêche pas les autres", async () => {
    brancher((a) => {
      if (a.table === "notes") throw new Error("réseau coupé");
      if (a.table === "taches") return { error: { message: "ko" } };
      if (a.table === "recettes") return { data: [{ id: "r1", nom: "Pain perdu" }] };
      return undefined;
    });

    expect(await rechercheGlobale("pain")).toEqual([
      { id: "r1", module: "recettes", titre: "Pain perdu", href: "/nutrition/recettes/r1" },
    ]);
  });
});
