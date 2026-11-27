import { describe, expect, it } from "vitest";
import { resumerDispo } from "./dispo";
import type { Disponibilite, Fournisseur } from "./types";

const netflix: Fournisseur = { id: 8, nom: "Netflix", logo: "/n.jpg" };
const prime: Fournisseur = { id: 119, nom: "Prime Video", logo: null };
const canal: Fournisseur = { id: 381, nom: "Canal+", logo: null };

const dispo = (partiel: Partial<Disponibilite>): Disponibilite => ({
  abonnement: [],
  location: [],
  achat: [],
  lien: null,
  ...partiel,
});

describe("resumerDispo", () => {
  it("signale une disponibilité inconnue sans la confondre avec « nulle part »", () => {
    expect(resumerDispo(null, new Set()).texte).toBe("Disponibilité inconnue");
  });

  it("met en avant les plateformes de l'utilisateur", () => {
    const r = resumerDispo(dispo({ abonnement: [netflix, prime, canal] }), new Set([119]));
    expect(r.texte).toBe("Sur Prime Video (+2)");
    expect(r.surMesPlateformes).toBe(true);
    expect(r.fournisseurs[0].id).toBe(119);
  });

  it("compte les autres plateformes quand l'utilisateur en a plusieurs sur le film", () => {
    const r = resumerDispo(dispo({ abonnement: [netflix, prime, canal] }), new Set([8, 119]));
    expect(r.texte).toBe("Sur Netflix, Prime Video (+1)");
  });

  it("liste la première plateforme quand aucune n'est celle de l'utilisateur", () => {
    const r = resumerDispo(dispo({ abonnement: [netflix, prime] }), new Set([381]));
    expect(r.texte).toBe("Sur Netflix (+1)");
    expect(r.surMesPlateformes).toBe(false);
  });

  it("distingue la location/achat de l'absence d'offre", () => {
    expect(resumerDispo(dispo({ location: [netflix] }), new Set()).texte).toBe("Location ou achat seulement");
    expect(resumerDispo(dispo({}), new Set()).texte).toBe("Aucune offre en France");
  });
});
