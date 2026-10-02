import { beforeEach, describe, expect, it } from "vitest";
import { interpreterReponse } from "@/lib/saisie-ia/moteur";
import type { ModuleIAServeur } from "@/lib/saisie-ia/module";
import { MAX_QUESTIONS } from "@/lib/saisie-ia/types";
import { normaliserTexte } from "@/lib/saisie-ia/outils";
import {
  CAS_QUESTION_TACHES,
  MAX_TACHES,
  REGLES_TACHES,
  arrondirRappel,
  interpreterTaches,
  libelleQuand,
  libelleRappel,
  libelleRepetition,
  lignesContexteTaches,
  type ContexteTaches,
} from "./saisie-naturelle";

// Jeudi 1er octobre 2026 : le calendrier du prompt part de cette date.
const CTX_BASE: ContexteTaches = {
  listes: [
    { id: "l-perso", nom: "Perso" },
    { id: "l-travail", nom: "Travail" },
  ],
  tags: [{ id: "t-sante", nom: "Santé" }],
  // Tout ce que les tests « citent » : liste, tags, nouvelle liste.
  texte: "dentiste dans la liste perso #santé vacances perso projet",
  listeParDefautId: null,
};
let ctx: ContexteTaches = CTX_BASE;
beforeEach(() => {
  ctx = CTX_BASE;
});

// Module Tâches sans lecture en base : même règles et même revalidation que
// le vrai (lib/taches/saisie-module), contexte fourni par le test.
const moduleTest: ModuleIAServeur = {
  type: "tache",
  cle: "taches",
  libelle: "tâches",
  max: MAX_TACHES,
  schemaElement: {},
  regles: REGLES_TACHES,
  casQuestion: CAS_QUESTION_TACHES,
  preparer: async () => ({
    lignesContexte: lignesContexteTaches(ctx),
    interpreter: (bruts) => interpreterTaches(bruts, ctx).map((donnees) => ({ type: "tache" as const, donnees })),
  }),
  creer: async () => [],
};

async function interpreter(brut: unknown, questionsRestantes = MAX_QUESTIONS) {
  const contexte = await moduleTest.preparer("2026-10-01", ctx.texte);
  return interpreterReponse(brut, [moduleTest], [contexte], questionsRestantes);
}

async function premiereTache(brut: Record<string, unknown>) {
  const r = await interpreter({ question: null, taches: [{ titre: "Test", ...brut }] });
  if (r.statut !== "elements") throw new Error(`attendu elements, reçu ${r.statut}`);
  const element = r.elements[0];
  if (element.type !== "tache") throw new Error(`attendu tache, reçu ${element.type}`);
  return element.donnees;
}

describe("normaliserTexte", () => {
  it("ignore casse, accents et espaces multiples", async () => {
    expect(normaliserTexte("  SANTÉ   Mentale ")).toBe("sante mentale");
  });
});

describe("arrondirRappel", () => {
  const avecHeure = { toute_la_journee: false, heure: "14:00" };

  it("garde une valeur permise sans avertissement", async () => {
    expect(arrondirRappel(60, avecHeure)).toEqual({ valeur: 60, avertissement: null });
    expect(arrondirRappel(1440, avecHeure)).toEqual({ valeur: 1440, avertissement: null });
  });

  it("prend la valeur permise la plus proche et le dit", async () => {
    expect(arrondirRappel(120, avecHeure)).toEqual({
      valeur: 60,
      avertissement: "Rappel : 1 h avant (le plus proche disponible).",
    });
    expect(arrondirRappel(10, avecHeure).valeur).toBe(5);
    expect(arrondirRappel(2000, avecHeure).valeur).toBe(1440);
  });

  it("applique le défaut du formulaire (5 min) quand une heure existe sans rappel demandé", async () => {
    expect(arrondirRappel(null, avecHeure)).toEqual({ valeur: 5, avertissement: null });
  });

  it("ne met aucun rappel sans heure ni demande", async () => {
    expect(arrondirRappel(null, { toute_la_journee: false, heure: null })).toEqual({
      valeur: null,
      avertissement: null,
    });
  });

  it("ignore un rappel demandé sans heure précise et l'annonce", async () => {
    const r = arrondirRappel(60, { toute_la_journee: false, heure: null });
    expect(r.valeur).toBeNull();
    expect(r.avertissement).toMatch(/heure précise/);
  });

  it("toute la journée : seule la veille est possible", async () => {
    expect(arrondirRappel(1440, { toute_la_journee: true, heure: null })).toEqual({
      valeur: 1440,
      avertissement: null,
    });
    expect(arrondirRappel(720, { toute_la_journee: true, heure: null }).valeur).toBe(1440);
    const court = arrondirRappel(60, { toute_la_journee: true, heure: null });
    expect(court.valeur).toBeNull();
    expect(court.avertissement).toMatch(/la veille/);
  });
});

describe("libelleRappel", () => {
  it("formule chaque valeur permise", async () => {
    expect(libelleRappel(5)).toBe("5 min avant");
    expect(libelleRappel(60)).toBe("1 h avant");
    expect(libelleRappel(1440)).toBe("la veille");
  });
});

describe("libelleQuand / libelleRepetition", () => {
  const base = { echeance: null, heure: null, heure_fin: null, toute_la_journee: false };

  it("dit « Sans date » quand rien n'est fixé", async () => {
    expect(libelleQuand(base)).toBe("Sans date");
  });

  it("formule jour et heures", async () => {
    const jour = libelleQuand({ ...base, echeance: "2026-10-08" });
    expect(jour).toMatch(/^jeu\.? 8 oct\.?$/);
    expect(libelleQuand({ ...base, echeance: "2026-10-08", heure: "14:00" })).toBe(`${jour} · 14:00`);
    expect(libelleQuand({ ...base, echeance: "2026-10-08", heure: "14:00", heure_fin: "15:30" })).toBe(
      `${jour} · 14:00–15:30`
    );
  });

  it("formule une tâche sur toute la journée", async () => {
    expect(libelleQuand({ ...base, echeance: "2026-10-08", toute_la_journee: true })).toMatch(
      /· toute la journée$/
    );
  });

  it("nomme chaque répétition", async () => {
    expect(libelleRepetition("hebdomadaire")).toBe("Chaque semaine");
    expect(libelleRepetition("quotidien")).toBe("Tous les jours");
  });
});

describe("interpreterReponse — tâches", () => {
  it("valide une tâche complète (dentiste jeudi 14h, rappel la veille)", async () => {
    const t = await premiereTache({
      titre: "Dentiste",
      date: "2026-10-08",
      heure: "14:00",
      rappel_minutes: 1440,
      priorite: "haute",
      liste: "perso",
      tags: ["santé"],
    });
    expect(t).toMatchObject({
      titre: "Dentiste",
      echeance: "2026-10-08",
      heure: "14:00",
      rappel_minutes: 1440,
      priorite: "haute",
      listeId: "l-perso",
      nouvelleListe: null,
      listeNom: "Perso",
      tagIds: ["t-sante"],
      nouveauxTags: [],
      avertissements: [],
    });
  });

  it("sans liste citée, crée une liste « Tâches » (et non la première liste)", async () => {
    const t = await premiereTache({ liste: null });
    expect(t.listeId).toBeNull();
    expect(t.nouvelleListe).toBe("Tâches");
    expect(t.listeNom).toBe("Tâches");
  });

  it("sans liste citée, réutilise une liste « Tâches » existante", async () => {
    ctx = { ...CTX_BASE, listes: [{ id: "l-trucs", nom: "Trucs à acheter" }, { id: "l-taches", nom: "Tâches" }] };
    const t = await premiereTache({ liste: "" });
    expect(t).toMatchObject({ listeId: "l-taches", nouvelleListe: null, listeNom: "Tâches" });
  });

  it("sans liste citée, utilise la liste choisie dans Réglages", async () => {
    ctx = { ...CTX_BASE, listeParDefautId: "l-travail" };
    const t = await premiereTache({ liste: "" });
    expect(t).toMatchObject({ listeId: "l-travail", nouvelleListe: null, listeNom: "Travail" });
  });

  it("ignore une liste du Réglage supprimée et retombe sur « Tâches »", async () => {
    ctx = { ...CTX_BASE, listeParDefautId: "l-disparue" };
    const t = await premiereTache({ liste: "" });
    expect(t).toMatchObject({ listeId: null, nouvelleListe: "Tâches" });
  });

  it("n'accepte pas une liste que Gemini déduit sans que Vincent la nomme", async () => {
    ctx = {
      ...CTX_BASE,
      listes: [{ id: "l-trucs", nom: "Trucs à acheter" }, { id: "l-perso", nom: "Perso" }],
      texte: "rappelle-moi dans une heure culotte menstruelle",
      listeParDefautId: "l-perso",
    };
    const t = await premiereTache({ liste: "Trucs à acheter" });
    expect(t).toMatchObject({ listeId: "l-perso", nouvelleListe: null });
  });

  it("une liste citée l'emporte sur celle des Réglages", async () => {
    ctx = { ...CTX_BASE, listeParDefautId: "l-travail" };
    const t = await premiereTache({ liste: "Perso" });
    expect(t.listeId).toBe("l-perso");
  });

  it("ne confond pas un mot qui contient le nom avec une citation", async () => {
    ctx = { ...CTX_BASE, texte: "appeler personne demain" };
    const t = await premiereTache({ liste: "Perso", tags: ["Perso"] });
    expect(t.listeId).toBeNull();
    expect(t.nouvelleListe).toBe("Tâches");
    expect(t.tagNoms).toEqual([]);
  });

  it("marque une liste inconnue comme à créer, sans identifiant", async () => {
    const t = await premiereTache({ liste: "Vacances" });
    expect(t.listeId).toBeNull();
    expect(t.nouvelleListe).toBe("Vacances");
    expect(t.listeNom).toBe("Vacances");
  });

  it("sépare tags existants et nouveaux, dédoublonne et retire virgules et #", async () => {
    const t = await premiereTache({ tags: ["Santé", "santé", "#Perso, projet", "  "] });
    expect(t.tagIds).toEqual(["t-sante"]);
    expect(t.nouveauxTags).toEqual(["Perso projet"]);
    expect(t.tagNoms).toEqual(["Santé", "Perso projet"]);
  });

  it("écarte un tag que Vincent n'a pas écrit, même s'il existe", async () => {
    ctx = { ...CTX_BASE, texte: "rappelle-moi dans une heure culotte menstruelle" };
    const t = await premiereTache({ tags: ["Santé", "acheter"] });
    expect(t.tagIds).toEqual([]);
    expect(t.nouveauxTags).toEqual([]);
    expect(t.tagNoms).toEqual([]);
  });

  it("rejette une date impossible et prévient", async () => {
    const t = await premiereTache({ date: "2026-02-31" });
    expect(t.echeance).toBeNull();
    expect(t.avertissements.join(" ")).toMatch(/Date non reconnue/);
  });

  it("rejette une heure invalide et ignore alors la fin", async () => {
    const t = await premiereTache({ heure: "25:99", heure_fin: "16:00" });
    expect(t.heure).toBeNull();
    expect(t.heure_fin).toBeNull();
  });

  it("ignore une heure de fin antérieure au début", async () => {
    const t = await premiereTache({ heure: "14:00", heure_fin: "13:00" });
    expect(t.heure_fin).toBeNull();
    expect(t.avertissements.join(" ")).toMatch(/Heure de fin ignorée/);
  });

  it("toute la journée efface heures et donne au plus la veille", async () => {
    const t = await premiereTache({ toute_la_journee: true, heure: "09:00", rappel_minutes: 1440 });
    expect(t.heure).toBeNull();
    expect(t.toute_la_journee).toBe(true);
    expect(t.rappel_minutes).toBe(1440);
  });

  it("retombe sur la priorité « aucune » pour une valeur inconnue", async () => {
    expect((await premiereTache({ priorite: "critique" })).priorite).toBe("aucune");
  });

  it("garde une répétition supportée avec sa date de départ", async () => {
    const t = await premiereTache({ date: "2026-10-05", recurrence_frequence: "hebdomadaire" });
    expect(t.recurrence_frequence).toBe("hebdomadaire");
  });

  it("crée la tâche sans répétition quand le rythme n'est pas supporté", async () => {
    const t = await premiereTache({
      date: "2026-10-05",
      recurrence_frequence: "hebdomadaire",
      recurrence_non_supportee: "tous les 15 jours",
    });
    expect(t.recurrence_frequence).toBeNull();
    expect(t.avertissements.join(" ")).toContain("« tous les 15 jours » non prise en charge");
  });

  it("ignore une répétition sans date de départ", async () => {
    const t = await premiereTache({ recurrence_frequence: "quotidien" });
    expect(t.recurrence_frequence).toBeNull();
    expect(t.avertissements.join(" ")).toMatch(/date de départ/);
  });

  it("ignore une fin de répétition antérieure au départ", async () => {
    const t = await premiereTache({
      date: "2026-10-05",
      recurrence_frequence: "mensuel",
      recurrence_fin: "2026-09-01",
    });
    expect(t.recurrence_fin).toBeNull();
  });

  it("écarte les tâches sans titre et plafonne à 8 avant filtrage", async () => {
    const beaucoup = Array.from({ length: 12 }, (_, i) => ({ titre: `T${i}` }));
    const r = await interpreter({ question: null, taches: [{ titre: "  " }, ...beaucoup] });
    // 8 premières entrées retenues (dont la vide), donc 7 tâches valides.
    expect(r.statut === "elements" && r.elements.length).toBe(7);
  });

  it("renvoie « vide » quand rien d'exploitable", async () => {
    expect(await interpreter({ question: null, taches: [] })).toEqual({ statut: "vide" });
    expect(await interpreter("n'importe quoi")).toEqual({ statut: "vide" });
    expect(await interpreter(null)).toEqual({ statut: "vide" });
  });
});

describe("interpreterReponse — valeurs vides (schéma sans `nullable`)", () => {
  const vide = {
    titre: "Envoyer mon colis SFR",
    date: "",
    heure: "",
    heure_fin: "",
    toute_la_journee: false,
    priorite: "aucune",
    rappel_minutes: 0,
    recurrence_frequence: "",
    recurrence_non_supportee: "",
    recurrence_fin: "",
    liste: "",
    tags: [],
  };

  it("traite chaînes vides et 0 comme des valeurs absentes, sans avertissement", async () => {
    const r = await interpreter({ question: { texte: "", choix: [] }, taches: [vide] });

    expect(r.statut).toBe("elements");
    if (r.statut !== "elements") return;
    expect(r.elements[0].donnees).toMatchObject({
      titre: "Envoyer mon colis SFR",
      echeance: null,
      heure: null,
      heure_fin: null,
      rappel_minutes: null,
      recurrence_frequence: null,
      recurrence_fin: null,
      listeId: null,
      nouvelleListe: "Tâches",
      tagIds: [],
      nouveauxTags: [],
      avertissements: [],
    });
  });

  it("garde le défaut de rappel (5 min) quand une heure est donnée et rappel_minutes vaut 0", async () => {
    const r = await interpreter({
      question: { texte: "", choix: [] },
      taches: [{ ...vide, date: "2026-10-02", heure: "10:00" }],
    });

    expect(r.statut === "elements" && r.elements[0].donnees).toMatchObject({
      echeance: "2026-10-02",
      heure: "10:00",
      rappel_minutes: 5,
    });
  });
});
