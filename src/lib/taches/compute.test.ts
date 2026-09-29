import { describe, expect, it } from "vitest";
import {
  actualisationEchouee,
  appliquerCochage,
  champsAvancesRenseignes,
  cochageDejaApplique,
  echeanceParDefaut,
  etatListeTaches,
  libelleNombreTaches,
  messageAvertissementCreation,
  messageHorsLigne,
  messageSuppressionListe,
  type ChampsAvancesTache,
} from "./compute";

describe("appliquerCochage", () => {
  it("bascule simplement une tâche non récurrente", () => {
    const tache = { echeance: "2026-09-20", recurrence_frequence: null, recurrence_fin: null };
    expect(appliquerCochage(tache, true, "2026-09-26")).toEqual({
      fait: true,
      echeance: "2026-09-20",
      occurrenceAvancee: false,
    });
    expect(appliquerCochage(tache, false, "2026-09-26")).toEqual({
      fait: false,
      echeance: "2026-09-20",
      occurrenceAvancee: false,
    });
  });

  it("décocher une tâche récurrente ne touche pas à l'échéance", () => {
    const tache = { echeance: "2026-09-26", recurrence_frequence: "quotidien" as const, recurrence_fin: null };
    expect(appliquerCochage(tache, false, "2026-09-26")).toEqual({
      fait: false,
      echeance: "2026-09-26",
      occurrenceAvancee: false,
    });
  });

  it("cocher une tâche récurrente à jour avance d'une occurrence", () => {
    const tache = { echeance: "2026-09-26", recurrence_frequence: "quotidien" as const, recurrence_fin: null };
    expect(appliquerCochage(tache, true, "2026-09-26")).toEqual({
      fait: false,
      echeance: "2026-09-27",
      occurrenceAvancee: true,
    });
  });

  it("cocher une tâche récurrente en retard avance jusqu'à dépasser aujourd'hui, pas d'un seul pas", () => {
    const tache = { echeance: "2026-09-10", recurrence_frequence: "quotidien" as const, recurrence_fin: null };
    expect(appliquerCochage(tache, true, "2026-09-26")).toEqual({
      fait: false,
      echeance: "2026-09-27",
      occurrenceAvancee: true,
    });
  });

  it("arrête la récurrence si la prochaine échéance dépasse recurrence_fin", () => {
    const tache = {
      echeance: "2026-09-26",
      recurrence_frequence: "quotidien" as const,
      recurrence_fin: "2026-09-26",
    };
    expect(appliquerCochage(tache, true, "2026-09-26")).toEqual({
      fait: true,
      echeance: "2026-09-26",
      occurrenceAvancee: false,
    });
  });

  it("part d'aujourd'hui quand l'échéance est absente", () => {
    const tache = { echeance: null, recurrence_frequence: "hebdomadaire" as const, recurrence_fin: null };
    expect(appliquerCochage(tache, true, "2026-09-26")).toEqual({
      fait: false,
      echeance: "2026-10-03",
      occurrenceAvancee: true,
    });
  });
});

describe("echeanceParDefaut", () => {
  it("pré-remplit la date du jour pour 'aujourdhui' et 'semaine'", () => {
    expect(echeanceParDefaut("aujourdhui", "2026-09-26")).toBe("2026-09-26");
    expect(echeanceParDefaut("semaine", "2026-09-26")).toBe("2026-09-26");
  });

  it("n'impose aucune date pour 'en_retard' et 'toutes'", () => {
    expect(echeanceParDefaut("en_retard", "2026-09-26")).toBeUndefined();
    expect(echeanceParDefaut("toutes", "2026-09-26")).toBeUndefined();
  });
});

describe("messageAvertissementCreation", () => {
  it("ne renvoie rien quand tout a réussi", () => {
    expect(messageAvertissementCreation({ tags: false, images: false })).toBeUndefined();
  });

  it("mentionne les tags seuls", () => {
    expect(messageAvertissementCreation({ tags: true, images: false })).toContain(
      "l'enregistrement des tags a échoué"
    );
  });

  it("mentionne l'image seule (singulier)", () => {
    expect(messageAvertissementCreation({ tags: false, images: true })).toContain("l'envoi de l'image a échoué");
  });

  it("mentionne les images au plurel quand plusieursImages", () => {
    expect(messageAvertissementCreation({ tags: false, images: true, plusieursImages: true })).toContain(
      "l'envoi des images a échoué"
    );
  });

  it("mentionne tags ET images ensemble", () => {
    const message = messageAvertissementCreation({ tags: true, images: true });
    expect(message).toContain("l'enregistrement des tags");
    expect(message).toContain("l'envoi de l'image");
    expect(message).toContain("ont échoué");
  });
});

describe("messageHorsLigne", () => {
  it("distingue création et édition", () => {
    expect(messageHorsLigne(false)).toContain("n'a pas été enregistrée");
    expect(messageHorsLigne(true)).toContain("n'ont pas été enregistrées");
  });
});

describe("messageSuppressionListe", () => {
  it("liste vide -> confirmation simple sans détail", () => {
    expect(messageSuppressionListe("Courses", 0, 0)).toBe("Supprimer la liste « Courses » ?");
  });

  it("une seule tâche, pas faite", () => {
    expect(messageSuppressionListe("Courses", 1, 0)).toBe(
      "Supprimer la liste « Courses » et sa tâche ? Cette action est définitive : la tâche, ses sous-tâches et ses images seront supprimées."
    );
  });

  it("une seule tâche, déjà faite", () => {
    expect(messageSuppressionListe("Courses", 1, 1)).toContain("sa tâche (déjà faite)");
  });

  it("plusieurs tâches, aucune faite", () => {
    expect(messageSuppressionListe("Courses", 5, 0)).toContain("ses 5 tâches ?");
  });

  it("plusieurs tâches, toutes faites", () => {
    expect(messageSuppressionListe("Courses", 5, 5)).toContain("ses 5 tâches (toutes faites)");
  });

  it("plusieurs tâches, une seule faite", () => {
    expect(messageSuppressionListe("Courses", 5, 1)).toContain("ses 5 tâches (dont 1 faite)");
  });

  it("plusieurs tâches, plusieurs faites (pas toutes)", () => {
    expect(messageSuppressionListe("Courses", 5, 3)).toContain("ses 5 tâches (dont 3 faites)");
  });
});

describe("libelleNombreTaches", () => {
  it("0 ou négatif -> 'Aucune tâche'", () => {
    expect(libelleNombreTaches(0)).toBe("Aucune tâche");
    expect(libelleNombreTaches(-1)).toBe("Aucune tâche");
  });

  it("singulier à 1", () => {
    expect(libelleNombreTaches(1)).toBe("1 tâche");
  });

  it("pluriel au-delà de 1", () => {
    expect(libelleNombreTaches(12)).toBe("12 tâches");
  });
});

describe("champsAvancesRenseignes", () => {
  function champs(overrides: Partial<ChampsAvancesTache> = {}): ChampsAvancesTache {
    return {
      heure: null,
      heure_fin: null,
      rappel_minutes: null,
      notes: null,
      programme_jour: false,
      priorite: "aucune",
      toute_la_journee: false,
      recurrence_frequence: null,
      recurrence_fin: null,
      images: [],
      tags: [],
      ...overrides,
    };
  }

  it("aucun champ renseigné -> false", () => {
    expect(champsAvancesRenseignes(champs())).toBe(false);
  });

  it("une heure renseignée -> true", () => {
    expect(champsAvancesRenseignes(champs({ heure: "09:00" }))).toBe(true);
  });

  it("des notes uniquement composées d'espaces ne comptent pas", () => {
    expect(champsAvancesRenseignes(champs({ notes: "   " }))).toBe(false);
  });

  it("des notes avec du contenu comptent", () => {
    expect(champsAvancesRenseignes(champs({ notes: "Ne pas oublier" }))).toBe(true);
  });

  it("une priorité différente de 'aucune' compte", () => {
    expect(champsAvancesRenseignes(champs({ priorite: "haute" }))).toBe(true);
  });

  it("des images ou des tags comptent", () => {
    expect(champsAvancesRenseignes(champs({ images: ["img1"] }))).toBe(true);
    expect(champsAvancesRenseignes(champs({ tags: ["urgent"] }))).toBe(true);
  });

  it("une récurrence renseignée compte", () => {
    expect(champsAvancesRenseignes(champs({ recurrence_frequence: "mensuel" }))).toBe(true);
  });
});

describe("cochageDejaApplique", () => {
  const recurrente = { echeance: "2026-09-30", recurrence_frequence: "quotidien", recurrence_fin: null } as const;

  it("ne garde rien sans échéance observée (ancienne action en file)", () => {
    expect(cochageDejaApplique(recurrente, true, undefined)).toBe(false);
  });

  it("laisse passer la coche quand l'échéance vue est celle du serveur", () => {
    expect(cochageDejaApplique(recurrente, true, "2026-09-30")).toBe(false);
  });

  it("bloque une coche périmée : l'occurrence a déjà été avancée", () => {
    expect(cochageDejaApplique({ ...recurrente, echeance: "2026-10-01" }, true, "2026-09-30")).toBe(true);
  });

  it("compare aussi une échéance absente", () => {
    expect(cochageDejaApplique({ ...recurrente, echeance: null }, true, null)).toBe(false);
    expect(cochageDejaApplique({ ...recurrente, echeance: "2026-10-01" }, true, null)).toBe(true);
  });

  it("ne garde jamais un décochage ni une tâche non récurrente", () => {
    expect(cochageDejaApplique({ ...recurrente, echeance: "2026-10-01" }, false, "2026-09-30")).toBe(false);
    expect(
      cochageDejaApplique(
        { echeance: "2026-10-01", recurrence_frequence: null, recurrence_fin: null },
        true,
        "2026-09-30"
      )
    ).toBe(false);
  });
});

describe("etatListeTaches / actualisationEchouee", () => {
  it("affiche le chargement tant que la première requête n'a rien rendu", () => {
    expect(etatListeTaches({ isLoading: true, isError: false, aDesDonnees: false })).toBe("chargement");
  });

  it("n'affiche l'erreur que s'il n'y a aucune donnée à montrer", () => {
    expect(etatListeTaches({ isLoading: false, isError: true, aDesDonnees: false })).toBe("erreur");
  });

  it("garde la liste quand une actualisation échoue alors que le cache est rempli", () => {
    const requete = { isLoading: false, isError: true, aDesDonnees: true };
    expect(etatListeTaches(requete)).toBe("liste");
    expect(actualisationEchouee(requete)).toBe(true);
  });

  it("ne signale rien quand tout va bien", () => {
    const requete = { isLoading: false, isError: false, aDesDonnees: true };
    expect(etatListeTaches(requete)).toBe("liste");
    expect(actualisationEchouee(requete)).toBe(false);
  });
});
