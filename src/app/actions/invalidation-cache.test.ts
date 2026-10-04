// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Garde-fou des caches serveur ('use cache' + tag, voir src/lib/*/cache.ts) :
// une écriture qui oublie d'expirer son tag laisserait la liste en cache
// derrière la base (donnée périmée visible jusqu'à 60 s). Le test lit le
// code source des Server Actions, isole chaque fonction, et exige que toute
// fonction qui écrit en base (insert / update / delete / upsert) expire le
// tag du module — sauf les fonctions listées dans `exemptions`, avec la
// raison. Ajouter une écriture sans expirer le tag fait donc échouer la CI.

const RACINE = process.cwd();

function lire(fichier: string): string {
  return readFileSync(path.join(RACINE, fichier), "utf8");
}

type Fonction = { nom: string; corps: string };

/** Découpe un fichier en fonctions `async function nom(` / `function nom(`. */
function extraireFonctions(source: string): Fonction[] {
  const re = /^(?:export )?(?:async )?function (\w+)\(/gm;
  const debuts = [...source.matchAll(re)].map((m) => ({ nom: m[1], index: m.index ?? 0 }));
  return debuts.map((debut, i) => ({
    nom: debut.nom,
    corps: source.slice(debut.index, debuts[i + 1]?.index ?? source.length),
  }));
}

const ECRIT_EN_BASE = /\.(insert|update|delete|upsert)\(/;

type Module = {
  fichier: string;
  /** Motif attendu dans le corps de chaque fonction qui écrit. */
  expiration: RegExp;
  /** Si défini, seules ces fonctions doivent expirer (écritures partielles). */
  seulement?: string[];
  /** Fonctions internes qui écrivent sans expirer, avec la raison. */
  exemptions?: Record<string, string>;
};

const MODULES: Module[] = [
  { fichier: "src/app/actions/courses.ts", expiration: /updateTag\(COURSES_TAG\)/ },
  { fichier: "src/app/actions/habitudes.ts", expiration: /updateTag\(HABITUDES_TAG\)/ },
  {
    // Seules les écritures qui changent ce que lit getHabitudesDuJour
    // (objectifs et liens objectif-habitude) expirent le tag des habitudes.
    fichier: "src/app/actions/objectifs.ts",
    expiration: /updateTag\(HABITUDES_TAG\)/,
    seulement: ["creerObjectif", "modifierObjectif", "changerStatutObjectif", "supprimerObjectif"],
  },
  {
    fichier: "src/app/actions/notes.ts",
    expiration: /updateTag\(NOTES_TAG\)/,
    exemptions: {
      resolveTagIds: "interne, appelée par les actions de notes qui expirent le tag",
      syncNotesTags: "interne, appelée par createNote / updateNote qui expirent le tag",
    },
  },
  {
    fichier: "src/app/actions/taches.ts",
    expiration: /expirerCacheTaches\(|revalidateTachesPaths\(/,
    exemptions: {
      resolveTagIds: "interne, appelée par createTache / updateTache",
      syncTachesTags: "interne, appelée par createTache / updateTache",
      supprimerObjetsStorage: "supprime des fichiers de stockage, pas des lignes lues",
      supprimerImagesDeTache: "interne, appelée par updateTache / deleteTache",
      createTag: "un nouveau tag sans lien n'apparaît dans aucune lecture en cache",
    },
  },
  { fichier: "src/app/actions/comptes.ts", expiration: /updateTag\(BUDGET_TAG\)/ },
  { fichier: "src/app/actions/budgets.ts", expiration: /updateTag\(BUDGET_TAG\)/ },
  { fichier: "src/app/actions/categories-budget.ts", expiration: /updateTag\(BUDGET_TAG\)/ },
  { fichier: "src/app/actions/transactions.ts", expiration: /updateTag\(BUDGET_TAG\)|revalidateTransactionPaths\(/ },
  {
    fichier: "src/app/actions/transactions-recurrentes.ts",
    expiration: /updateTag\(BUDGET_TAG\)|revalidateRecurrencePaths\(/,
    exemptions: {
      genererOccurrencesDues:
        "appelée au rendu, où updateTag est interdit : elle renvoie true quand elle a écrit et la page lit alors en direct (budget/requete.ts)",
    },
  },
  { fichier: "src/app/actions/recettes.ts", expiration: /updateTag\(RECETTES_TAG\)/ },
  { fichier: "src/app/actions/recette-ingredients.ts", expiration: /updateTag\(RECETTES_TAG\)/ },
  {
    fichier: "src/app/actions/recette-ingredients-libres.ts",
    expiration: /revalidateRecette\(/,
  },
];

describe("les écritures expirent le tag du cache serveur qu'elles invalident", () => {
  for (const cible of MODULES) {
    describe(cible.fichier, () => {
      const fonctions = extraireFonctions(lire(cible.fichier));
      const exemptions = cible.exemptions ?? {};
      const ecrivains = fonctions.filter(
        (f) => ECRIT_EN_BASE.test(f.corps) && (!cible.seulement || cible.seulement.includes(f.nom))
      );

      it("trouve des fonctions d'écriture à contrôler", () => {
        expect(ecrivains.length).toBeGreaterThan(0);
      });

      for (const fonction of ecrivains) {
        if (fonction.nom in exemptions) continue;
        it(`${fonction.nom} expire le tag`, () => {
          expect(fonction.corps).toMatch(cible.expiration);
        });
      }

      it("n'exempte que des fonctions qui existent et écrivent encore", () => {
        for (const nom of Object.keys(exemptions)) {
          const fonction = fonctions.find((f) => f.nom === nom);
          expect(fonction, `exemption périmée : ${nom} n'existe plus`).toBeDefined();
        }
      });

      for (const nom of cible.seulement ?? []) {
        it(`${nom} existe toujours (liste « seulement » à jour)`, () => {
          expect(fonctions.some((f) => f.nom === nom)).toBe(true);
        });
      }
    });
  }

  it("le helper des ingrédients libres expire le tag des recettes", () => {
    const helper = extraireFonctions(lire("src/app/actions/recette-ingredients-libres.ts")).find(
      (f) => f.nom === "revalidateRecette"
    );
    expect(helper?.corps).toMatch(/updateTag\(RECETTES_TAG\)/);
  });

  it("revalidateTachesPaths expire le tag des tâches", () => {
    const helper = extraireFonctions(lire("src/app/actions/taches.ts")).find(
      (f) => f.nom === "revalidateTachesPaths"
    );
    expect(helper?.corps).toMatch(/expirerCacheTaches\(\)/);
  });

  it("les helpers de revalidation du Budget expirent le tag du Budget", () => {
    for (const [fichier, nom] of [
      ["src/app/actions/transactions.ts", "revalidateTransactionPaths"],
      ["src/app/actions/transactions-recurrentes.ts", "revalidateRecurrencePaths"],
    ]) {
      const helper = extraireFonctions(lire(fichier)).find((f) => f.nom === nom);
      expect(helper?.corps, nom).toMatch(/updateTag\(BUDGET_TAG\)/);
    }
  });

  it("deleteTag expire aussi le tag des notes (table tags partagée)", () => {
    const fonction = extraireFonctions(lire("src/app/actions/taches.ts")).find((f) => f.nom === "deleteTag");
    expect(fonction?.corps).toMatch(/revalidateTag\(NOTES_TAG/);
  });

  it("la route reporter-rappel (écriture hors Server Action) expire le tag des tâches", () => {
    const route = lire("src/app/api/taches/[id]/reporter-rappel/route.ts");
    expect(route).toMatch(/revalidateTag\(TACHES_TAG, \{ expire: 0 \}\)/);
  });
});
