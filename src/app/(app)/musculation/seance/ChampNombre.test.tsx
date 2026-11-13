import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChampNombre } from "./ChampNombre";
import { LIMITES_CHAMP } from "@/lib/musculation/constantes";

afterEach(cleanup);

describe("ChampNombre : bornes de saisie", () => {
  it("ignore une frappe qui dépasserait le plafond", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChampNombre valeur={null} entier signe={false} libelle="Répétitions" max={LIMITES_CHAMP.reps.max} onChange={onChange} />);

    const champ = screen.getByLabelText("Répétitions");
    await user.type(champ, "99999");

    // 999 passe, 9999 dépasse 1000 : les frappes suivantes sont ignorées.
    expect(champ).toHaveValue("999");
    expect(onChange).toHaveBeenLastCalledWith(999);
  });

  it("accepte exactement le plafond", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChampNombre valeur={null} entier signe={false} libelle="Répétitions" max={LIMITES_CHAMP.reps.max} onChange={onChange} />);

    const champ = screen.getByLabelText("Répétitions");
    await user.type(champ, "1000");

    expect(champ).toHaveValue("1000");
    expect(onChange).toHaveBeenLastCalledWith(1000);
  });

  it("applique aussi le plancher d'un poids négatif (poids du corps assisté)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChampNombre valeur={null} entier={false} signe libelle="Poids" min={LIMITES_CHAMP.poids_kg.min} max={LIMITES_CHAMP.poids_kg.max} onChange={onChange} />,
    );

    const champ = screen.getByLabelText("Poids");
    await user.type(champ, "-600");

    // -60 est dans les bornes, -600 passe sous -500 : le dernier chiffre est ignoré.
    expect(champ).toHaveValue("-60");
    expect(onChange).toHaveBeenLastCalledWith(-60);
  });

  it("n'impose aucune borne quand min et max sont absents", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChampNombre valeur={null} entier signe={false} libelle="Valeur" onChange={onChange} />);

    const champ = screen.getByLabelText("Valeur");
    await user.type(champ, "99999");

    expect(champ).toHaveValue("99999");
  });
});
