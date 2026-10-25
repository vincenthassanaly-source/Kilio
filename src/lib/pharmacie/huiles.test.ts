import { describe, expect, it } from "vitest";
import {
  AUCUN_FILTRE,
  convientALaGrossesse,
  estComestible,
  filtrerHuiles,
  genererCartesHuile,
  indicationsUtilisees,
  rechercherHuiles,
  validerHuile,
  type HuileChamps,
  type PharmaHuile,
} from "./huiles";

function huile(partiel: Partial<PharmaHuile> & { nom_fr: string }): PharmaHuile {
  return {
    id: partiel.nom_fr,
    nom_latin: null,
    famille: null,
    partie_distillee: null,
    chemotype: null,
    indications: [],
    proprietes: [],
    voies: [],
    dermocaustique: false,
    photosensibilisante: false,
    precautions: [],
    precautions_details: null,
    dosage: null,
    mode_emploi: null,
    notes: null,
    sources: null,
    created_at: "2026-10-25T08:00:00Z",
    updated_at: "2026-10-25T08:00:00Z",
    ...partiel,
  };
}

const CHAMPS_VIDES: HuileChamps = {
  nom_fr: "",
  nom_latin: "",
  famille: "",
  partie_distillee: "",
  chemotype: "",
  indications: [],
  proprietes: [],
  voies: [],
  dermocaustique: false,
  photosensibilisante: false,
  precautions: [],
  precautions_details: "",
  dosage: "",
  mode_emploi: "",
  notes: "",
  sources: "",
};

describe("validerHuile", () => {
  it("exige un nom français", () => {
    expect(validerHuile({ ...CHAMPS_VIDES, nom_fr: "  " })).toEqual({ ok: false, erreur: "Le nom français est requis." });
  });

  it("nettoie les tags (doublons sans accent ni casse, espaces) et vide les textes en null", () => {
    const resultat = validerHuile({
      ...CHAMPS_VIDES,
      nom_fr: " Lavande vraie ",
      nom_latin: " ",
      indications: ["  Stress ", "stress", "Sommeil  léger", ""],
    });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.huile.nom_fr).toBe("Lavande vraie");
    expect(resultat.huile.nom_latin).toBeNull();
    expect(resultat.huile.indications).toEqual(["Stress", "Sommeil léger"]);
  });

  it("ignore les voies et précautions inconnues", () => {
    const resultat = validerHuile({
      ...CHAMPS_VIDES,
      nom_fr: "Menthe poivrée",
      voies: ["orale", "orale", "intraveineuse"],
      precautions: ["grossesse", "inconnue"],
    });
    expect(resultat.ok && resultat.huile.voies).toEqual(["orale"]);
    expect(resultat.ok && resultat.huile.precautions).toEqual(["grossesse"]);
  });
});

describe("comestible et grossesse", () => {
  it("comestible = voie orale cochée", () => {
    expect(estComestible({ voies: ["orale", "diffusion"] })).toBe(true);
    expect(estComestible({ voies: ["diffusion"] })).toBe(false);
  });

  it("ne convient pas à la grossesse quand la case est cochée", () => {
    expect(convientALaGrossesse({ precautions: ["grossesse"] })).toBe(false);
    expect(convientALaGrossesse({ precautions: ["enfant"] })).toBe(true);
  });
});

describe("recherche et filtres", () => {
  const huiles = [
    huile({ nom_fr: "Lavande vraie", nom_latin: "Lavandula angustifolia", indications: ["Stress", "Sommeil"], voies: ["orale"] }),
    huile({ nom_fr: "Eucalyptus radié", nom_latin: "Eucalyptus radiata", indications: ["Toux"], precautions: ["grossesse"] }),
    huile({ nom_fr: "Citron", indications: ["Digestion"], photosensibilisante: true, voies: ["orale"] }),
  ];

  it("cherche sans tenir compte des accents ni de la casse, dans le nom, le latin et les tags", () => {
    expect(rechercherHuiles(huiles, "RADIE").map((h) => h.nom_fr)).toEqual(["Eucalyptus radié"]);
    expect(rechercherHuiles(huiles, "angustifolia").map((h) => h.nom_fr)).toEqual(["Lavande vraie"]);
    expect(rechercherHuiles(huiles, "digestion").map((h) => h.nom_fr)).toEqual(["Citron"]);
  });

  it("trie de A à Z quand la requête est vide", () => {
    expect(rechercherHuiles(huiles, "").map((h) => h.nom_fr)).toEqual(["Citron", "Eucalyptus radié", "Lavande vraie"]);
  });

  it("combine les filtres comestible, grossesse et indication", () => {
    expect(filtrerHuiles(huiles, { ...AUCUN_FILTRE, comestible: true }).map((h) => h.nom_fr)).toEqual(["Lavande vraie", "Citron"]);
    expect(filtrerHuiles(huiles, { ...AUCUN_FILTRE, grossesse: true }).map((h) => h.nom_fr)).toEqual(["Lavande vraie", "Citron"]);
    expect(filtrerHuiles(huiles, { ...AUCUN_FILTRE, indication: "stress" }).map((h) => h.nom_fr)).toEqual(["Lavande vraie"]);
  });

  it("liste les indications de la plus utilisée à la moins utilisée", () => {
    const plusieurs = [
      huile({ nom_fr: "A", indications: ["Toux", "Stress"] }),
      huile({ nom_fr: "B", indications: ["toux"] }),
    ];
    expect(indicationsUtilisees(plusieurs)).toEqual(["Toux", "Stress"]);
  });
});

describe("genererCartesHuile", () => {
  it("génère les cinq cartes d'une fiche complète", () => {
    const cartes = genererCartesHuile(
      huile({
        nom_fr: "Citron",
        nom_latin: "Citrus limon",
        indications: ["Digestion"],
        voies: ["orale", "diffusion"],
        photosensibilisante: true,
        precautions: ["enfant"],
      })
    );
    expect(cartes.map((c) => c.he_type)).toEqual(["latin", "francais", "indications", "voies", "precautions"]);
    expect(cartes[0]).toMatchObject({ reponse: "Citrus limon" });
    expect(cartes[1]).toMatchObject({ reponse: "Citron" });
    expect(cartes[3].reponse).toContain("Comestible : oui, par voie orale");
    expect(cartes[4].reponse).toContain("Photosensibilisante");
  });

  it("n'invente aucune carte pour une fiche vide", () => {
    expect(genererCartesHuile(huile({ nom_fr: "Mystère" }))).toEqual([]);
  });

  it("indique « non » quand la voie orale n'est pas cochée", () => {
    const [carte] = genererCartesHuile(huile({ nom_fr: "Ravintsara", voies: ["diffusion"] }));
    expect(carte.reponse).toContain("Comestible : non");
  });
});
