import { estDateValide, normaliserTexte, texteOuNull } from "@/lib/saisie-ia/outils";
import {
  MOMENTS_REPAS,
  momentParDefaut,
  type CatalogueItem,
  type MomentRepas,
} from "./compute";

// Module Repas de « Ajouter avec l'IA » : logique pure (aucun réseau, aucune
// base). Gemini propose ce que Vincent a mangé et le nom exact du catalogue
// qui correspond ; ce module ne retient qu'une correspondance EXACTE, convertit
// la quantité comme le fait le formulaire d'ajout, et ne calcule jamais de
// valeur nutritionnelle qui ne vienne pas du catalogue. Ce qui ne se résout pas
// reste « à préciser » : le journal exige un aliment ou une recette.

export const MAX_REPAS_PROPOSES = 12;
const MAX_NOM = 60;
const MAX_QUANTITE = 10_000;
const MAX_NOMS_PROMPT = 800;

export type CibleRepas = { type: "aliment" | "recette"; id: string };

export type RepasPropose = {
  /** Nom du catalogue s'il y a correspondance, sinon ce que Vincent a dit. */
  nom: string;
  cible: CibleRepas | null;
  /** Quantité telle que stockée (g/ml pour un aliment, portions pour une recette). */
  quantite: number | null;
  /** « 2 pièces », « 150 g », « 1,5 portion » : la quantité comme Vincent l'a dite. */
  quantiteLibelle: string | null;
  moment: MomentRepas;
  date: string;
  /** Issue du catalogue (jamais estimée par l'IA) ; null tant que cible ou quantité manque. */
  kcal: number | null;
  avertissements: string[];
};

export type RepasACreer = Pick<RepasPropose, "cible" | "quantite" | "moment" | "date">;

export type ContexteRepas = {
  catalogue: CatalogueItem[];
  /** Date du jour à Paris, `AAAA-MM-JJ`. */
  aujourdhui: string;
  /** Heure à Paris (0-23, minutes en fraction), pour le moment par défaut. */
  heure: number;
};

/** Un repas ne peut être créé que s'il a un aliment ou une recette ET une quantité. */
export function repasComplet(r: Pick<RepasPropose, "cible" | "quantite">): boolean {
  return r.cible !== null && r.quantite !== null;
}

const nombre = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

type Conversion = { quantite: number | null; libelle: string | null; avertissement: string | null };

function convertirQuantite(item: CatalogueItem, quantite: unknown, unite: unknown): Conversion {
  const q = typeof quantite === "number" && Number.isFinite(quantite) ? quantite : 0;
  if (q <= 0 || q > MAX_QUANTITE) {
    return { quantite: null, libelle: null, avertissement: "Quantité à préciser dans « Modifier »." };
  }

  if (item.type === "recette") {
    if (unite !== "portion") {
      return {
        quantite: null,
        libelle: null,
        avertissement: "Une recette se compte en portions : quantité à préciser dans « Modifier ».",
      };
    }
    return { quantite: q, libelle: `${nombre(q)} portion${q > 1 ? "s" : ""}`, avertissement: null };
  }

  if (unite === "g" || unite === "ml") {
    return { quantite: q, libelle: `${nombre(q)} ${item.unite === "ml" ? "ml" : "g"}`, avertissement: null };
  }
  if (unite === "piece") {
    if (item.poidsUniteG === null) {
      return {
        quantite: null,
        libelle: null,
        avertissement: `« ${item.nom} » n'a pas de poids par pièce : indique une quantité en grammes dans « Modifier ».`,
      };
    }
    return { quantite: q * item.poidsUniteG, libelle: `${nombre(q)} pièce${q > 1 ? "s" : ""}`, avertissement: null };
  }
  return { quantite: null, libelle: null, avertissement: "Quantité à préciser dans « Modifier »." };
}

function kcalDu(item: CatalogueItem, quantite: number): number {
  return Math.round(item.type === "recette" ? item.parPortion.kcal * quantite : (item.par100.kcal * quantite) / 100);
}

function interpreterRepasBrut(
  brut: Record<string, unknown>,
  ctx: ContexteRepas,
  parNom: Map<string, CatalogueItem>
): RepasPropose | null {
  const cite = texteOuNull(brut.aliment, MAX_NOM);
  const correspondance = texteOuNull(brut.correspondance, MAX_NOM);
  if (!cite && !correspondance) return null;

  // Correspondance EXACTE seulement (sans accents ni casse) : une approximation
  // enregistrerait un autre aliment sans que ce soit visible.
  const item =
    (correspondance && parNom.get(normaliserTexte(correspondance))) ||
    (cite && parNom.get(normaliserTexte(cite))) ||
    null;

  const avertissements: string[] = [];
  let quantite: number | null = null;
  let quantiteLibelle: string | null = null;
  let kcal: number | null = null;

  if (item) {
    const conversion = convertirQuantite(item, brut.quantite, brut.unite);
    quantite = conversion.quantite;
    quantiteLibelle = conversion.libelle;
    if (conversion.avertissement) avertissements.push(conversion.avertissement);
    if (quantite !== null) kcal = kcalDu(item, quantite);
  } else {
    avertissements.push("Aucun aliment du catalogue ne correspond : choisis-le dans « Modifier ».");
  }

  const momentBrut = brut.moment as MomentRepas;
  const moment = MOMENTS_REPAS.includes(momentBrut) ? momentBrut : momentParDefaut(ctx.heure);

  const dateBrute = texteOuNull(brut.date, 10);
  const date = dateBrute && estDateValide(dateBrute) ? dateBrute : ctx.aujourdhui;

  return {
    nom: item?.nom ?? cite ?? correspondance ?? "",
    cible: item ? { type: item.type, id: item.id } : null,
    quantite,
    quantiteLibelle,
    moment,
    date,
    kcal,
    avertissements,
  };
}

/** Revalide les repas bruts de Gemini ; écarte ceux sans nom. */
export function interpreterRepas(bruts: Record<string, unknown>[], ctx: ContexteRepas): RepasPropose[] {
  const parNom = new Map<string, CatalogueItem>();
  for (const item of ctx.catalogue) {
    const cle = normaliserTexte(item.nom);
    if (!parNom.has(cle)) parNom.set(cle, item);
  }
  return bruts.map((b) => interpreterRepasBrut(b, ctx, parNom)).filter((r): r is RepasPropose => r !== null);
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** « Aujourd'hui », « Hier », sinon « mer. 30 sept. ». */
export function libelleJourRepas(date: string, aujourdhui: string): string {
  if (date === aujourdhui) return "Aujourd'hui";
  const hier = new Date(`${aujourdhui}T12:00:00Z`);
  hier.setUTCDate(hier.getUTCDate() - 1);
  if (date === hier.toISOString().slice(0, 10)) return "Hier";
  return formatJour.format(new Date(`${date}T12:00:00Z`));
}

export function lignesContexteRepas(catalogue: CatalogueItem[]): string[] {
  const noms = (type: CatalogueItem["type"]) =>
    catalogue
      .filter((i) => i.type === type)
      .map((i) => i.nom)
      .slice(0, MAX_NOMS_PROMPT);
  return [
    `Aliments du catalogue (JSON) : ${JSON.stringify(noms("aliment"))}`,
    `Recettes du catalogue (JSON) : ${JSON.stringify(noms("recette"))}`,
  ];
}

export const REGLES_REPAS = [
  "- `repas` : seulement ce que Vincent a mangé ou bu, ou va manger (« j'ai mangé », « ce midi », « au petit-déj »), jamais un article à acheter (course) ni une action (tâche). Un élément par aliment ou plat.",
  "- Repas : `aliment` reprend le mot de Vincent. `correspondance` recopie EXACTEMENT, caractère pour caractère, un nom des listes du catalogue quand il correspond clairement à ce que Vincent a mangé ; sinon chaîne vide. N'invente jamais un nom qui n'est pas dans les listes.",
  "- Repas : `quantite` (nombre) et `unite` : g ou ml pour un poids ou un volume cité, piece pour un nombre d'unités (« deux œufs » = 2 piece), portion pour une recette du catalogue. Sans quantité citée, `quantite` vaut 0 et `unite` est vide. N'estime jamais de calories ni de macros.",
  "- Repas : `moment` vaut petit_dej, dejeuner, diner ou collation (« ce midi » = dejeuner, « ce soir » = diner) ; chaîne vide s'il n'est pas cité. `date` : AAAA-MM-JJ tirée du calendrier (« hier »), sinon la date d'aujourd'hui.",
] as const;

export const CAS_QUESTION_REPAS = [] as const;
