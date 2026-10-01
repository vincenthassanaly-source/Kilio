import { describe, expect, it } from "vitest";
import { NB_TEINTES_CLASSE, styleClasse, teinteDeClasse } from "./couleurClasse";
import type { PharmaRefSnapshot } from "./referentiel";

const classe = (id: string, parent_id: string | null, ordre: number) => ({ id, parent_id, ordre, nom: id });
const snap = {
  classes: [classe("a", null, 1), classe("b", null, 2), classe("a1", "a", 1), classe("a11", "a1", 1)],
} as unknown as PharmaRefSnapshot;
const par = (id: string) => snap.classes.find((c) => c.id === id);

describe("teinteDeClasse", () => {
  it("donne une teinte distincte à chaque racine", () => {
    expect(teinteDeClasse(snap, par("a"))).toBe(1);
    expect(teinteDeClasse(snap, par("b"))).toBe(2);
  });

  it("fait hériter les sous-classes de la teinte de leur racine", () => {
    expect(teinteDeClasse(snap, par("a1"))).toBe(1);
    expect(teinteDeClasse(snap, par("a11"))).toBe(1);
  });

  it("retombe sur la première teinte sans classe", () => {
    expect(teinteDeClasse(snap, undefined)).toBe(1);
  });

  it("reboucle au-delà du nombre de teintes", () => {
    const racines = Array.from({ length: NB_TEINTES_CLASSE + 1 }, (_, i) => classe(`r${i}`, null, i));
    const grand = { classes: racines } as unknown as PharmaRefSnapshot;
    expect(teinteDeClasse(grand, racines[NB_TEINTES_CLASSE] as never)).toBe(1);
  });

  it("expose la variable CSS --classe", () => {
    expect(styleClasse(snap, par("b"))).toEqual({ "--classe": "var(--classe-2)" });
  });
});
