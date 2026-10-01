import type { Tables } from "@/lib/supabase/types";
import { normalizeSearch } from "@/lib/normalize";
import { aUneFauteDePres } from "./selecteurs";

// Référentiel médicaments : classes (arbre) > molécules (DCI) > spécialités
// (noms commerciaux), et pathologies > profils > lignes de traitement > items.
// Petit volume (quelques centaines de lignes de texte court) : un seul
// instantané, mis en cache (TanStack Query + Dexie) comme le cahier de cours.
export type PharmaClasse = Tables<"pharma_ref_classes">;
export type PharmaMolecule = Tables<"pharma_ref_molecules">;
export type PharmaSpecialite = Tables<"pharma_ref_specialites">;
export type PharmaPathologie = Tables<"pharma_ref_pathologies">;
export type PharmaLigne = Tables<"pharma_ref_lignes">;
export type PharmaLigneItem = Tables<"pharma_ref_ligne_items">;

export type PharmaRefSnapshot = {
  classes: PharmaClasse[];
  molecules: PharmaMolecule[];
  specialites: PharmaSpecialite[];
  pathologies: PharmaPathologie[];
  lignes: PharmaLigne[];
  items: PharmaLigneItem[];
  /** ISO : moment de la lecture serveur (affiché quand on lit la copie locale). */
  genereLe: string;
};

export const PROFIL_GENERAL = "Général";

export const LIBELLE_ROLE = {
  traitement: "Traitement",
  association: "Association possible",
  eviter: "À éviter",
} as const;

/** « 2 médicaments » en tête d’étape ; rien quand le nombre n’est pas renseigné. */
export function libelleNbMedicaments(nb: number | null | undefined): string | null {
  return nb ? `${nb} médicament${nb > 1 ? "s" : ""}` : null;
}

export type RoleItem = keyof typeof LIBELLE_ROLE;

export function estRoleItem(valeur: string): valeur is RoleItem {
  return valeur in LIBELLE_ROLE;
}

const parOrdre = <T extends { ordre: number }>(a: T, b: T) => a.ordre - b.ordre;
const parNom = (a: string, b: string) => a.localeCompare(b, "fr");

// ---------------------------------------------------------------- Classes

export function classesRacines(snap: PharmaRefSnapshot): PharmaClasse[] {
  return snap.classes.filter((c) => c.parent_id === null).sort(parOrdre);
}

export function sousClasses(snap: PharmaRefSnapshot, classeId: string): PharmaClasse[] {
  return snap.classes.filter((c) => c.parent_id === classeId).sort(parOrdre);
}

export function classeParId(snap: PharmaRefSnapshot, id: string): PharmaClasse | undefined {
  return snap.classes.find((c) => c.id === id);
}

/** De la racine à la classe (incluse) : « Cardiovasculaire › IEC ». */
export function cheminDeClasse(snap: PharmaRefSnapshot, classe: PharmaClasse): PharmaClasse[] {
  const chemin: PharmaClasse[] = [classe];
  let courante = classe;
  // Garde-fou contre un cycle accidentel de parent_id.
  for (let i = 0; i < 10 && courante.parent_id; i++) {
    const parent = classeParId(snap, courante.parent_id);
    if (!parent) break;
    chemin.unshift(parent);
    courante = parent;
  }
  return chemin;
}

export function moleculesDeClasse(snap: PharmaRefSnapshot, classeId: string): PharmaMolecule[] {
  return snap.molecules.filter((m) => m.classe_id === classeId).sort((a, b) => parNom(a.dci, b.dci));
}

/** Nombre de molécules dans la classe et ses sous-classes. */
export function nbMoleculesDeClasse(snap: PharmaRefSnapshot, classeId: string): number {
  const directes = snap.molecules.filter((m) => m.classe_id === classeId).length;
  return sousClasses(snap, classeId).reduce((total, sc) => total + nbMoleculesDeClasse(snap, sc.id), directes);
}

// ------------------------------------------------------------- Molécules

export function moleculeParId(snap: PharmaRefSnapshot, id: string): PharmaMolecule | undefined {
  return snap.molecules.find((m) => m.id === id);
}

export function specialitesDeMolecule(snap: PharmaRefSnapshot, moleculeId: string): PharmaSpecialite[] {
  return snap.specialites.filter((s) => s.molecule_id === moleculeId).sort((a, b) => parNom(a.nom, b.nom));
}

/** Molécules A→Z, regroupées par initiale (pour l’index alphabétique). */
export function moleculesParInitiale(snap: PharmaRefSnapshot): { initiale: string; molecules: PharmaMolecule[] }[] {
  const groupes = new Map<string, PharmaMolecule[]>();
  const tries = [...snap.molecules].sort((a, b) => parNom(a.dci, b.dci));
  for (const molecule of tries) {
    const initiale = normalizeSearch(molecule.dci).charAt(0).toUpperCase() || "#";
    groupes.set(initiale, [...(groupes.get(initiale) ?? []), molecule]);
  }
  return [...groupes].map(([initiale, molecules]) => ({ initiale, molecules }));
}

/** Composants d’une association fixe, résolus en molécules quand elles existent. */
export function composantsDeMolecule(snap: PharmaRefSnapshot, molecule: PharmaMolecule): { nom: string; molecule?: PharmaMolecule }[] {
  return molecule.composants.map((nom) => ({
    nom,
    molecule: snap.molecules.find((m) => normalizeSearch(m.dci) === normalizeSearch(nom)),
  }));
}

// ----------------------------------------------------------- Pathologies

export type ItemResolu = { item: PharmaLigneItem; classe?: PharmaClasse; molecule?: PharmaMolecule };
export type LigneResolue = { ligne: PharmaLigne; items: ItemResolu[] };
export type ProfilPathologie = { profil: string; lignes: LigneResolue[] };

export function pathologieParId(snap: PharmaRefSnapshot, id: string): PharmaPathologie | undefined {
  return snap.pathologies.find((p) => p.id === id);
}

function resoudreItem(snap: PharmaRefSnapshot, item: PharmaLigneItem): ItemResolu {
  return {
    item,
    classe: item.classe_id ? classeParId(snap, item.classe_id) : undefined,
    molecule: item.molecule_id ? moleculeParId(snap, item.molecule_id) : undefined,
  };
}

/** Profils d’une pathologie (« Général » en tête) avec leurs lignes ordonnées (1re, 2e, 3e…). */
export function profilsDePathologie(snap: PharmaRefSnapshot, pathologieId: string): ProfilPathologie[] {
  const lignes = snap.lignes.filter((l) => l.pathologie_id === pathologieId);
  const parProfil = new Map<string, PharmaLigne[]>();
  for (const ligne of lignes) parProfil.set(ligne.profil, [...(parProfil.get(ligne.profil) ?? []), ligne]);

  const profils = [...parProfil.keys()].sort((a, b) =>
    a === PROFIL_GENERAL ? -1 : b === PROFIL_GENERAL ? 1 : parNom(a, b)
  );
  return profils.map((profil) => ({
    profil,
    lignes: (parProfil.get(profil) ?? [])
      .sort((a, b) => a.rang - b.rang)
      .map((ligne) => ({
        ligne,
        items: snap.items
          .filter((i) => i.ligne_id === ligne.id)
          .sort(parOrdre)
          .map((i) => resoudreItem(snap, i)),
      })),
  }));
}

function pathologiesDepuisItems(snap: PharmaRefSnapshot, items: PharmaLigneItem[]): PharmaPathologie[] {
  const ligneIds = new Set(items.map((i) => i.ligne_id));
  const pathologieIds = new Set(snap.lignes.filter((l) => ligneIds.has(l.id)).map((l) => l.pathologie_id));
  return snap.pathologies.filter((p) => pathologieIds.has(p.id)).sort(parOrdre);
}

/** Pathologies où la classe (ou l’une de ses sous-classes) figure dans un protocole. */
export function pathologiesDeClasse(snap: PharmaRefSnapshot, classeId: string): PharmaPathologie[] {
  const ids = new Set<string>();
  const collecter = (id: string) => {
    ids.add(id);
    sousClasses(snap, id).forEach((sc) => collecter(sc.id));
  };
  collecter(classeId);
  return pathologiesDepuisItems(snap, snap.items.filter((i) => i.classe_id !== null && ids.has(i.classe_id)));
}

/** Pathologies où la molécule est citée, directement ou via sa classe. */
export function pathologiesDeMolecule(snap: PharmaRefSnapshot, molecule: PharmaMolecule): PharmaPathologie[] {
  return pathologiesDepuisItems(
    snap,
    snap.items.filter((i) => i.molecule_id === molecule.id || i.classe_id === molecule.classe_id)
  );
}

// -------------------------------------------------------------- Recherche

export type ResultatReferentiel = {
  type: "molecule" | "classe" | "pathologie";
  id: string;
  titre: string;
  detail: string;
  score: number;
};

function scoreMot(mot: string, champ: string, motsChamp: string[]): number {
  if (champ === mot) return 4;
  if (champ.startsWith(mot)) return 3;
  if (champ.includes(mot)) return 2;
  if (mot.length >= 4 && motsChamp.some((m) => aUneFauteDePres(mot, m))) return 0.5;
  return 0;
}

// Recherche 100 % locale (hors ligne) : sans accents ni casse ; chaque mot de
// la requête doit apparaître dans au moins un des champs d’un résultat.
// DCI et noms commerciaux pèsent plus que les indications.
export function rechercherReferentiel(snap: PharmaRefSnapshot, requete: string): ResultatReferentiel[] {
  const mots = normalizeSearch(requete).split(/\s+/).filter((m) => m.length >= 2);
  if (mots.length === 0) return [];

  const classeParMolecule = new Map(snap.classes.map((c) => [c.id, c]));
  const marquesParMolecule = new Map<string, PharmaSpecialite[]>();
  for (const s of snap.specialites) {
    marquesParMolecule.set(s.molecule_id, [...(marquesParMolecule.get(s.molecule_id) ?? []), s]);
  }

  const resultats: ResultatReferentiel[] = [];

  for (const molecule of snap.molecules) {
    const classe = classeParMolecule.get(molecule.classe_id);
    const marques = marquesParMolecule.get(molecule.id) ?? [];
    const dci = normalizeSearch(molecule.dci);
    const nomsClasse = normalizeSearch(classe?.nom ?? "");
    const marquesTexte = marques.map((s) => normalizeSearch(s.nom));
    const indications = normalizeSearch(molecule.indications.join(" "));
    const composants = normalizeSearch(molecule.composants.join(" "));
    const motsDci = dci.split(/[^a-z0-9]+/).filter(Boolean);

    let total = 0;
    let trouve = true;
    let marqueTrouvee: string | undefined;
    for (const mot of mots) {
      const scoreDci = scoreMot(mot, dci, motsDci);
      const scoreMarque = Math.max(0, ...marquesTexte.map((m) => scoreMot(mot, m, m.split(/[^a-z0-9]+/).filter(Boolean))));
      const meilleur = Math.max(
        scoreDci * 3,
        scoreMarque * 3,
        composants.includes(mot) ? 4 : 0,
        nomsClasse.includes(mot) ? 2 : 0,
        indications.includes(mot) ? 1 : 0
      );
      if (meilleur === 0) {
        trouve = false;
        break;
      }
      if (scoreMarque > 0 && scoreMarque * 3 === meilleur && !marqueTrouvee) {
        marqueTrouvee = marques.find((s) => normalizeSearch(s.nom).includes(mot))?.nom;
      }
      total += meilleur;
    }
    if (!trouve) continue;

    const detail = marqueTrouvee ? `${marqueTrouvee} · ${classe?.nom ?? ""}` : (classe?.nom ?? "");
    resultats.push({ type: "molecule", id: molecule.id, titre: molecule.dci, detail, score: total + 10 });
  }

  for (const classe of snap.classes) {
    const nom = normalizeSearch(classe.nom);
    const mecanisme = normalizeSearch(classe.mecanisme ?? "");
    let total = 0;
    let trouve = true;
    for (const mot of mots) {
      const s = scoreMot(mot, nom, nom.split(/[^a-z0-9]+/).filter(Boolean)) * 3 || (mecanisme.includes(mot) ? 1 : 0);
      if (s === 0) {
        trouve = false;
        break;
      }
      total += s;
    }
    if (trouve) {
      const nb = nbMoleculesDeClasse(snap, classe.id);
      resultats.push({
        type: "classe",
        id: classe.id,
        titre: classe.nom,
        detail: nb > 0 ? `Classe · ${nb} molécule${nb > 1 ? "s" : ""}` : "Classe",
        score: total + 8,
      });
    }
  }

  for (const pathologie of snap.pathologies) {
    const nom = normalizeSearch(pathologie.nom);
    let total = 0;
    let trouve = true;
    for (const mot of mots) {
      const s = scoreMot(mot, nom, nom.split(/[^a-z0-9]+/).filter(Boolean)) * 3;
      if (s === 0) {
        trouve = false;
        break;
      }
      total += s;
    }
    if (trouve) {
      resultats.push({ type: "pathologie", id: pathologie.id, titre: pathologie.nom, detail: "Pathologie · protocoles", score: total + 9 });
    }
  }

  return resultats.sort((a, b) => b.score - a.score || parNom(a.titre, b.titre)).slice(0, 50);
}

export function hrefResultat(r: Pick<ResultatReferentiel, "type" | "id">): string {
  const base = "/pharmacie/referentiel";
  return r.type === "molecule"
    ? `${base}/medicament/${r.id}`
    : r.type === "classe"
      ? `${base}/classe/${r.id}`
      : `${base}/pathologie/${r.id}`;
}
