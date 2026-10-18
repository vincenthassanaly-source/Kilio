// Partis, programmes et propositions : types, calculs purs (profil d'un parti,
// proximité avec mon profil, placement des marqueurs) et nettoyage des saisies.
// Module neutre : importé côté serveur et client.
//
// Règle d'équité : une proposition est notée sur ce que dit le programme,
// avec les mêmes pôles d'axes pour tous les partis (voir AXES dans types.ts).
import { POIDS_CONVICTION, type AxeProfil, type IdeePourProfil } from "./profil";
import { AXES, POSITION_MAX, estScore, estTheme, scoresVides, type AxeId, type Scores, type Theme } from "./types";

// --- Priorités par thème -------------------------------------------------------

export const NIVEAUX = ["secondaire", "normal", "prioritaire"] as const;
export type Niveau = (typeof NIVEAUX)[number];

export const LIBELLE_NIVEAU: Record<Niveau, string> = {
  secondaire: "Secondaire",
  normal: "Normal",
  prioritaire: "Prioritaire",
};

/** Poids d'un thème dans la proximité. */
const POIDS_NIVEAU: Record<Niveau, number> = { secondaire: 0.5, normal: 1, prioritaire: 2 };

export function estNiveau(valeur: unknown): valeur is Niveau {
  return typeof valeur === "string" && (NIVEAUX as readonly string[]).includes(valeur);
}

/** Un thème absent vaut « normal ». */
export type Priorites = Partial<Record<Theme, Niveau>>;

// --- Données -----------------------------------------------------------------

export type PropositionParti = { id: string; position: string; theme: Theme; scores: Scores };

export type ProgrammeParti = {
  id: string;
  echeance: string;
  /** « YYYY-MM-DD » ou null. */
  date_programme: string | null;
  created_at: string;
  propositions: PropositionParti[];
};

export type PartiComplet = { id: string; nom: string; sigle: string; programmes: ProgrammeParti[] };

/** Le sigle quand il existe (court, tient dans un marqueur), sinon le nom. */
export function libelleParti(parti: Pick<PartiComplet, "nom" | "sigle">): string {
  return parti.sigle.trim() || parti.nom;
}

type ColonnesScores = {
  score_economique: number | null;
  score_societal: number | null;
  score_autorite: number | null;
  score_ecologie: number | null;
  score_identite: number | null;
};

/** Lecture tolérante : un score hors domaine devient « non concerné ». */
export function scoresDepuisColonnes(ligne: ColonnesScores): Scores {
  const score = (valeur: number | null) => (estScore(valeur) ? valeur : null);
  return {
    economique: score(ligne.score_economique),
    societal: score(ligne.score_societal),
    autorite: score(ligne.score_autorite),
    ecologie: score(ligne.score_ecologie),
    identite: score(ligne.score_identite),
  };
}

export function colonnesDepuisScores(scores: Scores): ColonnesScores {
  return {
    score_economique: scores.economique,
    score_societal: scores.societal,
    score_autorite: scores.autorite,
    score_ecologie: scores.ecologie,
    score_identite: scores.identite,
  };
}

// --- Programme le plus récent ----------------------------------------------------

// Une date de publication prime sur son absence ; à date égale, le dernier créé.
// Les dates ISO se comparent correctement comme des chaînes.
function estPlusRecent(a: ProgrammeParti, b: ProgrammeParti): boolean {
  if (a.date_programme !== b.date_programme) {
    if (a.date_programme === null) return false;
    if (b.date_programme === null) return true;
    return a.date_programme > b.date_programme;
  }
  return a.created_at > b.created_at;
}

export function programmesParRecence(programmes: readonly ProgrammeParti[]): ProgrammeParti[] {
  return [...programmes].sort((a, b) => (estPlusRecent(a, b) ? -1 : estPlusRecent(b, a) ? 1 : 0));
}

export function programmeRecent(programmes: readonly ProgrammeParti[]): ProgrammeParti | null {
  return programmesParRecence(programmes)[0] ?? null;
}

// --- Profil d'un parti ---------------------------------------------------------

/** Moyenne simple, par axe, des propositions qui le touchent (toutes pèsent pareil). */
export function moyennesParAxe(propositions: readonly { scores: Scores }[]): AxeProfil[] {
  return AXES.map((axe) => {
    let somme = 0;
    let nombre = 0;
    for (const proposition of propositions) {
      const score = proposition.scores[axe.id];
      if (score === null) continue;
      somme += score;
      nombre += 1;
    }
    return { axe, moyenne: nombre === 0 ? null : somme / nombre, nombre };
  });
}

/** « −0,8 », « +1,5 », « 0,0 » (vrai signe moins, virgule décimale). */
export function formaterMoyenne(moyenne: number): string {
  const arrondie = Math.round(moyenne * 10) / 10;
  const texte = Math.abs(arrondie).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (arrondie > 0) return `+${texte}`;
  if (arrondie < 0) return `−${texte}`;
  return texte;
}

// --- Proximité avec mon profil ---------------------------------------------------

export type Proximite = {
  /** 0 à 100. */
  pourcentage: number;
  /** Couples (thème, axe) sur lesquels le parti et moi avons une position. */
  comparees: number;
  /** Couples (thème, axe) sur lesquels j'ai une position (idées validées). */
  miennes: number;
};

const ECART_MAX = 4; // de -2 à +2

function cle(theme: Theme, axe: AxeId): string {
  return `${theme}|${axe}`;
}

/**
 * Proximité de positions, thème par thème et axe par axe, uniquement là où le
 * parti et moi avons chacun une position. Mes positions viennent de mes idées
 * validées (moyenne pondérée par la conviction) ; celles du parti, de ses
 * propositions (moyenne simple). Chaque couple pèse selon l'importance que je
 * donne à son thème. Ce n'est pas une recommandation de vote : la couverture
 * (`comparees` sur `miennes`) dit sur quelle part de mes positions elle repose.
 */
export function calculerProximite(
  idees: readonly IdeePourProfil[],
  propositions: readonly PropositionParti[],
  priorites: Priorites = {}
): Proximite | null {
  const miennes = new Map<string, { theme: Theme; somme: number; poids: number }>();
  for (const idee of idees) {
    if (idee.statut !== "validee" || idee.theme === null) continue;
    const poids = POIDS_CONVICTION[idee.conviction];
    for (const axe of AXES) {
      const score = idee.scores[axe.id];
      if (score === null) continue;
      const entree = miennes.get(cle(idee.theme, axe.id)) ?? { theme: idee.theme, somme: 0, poids: 0 };
      entree.somme += score * poids;
      entree.poids += poids;
      miennes.set(cle(idee.theme, axe.id), entree);
    }
  }
  if (miennes.size === 0) return null;

  const partis = new Map<string, { somme: number; nombre: number }>();
  for (const proposition of propositions) {
    for (const axe of AXES) {
      const score = proposition.scores[axe.id];
      if (score === null) continue;
      const entree = partis.get(cle(proposition.theme, axe.id)) ?? { somme: 0, nombre: 0 };
      entree.somme += score;
      entree.nombre += 1;
      partis.set(cle(proposition.theme, axe.id), entree);
    }
  }

  let sommePoids = 0;
  let sommeSimilarite = 0;
  let comparees = 0;
  for (const [clef, moi] of miennes) {
    const parti = partis.get(clef);
    if (!parti) continue;
    const ecart = Math.abs(moi.somme / moi.poids - parti.somme / parti.nombre);
    const poids = POIDS_NIVEAU[priorites[moi.theme] ?? "normal"];
    sommePoids += poids;
    sommeSimilarite += poids * (1 - ecart / ECART_MAX);
    comparees += 1;
  }
  if (comparees === 0) return null;

  return { pourcentage: Math.round((sommeSimilarite / sommePoids) * 100), comparees, miennes: miennes.size };
}

export type PartiClasse = { parti: PartiComplet; programme: ProgrammeParti | null; proximite: Proximite | null };

/** Partis du plus proche au plus éloigné (programme le plus récent) ; sans donnée en dernier. */
export function classerPartis(
  partis: readonly PartiComplet[],
  idees: readonly IdeePourProfil[],
  priorites: Priorites = {}
): PartiClasse[] {
  return partis
    .map((parti) => {
      const programme = programmeRecent(parti.programmes);
      return { parti, programme, proximite: programme ? calculerProximite(idees, programme.propositions, priorites) : null };
    })
    .sort(
      (a, b) =>
        (b.proximite?.pourcentage ?? -1) - (a.proximite?.pourcentage ?? -1) ||
        libelleParti(a.parti).localeCompare(libelleParti(b.parti), "fr")
    );
}

// --- Marqueurs sur une piste d'axe ------------------------------------------------

export type Marqueur = { id: string; libelle: string; valeur: number; moi?: boolean };
export type MarqueurPlace = Marqueur & { pourcent: number; ligne: number };

// Estimation de la piste (mobile) pour éviter que deux étiquettes se chevauchent :
// elles sont rangées sur des lignes successives quand elles se gênent.
const LARGEUR_PISTE_PX = 300;
const LARGEUR_CARACTERE_PX = 7;
const MARGE_ETIQUETTE_PX = 16;
const ESPACE_ETIQUETTES_PX = 4;

export function placerMarqueurs(marqueurs: readonly Marqueur[]): { places: MarqueurPlace[]; lignes: number } {
  const tries = [...marqueurs].sort((a, b) => a.valeur - b.valeur || a.libelle.localeCompare(b.libelle, "fr"));
  const finsDeLigne: number[] = [];
  const places = tries.map((marqueur) => {
    const pourcent = Math.min(100, Math.max(0, ((marqueur.valeur + 2) / 4) * 100));
    const largeur = marqueur.libelle.length * LARGEUR_CARACTERE_PX + MARGE_ETIQUETTE_PX;
    const centre = (pourcent / 100) * LARGEUR_PISTE_PX;
    let ligne = finsDeLigne.findIndex((fin) => fin + ESPACE_ETIQUETTES_PX <= centre - largeur / 2);
    if (ligne === -1) {
      ligne = finsDeLigne.length;
      finsDeLigne.push(0);
    }
    finsDeLigne[ligne] = centre + largeur / 2;
    return { ...marqueur, pourcent, ligne };
  });
  return { places, lignes: Math.max(1, finsDeLigne.length) };
}

// --- Nettoyage des saisies --------------------------------------------------------

export const NOM_PARTI_MAX = 80;
export const SIGLE_MAX = 12;
export const ECHEANCE_MAX = 80;

export function nettoyerParti(nom: string, sigle: string): { nom: string; sigle: string } | string {
  const nomPropre = nom.trim();
  if (!nomPropre) return "Le nom du parti est requis.";
  if (nomPropre.length > NOM_PARTI_MAX) return `Le nom dépasse ${NOM_PARTI_MAX} caractères.`;
  const siglePropre = sigle.trim();
  if (siglePropre.length > SIGLE_MAX) return `Le sigle dépasse ${SIGLE_MAX} caractères.`;
  return { nom: nomPropre, sigle: siglePropre };
}

function estDateIso(valeur: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const date = new Date(`${valeur}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valeur;
}

export function nettoyerProgramme(
  echeance: string,
  date: string | null
): { echeance: string; date_programme: string | null } | string {
  const echeancePropre = echeance.trim();
  if (!echeancePropre) return "L'échéance est requise.";
  if (echeancePropre.length > ECHEANCE_MAX) return `L'échéance dépasse ${ECHEANCE_MAX} caractères.`;
  const datePropre = date?.trim() || null;
  if (datePropre !== null && !estDateIso(datePropre)) return "La date est invalide.";
  return { echeance: echeancePropre, date_programme: datePropre };
}

export type ChampsProposition = { position: string; theme: Theme | null; scores: Scores };

export function nettoyerProposition(
  champs: ChampsProposition
): { position: string; theme: Theme; scores: Scores } | string {
  const position = champs.position.trim();
  if (!position) return "La proposition est requise.";
  if (position.length > POSITION_MAX) return `La proposition dépasse ${POSITION_MAX} caractères.`;
  if (!estTheme(champs.theme)) return "Choisis un thème.";

  const scores = scoresVides();
  for (const axe of AXES) {
    const score = champs.scores[axe.id];
    if (score !== null && !estScore(score)) return `Score invalide pour l'axe « ${axe.label} ».`;
    scores[axe.id] = score;
  }
  return { position, theme: champs.theme, scores };
}
