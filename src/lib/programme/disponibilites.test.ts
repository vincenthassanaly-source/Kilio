import { describe, expect, it } from "vitest";
import {
  dureeTotale,
  enHeure,
  enMinutes,
  libelleCreneau,
  libelleDuree,
  occupationsDuJour,
  plafondPropositions,
  plagesLibres,
  seChevauchent,
  validerCreneau,
} from "./disponibilites";

const p = (debut: string, fin: string) => ({ debut, fin });

describe("enMinutes / enHeure", () => {
  it("convertit HH:MM et HH:MM:SS (colonne time de Postgres)", () => {
    expect(enMinutes("09:30")).toBe(570);
    expect(enMinutes("09:30:00")).toBe(570);
    expect(enMinutes("00:00")).toBe(0);
  });

  it("formate en HH:MM et borne minuit à 23:59", () => {
    expect(enHeure(570)).toBe("09:30");
    expect(enHeure(5)).toBe("00:05");
    expect(enHeure(1440)).toBe("23:59");
  });
});

describe("plagesLibres", () => {
  it("journée vide avant 7 h : toute la journée utile", () => {
    expect(plagesLibres({ maintenant: "06:00", occupations: [] })).toEqual([p("07:00", "22:00")]);
  });

  it("ne propose rien avant maintenant, arrondi aux 5 minutes supérieures", () => {
    expect(plagesLibres({ maintenant: "18:16", occupations: [] })).toEqual([p("18:20", "22:00")]);
    expect(plagesLibres({ maintenant: "18:20", occupations: [] })).toEqual([p("18:20", "22:00")]);
  });

  it("retire le travail et garde le matin et le soir", () => {
    expect(plagesLibres({ maintenant: "08:00", occupations: [p("09:00", "17:00")] })).toEqual([
      p("08:00", "09:00"),
      p("17:00", "22:00"),
    ]);
  });

  it("rien quand la journée est finie ou complète", () => {
    expect(plagesLibres({ maintenant: "22:00", occupations: [] })).toEqual([]);
    expect(plagesLibres({ maintenant: "23:30", occupations: [] })).toEqual([]);
    expect(plagesLibres({ maintenant: "06:00", occupations: [p("06:00", "23:00")] })).toEqual([]);
  });

  it("écarte les plages de moins de 30 minutes", () => {
    const libres = plagesLibres({
      maintenant: "06:00",
      occupations: [p("07:00", "09:00"), p("09:20", "12:00")],
    });
    expect(libres).toEqual([p("12:00", "22:00")]);
  });

  it("garde une plage d'exactement 30 minutes", () => {
    const libres = plagesLibres({
      maintenant: "06:00",
      occupations: [p("07:00", "09:00"), p("09:30", "22:00")],
    });
    expect(libres).toEqual([p("09:00", "09:30")]);
  });

  it("fusionne les occupations qui se chevauchent et celles qui se touchent", () => {
    const libres = plagesLibres({
      maintenant: "06:00",
      occupations: [p("11:00", "14:00"), p("09:00", "12:00"), p("14:00", "15:00")],
    });
    expect(libres).toEqual([p("07:00", "09:00"), p("15:00", "22:00")]);
  });

  it("une occupation qui en contient une autre ne rouvre pas de plage", () => {
    const libres = plagesLibres({
      maintenant: "06:00",
      occupations: [p("09:00", "17:00"), p("12:00", "13:00")],
    });
    expect(libres).toEqual([p("07:00", "09:00"), p("17:00", "22:00")]);
  });

  it("un poste de nuit (fin avant début) occupe jusqu'à minuit", () => {
    expect(plagesLibres({ maintenant: "06:00", occupations: [p("20:00", "04:00")] })).toEqual([
      p("07:00", "20:00"),
    ]);
  });

  it("ignore une occupation hors de la journée utile", () => {
    expect(plagesLibres({ maintenant: "06:00", occupations: [p("01:00", "05:00"), p("22:30", "23:30")] })).toEqual([
      p("07:00", "22:00"),
    ]);
  });

  it("coupe une occupation en cours à l'heure actuelle", () => {
    // Travail 09:00-17:00 ; il est 15:00 : reste 17:00-22:00 seulement.
    expect(plagesLibres({ maintenant: "15:00", occupations: [p("09:00", "17:00")] })).toEqual([p("17:00", "22:00")]);
  });

  it("accepte des bornes de journée personnalisées", () => {
    expect(plagesLibres({ maintenant: "05:00", occupations: [], debutJournee: "08:00", finJournee: "20:00" })).toEqual([
      p("08:00", "20:00"),
    ]);
  });
});

describe("occupationsDuJour", () => {
  it("tronque les secondes des créneaux de travail", () => {
    const o = occupationsDuJour({ creneauxTravail: [p("09:00:00", "17:30:00")], taches: [] });
    expect(o).toEqual([p("09:00", "17:30")]);
  });

  it("donne une heure de fin de 60 min à une tâche qui n'en a pas", () => {
    const o = occupationsDuJour({ creneauxTravail: [], taches: [{ heure: "14:00:00", heure_fin: null }] });
    expect(o).toEqual([p("14:00", "15:00")]);
  });

  it("respecte l'heure de fin d'une tâche", () => {
    const o = occupationsDuJour({ creneauxTravail: [], taches: [{ heure: "14:00", heure_fin: "14:45" }] });
    expect(o).toEqual([p("14:00", "14:45")]);
  });

  it("une tâche tardive sans fin court jusqu'à minuit", () => {
    const o = occupationsDuJour({ creneauxTravail: [], taches: [{ heure: "23:30", heure_fin: null }] });
    expect(o).toEqual([p("23:30", "24:00")]);
  });

  it("s'enchaîne avec plagesLibres : travail + rendez-vous", () => {
    const occupations = occupationsDuJour({
      creneauxTravail: [p("09:00", "17:00")],
      taches: [{ heure: "18:00", heure_fin: "19:00" }],
    });
    expect(plagesLibres({ maintenant: "17:10", occupations })).toEqual([p("17:10", "18:00"), p("19:00", "22:00")]);
  });
});

describe("dureeTotale / libelleDuree", () => {
  it("additionne les plages", () => {
    expect(dureeTotale([p("08:00", "09:00"), p("17:00", "22:00")])).toBe(360);
    expect(dureeTotale([])).toBe(0);
  });

  it("formule les durées", () => {
    expect(libelleDuree(150)).toBe("2 h 30");
    expect(libelleDuree(45)).toBe("45 min");
    expect(libelleDuree(60)).toBe("1 h");
    expect(libelleDuree(65)).toBe("1 h 05");
  });
});

describe("plafondPropositions", () => {
  it("proportionne les suggestions au temps libre", () => {
    expect(plafondPropositions(0)).toBe(2);
    expect(plafondPropositions(59)).toBe(2);
    expect(plafondPropositions(60)).toBe(3);
    expect(plafondPropositions(179)).toBe(3);
    expect(plafondPropositions(180)).toBe(5);
    expect(plafondPropositions(900)).toBe(5);
  });
});

describe("validerCreneau", () => {
  const libres = [p("08:00", "09:00"), p("17:00", "22:00")];

  it("accepte un créneau contenu dans une plage libre", () => {
    expect(validerCreneau("17:30-18:30", libres)).toEqual(p("17:30", "18:30"));
    expect(validerCreneau("08:00-09:00", libres)).toEqual(p("08:00", "09:00"));
  });

  it("tolère tiret demi-cadratin et espaces", () => {
    expect(validerCreneau("17:30 – 18:30", libres)).toEqual(p("17:30", "18:30"));
    expect(validerCreneau(" 17:30—18:30 ", libres)).toEqual(p("17:30", "18:30"));
  });

  it("refuse un créneau qui déborde d'une plage", () => {
    expect(validerCreneau("16:30-17:30", libres)).toBeNull();
    expect(validerCreneau("21:30-22:30", libres)).toBeNull();
  });

  it("refuse un créneau à cheval sur deux plages (donc sur le travail)", () => {
    expect(validerCreneau("08:30-17:30", libres)).toBeNull();
  });

  it("refuse un créneau en plein travail", () => {
    expect(validerCreneau("10:00-11:00", libres)).toBeNull();
  });

  it("refuse fin avant ou égale au début", () => {
    expect(validerCreneau("18:00-18:00", libres)).toBeNull();
    expect(validerCreneau("19:00-18:00", libres)).toBeNull();
  });

  it("refuse les heures invalides et les formats libres", () => {
    expect(validerCreneau("25:00-26:00", libres)).toBeNull();
    expect(validerCreneau("18:60-19:00", libres)).toBeNull();
    expect(validerCreneau("18h-19h", libres)).toBeNull();
    expect(validerCreneau("", libres)).toBeNull();
    expect(validerCreneau(null, libres)).toBeNull();
    expect(validerCreneau(1830, libres)).toBeNull();
  });

  it("refuse tout quand il n'y a aucune plage", () => {
    expect(validerCreneau("17:30-18:30", [])).toBeNull();
  });
});

describe("seChevauchent / libelleCreneau", () => {
  it("détecte un vrai chevauchement mais pas deux plages qui se touchent", () => {
    expect(seChevauchent(p("17:00", "18:00"), p("17:30", "18:30"))).toBe(true);
    expect(seChevauchent(p("17:00", "18:00"), p("18:00", "19:00"))).toBe(false);
    expect(seChevauchent(p("17:00", "18:00"), p("19:00", "20:00"))).toBe(false);
    expect(seChevauchent(p("17:00", "20:00"), p("18:00", "19:00"))).toBe(true);
  });

  it("formate avec un tiret demi-cadratin", () => {
    expect(libelleCreneau(p("17:00", "18:30"))).toBe("17:00–18:30");
  });
});
