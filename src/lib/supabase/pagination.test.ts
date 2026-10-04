import { describe, expect, it } from "vitest";
import { fetchAllRows } from "./pagination";

const ligne = (n: number) => ({ n });

describe("fetchAllRows", () => {
  it("enchaîne les pages jusqu'à une page incomplète", async () => {
    const appels: Array<[number, number]> = [];
    const rows = await fetchAllRows<{ n: number }>(async (from, to) => {
      appels.push([from, to]);
      const total = 5;
      const data = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => ligne(from + i));
      return { data, error: null };
    }, 2);

    expect(rows.map((r) => r.n)).toEqual([0, 1, 2, 3, 4]);
    expect(appels).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("fait un dernier appel quand le total est un multiple exact de la page", async () => {
    let appels = 0;
    const rows = await fetchAllRows<{ n: number }>(async (from) => {
      appels++;
      return { data: from < 4 ? [ligne(from), ligne(from + 1)] : [], error: null };
    }, 2);

    expect(rows).toHaveLength(4);
    expect(appels).toBe(3);
  });

  it("tolère data null et lève l'erreur Supabase", async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: null }))).resolves.toEqual([]);
    await expect(fetchAllRows(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});
