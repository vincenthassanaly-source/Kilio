import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { META_NIVEAU, NIVEAUX } from "@/lib/pharmacie/contenu";
import { ContenuColore } from "./ContenuColore";

describe("ContenuColore", () => {
  it("rend un contenu sans balise comme un simple paragraphe, texte intact", () => {
    const contenu = "Normale : 0,70 à 1,10 g/L.\nConversion : g/L × 5,55.";
    const { container } = render(<ContenuColore contenu={contenu} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe(contenu);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("rend une ligne balisée avec libellé accessible, sans afficher la balise", () => {
    render(<ContenuColore contenu={"[rouge] Diabète : ≥ 1,26 g/L"} />);
    expect(screen.getByText(/Diabète : ≥ 1,26 g\/L/)).toBeInTheDocument();
    expect(screen.getByText(/Danger/)).toHaveClass("sr-only");
    expect(screen.queryByText(/\[rouge\]/)).toBeNull();
  });

  it("garde le texte hors balise et colore les seules lignes balisées", () => {
    const { container } = render(<ContenuColore contenu={"Intro\n[vert] Normale\n[orange] Prédiabète"} />);
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it.each(NIVEAUX)("rend la balise [%s] : rangée à barre, pictogramme et libellé accessible", (niveau) => {
    const { container } = render(<ContenuColore contenu={`[${niveau}] Pansement hydrocolloïde`} />);
    const vue = within(container);
    expect(vue.getByText(/Pansement hydrocolloïde/)).toBeInTheDocument();
    expect(vue.getByText(new RegExp(META_NIVEAU[niveau].libelle))).toHaveClass("sr-only");
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
    expect(container.querySelector("div > div.border-l-4")).not.toBeNull();
    expect(container.textContent).not.toContain(`[${niveau}]`);
  });

  it("laisse une balise inconnue en texte normal, sans erreur", () => {
    const contenu = "[fuchsia] Pansement";
    const { container } = render(<ContenuColore contenu={contenu} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe(contenu);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("ContenuColore – titres de section", () => {
  const contenu = "[rouge] INTERACTIONS\n[rouge] Dégradé par le CYP3A4.\n\n[orange] À ÉVITER\n[orange] AINS (risque rénal).";

  it("rend une carte par section, titre en tête et lignes en liste, si titresSections", () => {
    const { container } = render(<ContenuColore contenu={contenu} titresSections />);
    const titres = Array.from(container.querySelectorAll("section h3")).map((h) => h.textContent);
    expect(titres).toEqual(["INTERACTIONS", "À ÉVITER"]);
    const lignes = Array.from(container.querySelectorAll("section")).map((s) => s.querySelectorAll("li").length);
    expect(lignes).toEqual([1, 1]);
  });

  it("garde le rendu ligne par ligne par défaut", () => {
    const { container } = render(<ContenuColore contenu={contenu} />);
    expect(container.querySelector("section")).toBeNull();
    expect(container.querySelectorAll("div.border-l-4")).toHaveLength(4);
  });

  it("distingue une ligne d'une autre couleur : libellé accessible et gras si rouge", () => {
    const { container } = render(
      <ContenuColore contenu={"[orange] SURVEILLANCE\n[orange] Kaliémie à 1 mois.\n[rouge] Risque : hyperkaliémie."} titresSections />
    );
    const [simple, critique] = Array.from(container.querySelectorAll("li p"));
    expect(simple.querySelector(".sr-only")).toBeNull();
    expect(critique).toHaveClass("font-semibold");
    expect(critique.querySelector(".sr-only")?.textContent).toContain("Danger");
  });

  it("rend « # » comme sous-titre de section, sans afficher le dièse", () => {
    const { container } = render(<ContenuColore contenu={"[gris] MÉCANISME\n[gris] # Diabète\n[gris] Le sucre est évacué."} titresSections />);
    expect(screen.getByText("Diabète")).toBeInTheDocument();
    expect(container.textContent).not.toContain("# Diabète");
  });

  it("n'affiche jamais la balise", () => {
    const { container } = render(<ContenuColore contenu={contenu} titresSections />);
    expect(container.textContent).not.toContain("[rouge]");
  });
});
