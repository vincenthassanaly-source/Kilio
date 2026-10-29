// Envoi d'un fichier directement du navigateur vers le bucket Supabase par
// URL signée (obtenue côté serveur par `preparerUploadsVrac`), sans passer par
// une fonction Vercel : celles-ci plafonnent à 4,5 Mo, trop peu pour un PDF.
//
// Format attendu par Storage pour une URL signée : PUT multipart avec le
// fichier dans un champ au nom vide (comme le fait supabase-js). Aucun en-tête
// d'authentification : le jeton est dans l'URL. Pas de `Content-Type` posé à la
// main, le navigateur y met la frontière multipart.

export class ErreurTeleversement extends Error {}

async function envoyer(urlSignee: string, fichier: Blob): Promise<Response> {
  const corps = new FormData();
  corps.append("cacheControl", "3600");
  corps.append("", fichier);
  return fetch(urlSignee, { method: "PUT", body: corps, headers: { "x-upsert": "false" } });
}

/**
 * Envoie `fichier` vers `urlSignee`. Un nouvel essai si le réseau lâche (cas
 * courant sur mobile) ; un refus du serveur n'est pas rejoué.
 */
export async function televerserVersUrlSignee(urlSignee: string, fichier: Blob, type: string): Promise<void> {
  const contenu = fichier.type === type ? fichier : new Blob([fichier], { type });
  let reponse: Response;
  try {
    reponse = await envoyer(urlSignee, contenu);
  } catch {
    try {
      reponse = await envoyer(urlSignee, contenu);
    } catch {
      throw new ErreurTeleversement("Pas de connexion : le fichier n'a pas pu être envoyé.");
    }
  }
  if (!reponse.ok) throw new ErreurTeleversement(`Le fichier a été refusé par le stockage (${reponse.status}).`);
}
