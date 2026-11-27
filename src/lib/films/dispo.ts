import { abonnementsTries, surMesPlateformes, type Disponibilite, type Fournisseur } from "./types";

export type ResumeDispo = {
  texte: string;
  /** Au moins une plateforme de l'utilisateur propose le film en abonnement. */
  surMesPlateformes: boolean;
  /** Logos à afficher : abonnements, les plateformes de l'utilisateur d'abord. */
  fournisseurs: Fournisseur[];
};

/** Une phrase qui dit où regarder un film, sans jamais confondre « inconnu » et « nulle part ». */
export function resumerDispo(dispo: Disponibilite | null, mesIds: ReadonlySet<number>): ResumeDispo {
  if (!dispo) return { texte: "Disponibilité inconnue", surMesPlateformes: false, fournisseurs: [] };

  const abonnements = abonnementsTries(dispo, mesIds);
  if (abonnements.length > 0) {
    const miennes = abonnements.filter((f) => mesIds.has(f.id));
    const visibles = miennes.length > 0 ? miennes : abonnements;
    const reste = abonnements.length - visibles.length;
    const noms = visibles.map((f) => f.nom).join(", ");
    const suite = miennes.length > 0 ? (reste > 0 ? ` (+${reste})` : "") : abonnements.length > 1 ? ` (+${abonnements.length - 1})` : "";
    return {
      texte: `Sur ${miennes.length > 0 ? noms : abonnements[0].nom}${suite}`,
      surMesPlateformes: surMesPlateformes(dispo, mesIds),
      fournisseurs: abonnements,
    };
  }
  if (dispo.location.length > 0 || dispo.achat.length > 0) {
    return { texte: "Location ou achat seulement", surMesPlateformes: false, fournisseurs: [] };
  }
  return { texte: "Aucune offre en France", surMesPlateformes: false, fournisseurs: [] };
}
