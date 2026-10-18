// Profil politique calculé à partir des idées : pur, sans accès base, testé.
// Seules les idées validées comptent ; chaque score est pondéré par le niveau
// de conviction (un acquis pèse plus qu'une hésitation).
import { AXES, THEMES, type Axe, type AxeId, type Conviction, type Scores, type Theme } from "./types";

export type IdeePourProfil = {
  id: string;
  position: string;
  statut: string;
  theme: Theme | null;
  conviction: Conviction;
  scores: Scores;
};

const POIDS: Record<Conviction, number> = { hesitant: 0.5, plutot: 1, certain: 1.5 };

export type AxeProfil = {
  axe: Axe;
  /** Moyenne pondérée sur [-2, 2], `null` si aucune idée validée ne touche l'axe. */
  moyenne: number | null;
  /** Nombre d'idées validées qui touchent l'axe. */
  nombre: number;
};

export function calculerProfil(idees: readonly IdeePourProfil[]): AxeProfil[] {
  const validees = idees.filter((i) => i.statut === "validee");
  return AXES.map((axe) => {
    let somme = 0;
    let poids = 0;
    let nombre = 0;
    for (const idee of validees) {
      const score = idee.scores[axe.id];
      if (score === null) continue;
      somme += score * POIDS[idee.conviction];
      poids += POIDS[idee.conviction];
      nombre += 1;
    }
    return { axe, moyenne: poids === 0 ? null : somme / poids, nombre };
  });
}

/** « Plutôt État », « Nettement Marché », « Équilibré » : le texte qui double la barre. */
export function decrireMoyenne(axe: Axe, moyenne: number | null): string {
  if (moyenne === null) return "Pas encore de position";
  const intensite = Math.abs(moyenne);
  if (intensite < 0.4) return "Équilibré";
  const pole = moyenne < 0 ? axe.gauche : axe.droite;
  return `${intensite < 1.2 ? "Plutôt" : "Nettement"} ${pole}`;
}

export type SujetACreuser = { theme: Theme; brouillons: number };

/** Thèmes sans aucune idée validée, avec le nombre de brouillons déjà en attente. */
export function sujetsACreuser(idees: readonly IdeePourProfil[]): SujetACreuser[] {
  const couverts = new Set(idees.filter((i) => i.statut === "validee" && i.theme).map((i) => i.theme));
  return THEMES.filter((theme) => !couverts.has(theme)).map((theme) => ({
    theme,
    brouillons: idees.filter((i) => i.statut === "brouillon" && i.theme === theme).length,
  }));
}

export type Tension = {
  axe: AxeId;
  theme: Theme;
  a: Pick<IdeePourProfil, "id" | "position">;
  b: Pick<IdeePourProfil, "id" | "position">;
  ecart: number;
};

/** Écart minimal entre deux scores d'un même axe pour parler de tension (ex. -2 et +1). */
const ECART_TENSION = 3;

/**
 * Paires d'idées validées d'un même thème dont les scores s'opposent sur un
 * même axe. Heuristique simple : à toi de juger si c'est une vraie
 * contradiction ou une nuance assumée.
 */
export function trouverTensions(idees: readonly IdeePourProfil[], max = 8): Tension[] {
  const validees = idees.filter((i) => i.statut === "validee" && i.theme !== null);
  const tensions: Tension[] = [];
  for (let i = 0; i < validees.length; i++) {
    for (let j = i + 1; j < validees.length; j++) {
      const a = validees[i];
      const b = validees[j];
      if (a.theme !== b.theme || a.theme === null) continue;
      for (const axe of AXES) {
        const sa = a.scores[axe.id];
        const sb = b.scores[axe.id];
        if (sa === null || sb === null) continue;
        const ecart = Math.abs(sa - sb);
        if (ecart >= ECART_TENSION) {
          tensions.push({
            axe: axe.id,
            theme: a.theme,
            a: { id: a.id, position: a.position },
            b: { id: b.id, position: b.position },
            ecart,
          });
        }
      }
    }
  }
  return tensions.sort((x, y) => y.ecart - x.ecart).slice(0, max);
}
