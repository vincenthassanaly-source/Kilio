import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { restaurerElement } from "./rollback";

type Ligne = { id: string; fait: boolean };
const KEY = ["lignes"] as const;

function client(courant: Ligne[]) {
  const qc = new QueryClient();
  qc.setQueryData(KEY, courant);
  return qc;
}

describe("restaurerElement", () => {
  it("ne remet que la ligne en échec et garde les autres mises à jour optimistes", () => {
    const avant: Ligne[] = [{ id: "a", fait: false }, { id: "b", fait: false }];
    // a et b cochés de façon optimiste ; seule la coche de a échoue.
    const qc = client([{ id: "a", fait: true }, { id: "b", fait: true }]);

    restaurerElement(qc, KEY, avant, "a");

    expect(qc.getQueryData(KEY)).toEqual([{ id: "a", fait: false }, { id: "b", fait: true }]);
  });

  it("réinsère à sa place une ligne retirée de façon optimiste", () => {
    const avant: Ligne[] = [{ id: "a", fait: false }, { id: "b", fait: false }, { id: "c", fait: false }];
    const qc = client([{ id: "a", fait: false }, { id: "c", fait: false }]);

    restaurerElement(qc, KEY, avant, "b");

    expect(qc.getQueryData(KEY)).toEqual(avant);
  });

  it("ne fait rien sans instantané", () => {
    const qc = client([{ id: "a", fait: true }]);
    restaurerElement(qc, KEY, undefined, "a");
    expect(qc.getQueryData(KEY)).toEqual([{ id: "a", fait: true }]);
  });
});
