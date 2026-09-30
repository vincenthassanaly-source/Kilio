// Contenu d'une notion : texte simple, avec une syntaxe légère optionnelle
// pour colorer une LIGNE entière : `[vert] Normale : 0,70 – 1,10 g/L`.
// Module neutre (aucun React) : partagé par le rendu, l'éditeur et la
// recherche. Un contenu sans balise reste un bloc de texte inchangé.
//
// Source unique des couleurs : META_NIVEAU. NIVEAUX en est dérivé, donc le
// parsing, l'éditeur et le rendu suivent toute couleur ajoutée ici (plus son
// pictogramme dans ContenuColore et ses jetons dans globals.css). Les 5
// premières ont un sens fixe ; les 7 suivantes distinguent des catégories.

export type MetaNiveau = {
  /** Libellé lu par les lecteurs d'écran (la couleur n'est jamais seule). */
  libelle: string;
  /** Jeton de couleur du thème (déjà défini en clair et en sombre). */
  couleur: string;
};

export const META_NIVEAU = {
  bleu: { libelle: "Bas", couleur: "var(--accent-agenda)" },
  vert: { libelle: "Normal", couleur: "var(--accent-kcal)" },
  orange: { libelle: "À surveiller", couleur: "var(--accent-warning)" },
  rouge: { libelle: "Danger", couleur: "var(--accent-alert)" },
  gris: { libelle: "Repère", couleur: "var(--ink-3)" },
  violet: { libelle: "Violet", couleur: "var(--niveau-violet)" },
  rose: { libelle: "Rose", couleur: "var(--niveau-rose)" },
  jaune: { libelle: "Jaune", couleur: "var(--niveau-jaune)" },
  turquoise: { libelle: "Turquoise", couleur: "var(--niveau-turquoise)" },
  marron: { libelle: "Marron", couleur: "var(--niveau-marron)" },
  indigo: { libelle: "Indigo", couleur: "var(--niveau-indigo)" },
  lime: { libelle: "Lime", couleur: "var(--niveau-lime)" },
} as const satisfies Record<string, MetaNiveau>;

export type Niveau = keyof typeof META_NIVEAU;
export const NIVEAUX = Object.keys(META_NIVEAU) as Niveau[];

export type BlocContenu =
  | { type: "texte"; texte: string }
  | { type: "niveau"; niveau: Niveau; texte: string };

// Balise reconnue uniquement en début de ligne, avec un texte derrière :
// `[1]`, `[vert]` seul ou `[fuchsia] …` restent du texte ordinaire.
const BALISE_LIGNE = new RegExp(`^\\[(${NIVEAUX.join("|")})\\][ \\t]*(\\S.*)$`, "i");
const BALISE_DEBUT = new RegExp(`^\\[(?:${NIVEAUX.join("|")})\\][ \\t]*`, "i");

function lireLigne(ligne: string): { niveau: Niveau; texte: string } | null {
  const m = BALISE_LIGNE.exec(ligne);
  return m ? { niveau: m[1].toLowerCase() as Niveau, texte: m[2] } : null;
}

export function parseContenu(contenu: string): BlocContenu[] {
  const lignes = contenu.split("\n");
  if (!lignes.some((l) => lireLigne(l))) return [{ type: "texte", texte: contenu }];

  const blocs: BlocContenu[] = [];
  let texte: string[] = [];
  const viderTexte = () => {
    if (texte.length > 0) blocs.push({ type: "texte", texte: texte.join("\n") });
    texte = [];
  };
  for (const ligne of lignes) {
    const lue = lireLigne(ligne);
    if (lue) {
      viderTexte();
      blocs.push({ type: "niveau", ...lue });
    } else {
      texte.push(ligne);
    }
  }
  viderTexte();
  return blocs;
}

export function contientNiveau(contenu: string): boolean {
  return contenu.split("\n").some((l) => lireLigne(l));
}

/** Contenu sans balises (recherche, extraits) : le texte des lignes colorées est conservé. */
export function enTexteBrut(contenu: string): string {
  return contenu
    .split("\n")
    .map((l) => lireLigne(l)?.texte ?? l)
    .join("\n");
}

export type Edition = { texte: string; debut: number; fin: number };

/**
 * Pose (ou retire, avec `niveau = null`) la couleur sur toutes les lignes
 * touchées par la sélection `[debut, fin]` d'un champ de saisie. Une ligne
 * vide n'est balisée que si elle est seule à être visée (curseur sur une
 * ligne neuve). Renvoie le nouveau texte et la sélection à restaurer.
 */
export function appliquerNiveau(texte: string, debut: number, fin: number, niveau: Niveau | null): Edition {
  const a = Math.max(0, Math.min(debut, fin));
  const b = Math.min(texte.length, Math.max(debut, fin));
  const debutLignes = texte.lastIndexOf("\n", a - 1) + 1;
  const suivant = texte.indexOf("\n", b);
  const finLignes = suivant === -1 ? texte.length : suivant;

  const lignes = texte.slice(debutLignes, finLignes).split("\n");
  const seule = lignes.length === 1;
  const modifiees = lignes.map((ligne) => {
    const nue = ligne.replace(BALISE_DEBUT, "");
    if (niveau === null) return nue;
    if (nue.trim() === "" && !seule) return nue;
    return `[${niveau}] ${nue}`;
  });

  const bloc = modifiees.join("\n");
  const nouveau = texte.slice(0, debutLignes) + bloc + texte.slice(finLignes);
  const finBloc = debutLignes + bloc.length;
  return a === b
    ? { texte: nouveau, debut: finBloc, fin: finBloc }
    : { texte: nouveau, debut: debutLignes, fin: finBloc };
}
