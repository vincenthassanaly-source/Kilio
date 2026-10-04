// Illustration « silhouette en aplats » d'un exercice : géométrie pure, sans
// React, pour être partagée par le composant (IllustrationExercice) et par les
// scripts (planche de validation des poses). Une illustration = 2 poses
// (départ / arrivée) de 15 articulations dans un repère 200 × 260 ; le
// mouvement est l'interpolation entre les deux.

export const LARGEUR_VUE = 200;
export const HAUTEUR_VUE = 260;

/** Ordre des articulations stockées (G/D = côté gauche/droit du sujet). */
export const ARTICULATIONS = [
  "tete", "epauleG", "epauleD", "coudeG", "coudeD", "poignetG", "poignetD",
  "hancheG", "hancheD", "genouG", "genouD", "chevilleG", "chevilleD", "pointeG", "pointeD",
] as const;

export type Point = readonly [number, number];
export type Pose = readonly Point[];
export type PosesExercice = { v: 1; a: Pose; b: Pose };

const I = Object.fromEntries(ARTICULATIONS.map((nom, i) => [nom, i])) as Record<(typeof ARTICULATIONS)[number], number>;

/** Zones du corps qu'un muscle peut mettre en couleur. */
export type Zone = "epaules" | "tronc_haut" | "tronc_bas" | "hanches" | "cuisses" | "mollets" | "bras_haut" | "avant_bras" | "cou";

const ZONES_PAR_MUSCLE: Record<string, readonly Zone[]> = {
  chest: ["tronc_haut"],
  shoulders: ["epaules"],
  biceps: ["bras_haut"],
  triceps: ["bras_haut"],
  forearms: ["avant_bras"],
  lats: ["tronc_haut"],
  "middle back": ["tronc_haut"],
  "lower back": ["tronc_bas"],
  traps: ["tronc_haut", "cou"],
  neck: ["cou"],
  abdominals: ["tronc_bas"],
  quadriceps: ["cuisses"],
  hamstrings: ["cuisses"],
  glutes: ["hanches"],
  calves: ["mollets"],
  adductors: ["cuisses"],
  abductors: ["cuisses", "hanches"],
};

export function zonesDuMuscle(muscle: string): readonly Zone[] {
  return ZONES_PAR_MUSCLE[muscle] ?? [];
}

/** Un élément à dessiner : trait épais (`d`) ou disque. `cible` = muscle travaillé. */
export type Forme =
  | { type: "trait"; d: string; largeur: number; cible: boolean; arriere: boolean }
  | { type: "disque"; cx: number; cy: number; r: number; cible: boolean; arriere: boolean };

export type Silhouette = {
  formes: Forme[];
  /** Ordonnée du sol (constante sur tout le mouvement). */
  sol: number;
};

const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const estPose = (p: unknown): p is Pose =>
  Array.isArray(p) &&
  p.length === ARTICULATIONS.length &&
  p.every((pt) => Array.isArray(pt) && pt.length === 2 && nombre(pt[0]) && nombre(pt[1]));

/** Valide une valeur lue en base (jsonb) : `null` si elle n'a pas la forme attendue. */
export function lirePoses(valeur: unknown): PosesExercice | null {
  if (typeof valeur !== "object" || valeur === null) return null;
  const { v, a, b } = valeur as Record<string, unknown>;
  return v === 1 && estPose(a) && estPose(b) ? { v: 1, a, b } : null;
}

const milieu = (p: Point, q: Point): Point => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const entre = (p: Point, q: Point, t: number): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const chemin = (...pts: Point[]) => "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L");

function longueurTronc(p: Pose): number {
  return distance(milieu(p[I.epauleG], p[I.epauleD]), milieu(p[I.hancheG], p[I.hancheD]));
}

/** Silhouette à l'instant `t` (0 = départ, 1 = arrivée) ; `zones` = muscles à colorer. */
export function construireSilhouette(poses: PosesExercice, t: number, zones: readonly Zone[]): Silhouette {
  const pose: Point[] = poses.a.map((pa, i) => entre(pa, poses.b[i], t));
  // Épaisseurs figées sur la moyenne des deux poses : pas de pulsation pendant le mouvement.
  const tronc = Math.max(24, (longueurTronc(poses.a) + longueurTronc(poses.b)) / 2);
  const w = { tronc: tronc * 0.34, jambe: tronc * 0.26, bras: tronc * 0.2, tete: tronc * 0.26 };
  const cible = (z: Zone) => zones.includes(z);
  const formes: Forme[] = [];

  // Membre d'un côté ; le côté droit passe derrière (`arriere`) pour la profondeur.
  const membres = (cote: "G" | "D") => {
    const arriere = cote === "D";
    const p = (nom: (typeof ARTICULATIONS)[number]) => pose[I[nom]];
    const hanche = p(`hanche${cote}`), genou = p(`genou${cote}`), cheville = p(`cheville${cote}`), pointe = p(`pointe${cote}`);
    const epaule = p(`epaule${cote}`), coude = p(`coude${cote}`), poignet = p(`poignet${cote}`);
    formes.push(
      { type: "trait", d: chemin(hanche, genou), largeur: w.jambe, cible: cible("cuisses"), arriere },
      { type: "trait", d: chemin(genou, cheville), largeur: w.jambe * 0.85, cible: cible("mollets"), arriere },
      { type: "trait", d: chemin(cheville, pointe), largeur: w.jambe * 0.6, cible: false, arriere },
      { type: "trait", d: chemin(epaule, coude), largeur: w.bras, cible: cible("bras_haut"), arriere },
      { type: "trait", d: chemin(coude, poignet), largeur: w.bras * 0.9, cible: cible("avant_bras"), arriere },
    );
  };
  membres("D");

  const epaules = milieu(pose[I.epauleG], pose[I.epauleD]);
  const hanches = milieu(pose[I.hancheG], pose[I.hancheD]);
  const separation = entre(epaules, hanches, 0.55);
  formes.push(
    { type: "trait", d: chemin(epaules, separation), largeur: w.tronc, cible: cible("tronc_haut"), arriere: false },
    { type: "trait", d: chemin(separation, hanches), largeur: w.tronc * 0.95, cible: cible("tronc_bas"), arriere: false },
    // Ceintures scapulaire et pelvienne : donnent de la largeur de face, s'écrasent de profil.
    { type: "trait", d: chemin(pose[I.epauleG], pose[I.epauleD]), largeur: w.bras * 1.1, cible: cible("epaules"), arriere: false },
    { type: "trait", d: chemin(pose[I.hancheG], pose[I.hancheD]), largeur: w.jambe * 0.9, cible: cible("hanches"), arriere: false },
    { type: "trait", d: chemin(pose[I.tete], epaules), largeur: w.bras * 0.8, cible: cible("cou"), arriere: false },
  );
  membres("G");
  if (cible("epaules")) {
    for (const cote of ["G", "D"] as const) {
      const [cx, cy] = pose[I[`epaule${cote}`]];
      formes.push({ type: "disque", cx, cy, r: w.bras * 0.75, cible: true, arriere: false });
    }
  }
  formes.push({ type: "disque", cx: pose[I.tete][0], cy: pose[I.tete][1], r: w.tete, cible: false, arriere: false });

  const sol = Math.max(...poses.a.map((p) => p[1]), ...poses.b.map((p) => p[1])) + w.jambe * 0.3;
  return { formes, sol: Math.min(sol, HAUTEUR_VUE - 4) };
}
