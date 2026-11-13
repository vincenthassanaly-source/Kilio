import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single }) }) }) }),
}));

import { lireSaisieRepas } from "./saisie-repas";
import { QUANTITE_MAX_ALIMENT, QUANTITE_MAX_PORTIONS } from "./compute";

function formulaire(champs: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) formData.set(cle, valeur);
  return formData;
}

const aliment = (quantite: string, mode = "grammes") =>
  formulaire({ type: "aliment", aliment_id: "a1", quantite, saisie_mode: mode, date: "2026-11-13", moment: "dejeuner" });
const recette = (quantite: string) =>
  formulaire({ type: "recette", recette_id: "r1", quantite, saisie_mode: "grammes", date: "2026-11-13", moment: "diner" });

beforeEach(() => single.mockReset());

describe("lireSaisieRepas : plafonds de quantité", () => {
  it("accepte un aliment au plafond", async () => {
    const resultat = await lireSaisieRepas(aliment(String(QUANTITE_MAX_ALIMENT)));
    expect(resultat).toMatchObject({ saisie: { quantite: QUANTITE_MAX_ALIMENT } });
  });

  it("refuse un aliment au-dessus du plafond (99999 g)", async () => {
    const resultat = await lireSaisieRepas(aliment("99999"));
    expect(resultat).toHaveProperty("error");
    expect((resultat as { error: string }).error).toContain("g ou ml");
  });

  it("refuse un aliment à 5001 g, juste au-dessus", async () => {
    expect(await lireSaisieRepas(aliment(String(QUANTITE_MAX_ALIMENT + 1)))).toHaveProperty("error");
  });

  it("accepte une recette au plafond de portions et refuse au-delà", async () => {
    expect(await lireSaisieRepas(recette(String(QUANTITE_MAX_PORTIONS)))).toMatchObject({ saisie: { quantite: QUANTITE_MAX_PORTIONS } });
    const refus = await lireSaisieRepas(recette(String(QUANTITE_MAX_PORTIONS + 1)));
    expect((refus as { error: string }).error).toContain("portions");
  });

  it("applique le plafond après conversion des pièces en grammes", async () => {
    single.mockResolvedValue({ data: { poids_unite_g: 200 }, error: null });
    // 25 pièces × 200 g = 5000 g : accepté ; 26 pièces = 5200 g : refusé.
    expect(await lireSaisieRepas(aliment("25", "piece"))).toMatchObject({ saisie: { quantite: 5000 } });
    expect(await lireSaisieRepas(aliment("26", "piece"))).toHaveProperty("error");
  });

  it("garde le refus existant pour une quantité nulle ou négative", async () => {
    expect(await lireSaisieRepas(aliment("0"))).toHaveProperty("error");
    expect(await lireSaisieRepas(aliment("-5"))).toHaveProperty("error");
  });
});
