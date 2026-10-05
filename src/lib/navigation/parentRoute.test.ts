import { describe, expect, it } from "vitest";
import { parentRoute, retourHistoriqueAutorise } from "./parentRoute";

const BARRE = ["/", "/nutrition", "/taches", "/habitudes"];

describe("parentRoute", () => {
  it("n'a pas de parent pour l'accueil", () => {
    expect(parentRoute("/", BARRE)).toBeNull();
  });

  it("ramène /plus à l'accueil", () => {
    expect(parentRoute("/plus", BARRE)).toBe("/");
  });

  it("ramène un module épinglé à l'accueil", () => {
    expect(parentRoute("/taches", BARRE)).toBe("/");
  });

  it("ramène un module non épinglé à la grille Plus", () => {
    expect(parentRoute("/courses", BARRE)).toBe("/plus");
    expect(parentRoute("/objectifs", BARRE)).toBe("/plus");
  });

  it("suit l'épinglage personnalisé", () => {
    expect(parentRoute("/courses", ["/", "/courses", "/taches", "/habitudes"])).toBe("/");
  });

  it("remonte une sous-page d'un segment", () => {
    expect(parentRoute("/nutrition/recettes/abc", BARRE)).toBe("/nutrition/recettes");
    expect(parentRoute("/nutrition/recettes", BARRE)).toBe("/nutrition");
    expect(parentRoute("/objectifs/abc", BARRE)).toBe("/objectifs");
    expect(parentRoute("/pharmacie/m1/c1", BARRE)).toBe("/pharmacie/m1");
  });

  it("ramène une fiche du référentiel pharmacie à l'accueil du référentiel", () => {
    expect(parentRoute("/pharmacie/referentiel/medicament/abc", BARRE)).toBe("/pharmacie/referentiel");
    expect(parentRoute("/pharmacie/referentiel/classe/abc", BARRE)).toBe("/pharmacie/referentiel");
    expect(parentRoute("/pharmacie/referentiel/pathologie/abc", BARRE)).toBe("/pharmacie/referentiel");
    expect(parentRoute("/pharmacie/referentiel", BARRE)).toBe("/pharmacie");
  });

  it("ignore le slash final et retombe sur l'accueil pour une route inconnue", () => {
    expect(parentRoute("/taches/", BARRE)).toBe("/");
    expect(parentRoute("/inconnu/x", BARRE)).toBe("/");
  });
});

describe("retourHistoriqueAutorise", () => {
  const classe = "/pharmacie/referentiel/classe/c1";
  const pathologie = "/pharmacie/referentiel/pathologie/p1";
  const accueil = "/pharmacie/referentiel";

  it("laisse revenir d'une fiche vers la fiche d'où l'on vient", () => {
    expect(retourHistoriqueAutorise(classe, pathologie)).toBe(true);
    expect(retourHistoriqueAutorise("/pharmacie/referentiel/medicament/m1", classe)).toBe(true);
  });

  it("laisse revenir d'une fiche vers l'accueil du référentiel", () => {
    expect(retourHistoriqueAutorise(classe, accueil)).toBe(true);
    expect(retourHistoriqueAutorise(classe, `${accueil}/`)).toBe(true);
  });

  it("ne s'applique pas hors du référentiel ni depuis l'accueil", () => {
    expect(retourHistoriqueAutorise(classe, "/pharmacie")).toBe(false);
    expect(retourHistoriqueAutorise(classe, "/plus")).toBe(false);
    expect(retourHistoriqueAutorise(accueil, "/pharmacie")).toBe(false);
    expect(retourHistoriqueAutorise("/nutrition/recettes/abc", classe)).toBe(false);
  });

  it("ignore une arrivée sur la même fiche", () => {
    expect(retourHistoriqueAutorise(classe, classe)).toBe(false);
  });
});

describe("retourHistoriqueAutorise : Journal ouvert depuis le Bilan", () => {
  it("ramène au Bilan quand le Journal porte from=bilan", () => {
    expect(retourHistoriqueAutorise("/nutrition/journal", "/nutrition/bilan", "?date=2026-10-02&from=bilan")).toBe(true);
    expect(retourHistoriqueAutorise("/nutrition/journal/", "/nutrition/bilan", "?from=bilan")).toBe(true);
  });

  it("garde le retour vers l'accueil Nutrition sans from=bilan", () => {
    expect(retourHistoriqueAutorise("/nutrition/journal", "/nutrition/bilan", "?date=2026-10-02")).toBe(false);
    expect(retourHistoriqueAutorise("/nutrition/journal", "/nutrition/bilan")).toBe(false);
  });

  it("ne s'applique qu'au retour vers le Bilan", () => {
    expect(retourHistoriqueAutorise("/nutrition/journal", "/nutrition", "?from=bilan")).toBe(false);
    expect(retourHistoriqueAutorise("/nutrition/recettes", "/nutrition/bilan", "?from=bilan")).toBe(false);
  });
});
