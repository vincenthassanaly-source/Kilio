import { estIdTemporaire } from "./compute";

// Clé React stable d'une ligne de courses, de l'ajout optimiste à la ligne
// confirmée par le serveur.
//
// Une ligne ajoutée apparaît d'abord avec un id `temp-…`, puis le refetch la
// remplace par la ligne réelle (autre id). Si la clé React suivait l'id, React
// démonterait la ligne optimiste (animation de sortie) en montant la réelle :
// pendant ~150 ms l'article s'afficherait deux fois. On réutilise donc la clé
// de la ligne optimiste pour la ligne réelle de même libellé : la ligne se met
// simplement à jour sur place.
//
// Chaque appel de `creerAttributeurDeCles` donne un attributeur avec sa propre
// mémoire (à créer une fois par liste affichée). Idempotent : appeler
// l'attributeur plusieurs fois pour le même article (rendus multiples, mode
// strict) renvoie toujours la même clé.
type Article = { id: string; libelle: string };

export function creerAttributeurDeCles(): (article: Article) => string {
  const cleParId = new Map<string, string>();
  const idTempEnAttente = new Map<string, string>(); // libellé -> id temporaire

  return (article) => {
    const connue = cleParId.get(article.id);
    if (connue) return connue;

    if (estIdTemporaire(article.id)) {
      cleParId.set(article.id, article.id);
      idTempEnAttente.set(article.libelle, article.id);
      return article.id;
    }

    const idTemp = idTempEnAttente.get(article.libelle);
    if (idTemp) {
      // Le libellé est consommé : un autre article réel de même libellé garde sa propre clé.
      idTempEnAttente.delete(article.libelle);
      cleParId.set(article.id, idTemp);
      return idTemp;
    }

    cleParId.set(article.id, article.id);
    return article.id;
  };
}
