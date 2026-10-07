import { describe, expect, it } from "vitest";
import {
  construireCalendrierIcs,
  echapperTexte,
  fenetreFlux,
  jetonValide,
  replierLigne,
  type EvenementIcs,
  type TacheIcs,
} from "./ics";

const evenement: EvenementIcs = {
  id: "e1",
  titre: "Dentiste, cabinet",
  date: "2026-10-12",
  heure: "14:30:00",
  heure_fin: "15:15:00",
  notes: "Apporter\nla carte",
  updated_at: "2026-10-01T08:00:00.000Z",
};

const tache: TacheIcs = {
  id: "t1",
  titre: "Appeler la banque",
  echeance: "2026-10-13",
  heure: null,
  heure_fin: null,
  duree_minutes: null,
  toute_la_journee: false,
  fait: false,
  notes: null,
  updated_at: "2026-10-02T09:00:00.000Z",
};

describe("jetonValide", () => {
  it("accepte uniquement le jeton exact", () => {
    expect(jetonValide("secret", "secret")).toBe(true);
    expect(jetonValide("secreT", "secret")).toBe(false);
    expect(jetonValide("secret2", "secret")).toBe(false);
  });
  it("refuse un jeton absent ou un jeton attendu vide", () => {
    expect(jetonValide(null, "secret")).toBe(false);
    expect(jetonValide("", "")).toBe(false);
    expect(jetonValide("secret", undefined)).toBe(false);
  });
});

describe("fenetreFlux", () => {
  it("couvre -1 mois à +6 mois", () => {
    expect(fenetreFlux("2026-10-07")).toEqual({ debut: "2026-09-07", fin: "2027-04-07" });
  });
  it("cale sur la fin du mois cible", () => {
    expect(fenetreFlux("2026-03-31")).toEqual({ debut: "2026-02-28", fin: "2026-09-30" });
  });
});

describe("echapperTexte / replierLigne", () => {
  it("échappe virgules, points-virgules, antislash et retours à la ligne", () => {
    expect(echapperTexte("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
  it("replie à 75 octets sans couper un caractère multi-octets", () => {
    const ligne = "SUMMARY:" + "é".repeat(80);
    const replie = replierLigne(ligne);
    for (const morceau of replie.split("\r\n")) {
      expect(Buffer.byteLength(morceau)).toBeLessThanOrEqual(75);
    }
    expect(replie.split("\r\n").map((m, i) => (i ? m.slice(1) : m)).join("")).toBe(ligne);
  });
});

describe("construireCalendrierIcs", () => {
  const ics = construireCalendrierIcs([evenement], [tache]);

  it("produit un calendrier valide terminé par CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Paris");
  });

  it("encode un rendez-vous à l'heure de Paris", () => {
    expect(ics).toContain("UID:evenement-e1@kilio");
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261012T143000");
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20261012T151500");
    expect(ics).toContain("SUMMARY:Dentiste\\, cabinet");
    expect(ics).toContain("DESCRIPTION:Apporter\\nla carte");
    expect(ics).toContain("DTSTAMP:20261001T080000Z");
  });

  it("encode une tâche sans heure en événement journée entière", () => {
    expect(ics).toContain("UID:tache-t1@kilio");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261013");
    expect(ics).toContain("DTEND;VALUE=DATE:20261014");
    expect(ics).toContain("SUMMARY:☐ Appeler la banque");
  });

  it("encode une tâche avec heure et durée", () => {
    const sortie = construireCalendrierIcs([], [{ ...tache, heure: "09:00:00", duree_minutes: 45 }]);
    expect(sortie).toContain("DTSTART;TZID=Europe/Paris:20261013T090000");
    expect(sortie).toContain("DTEND;TZID=Europe/Paris:20261013T094500");
  });

  it("utilise 30 minutes par défaut et l'heure de fin si présente", () => {
    expect(construireCalendrierIcs([], [{ ...tache, heure: "09:00" }])).toContain("DTEND;TZID=Europe/Paris:20261013T093000");
    expect(construireCalendrierIcs([], [{ ...tache, heure: "09:00", heure_fin: "11:00" }])).toContain(
      "DTEND;TZID=Europe/Paris:20261013T110000"
    );
  });

  it("ignore tâches faites ou sans échéance, et n'ajoute aucune alarme", () => {
    const sortie = construireCalendrierIcs([], [{ ...tache, fait: true }, { ...tache, id: "t2", echeance: null }]);
    expect(sortie).not.toContain("BEGIN:VEVENT");
    expect(ics).not.toContain("VALARM");
  });

  it("traite une tâche toute la journée même avec une heure", () => {
    const sortie = construireCalendrierIcs([], [{ ...tache, heure: "09:00", toute_la_journee: true }]);
    expect(sortie).toContain("DTSTART;VALUE=DATE:20261013");
  });
});
