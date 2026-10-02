// Tag de cache de la lecture des notes (voir cache.ts). Dans son propre
// fichier pour que les écritures qui l'expirent (actions/notes.ts et
// deleteTag de actions/taches.ts) ne forment pas d'import circulaire avec
// cache.ts, qui importe la lecture depuis actions/notes.ts.
//
// Expiré par updateTag dans les Server Actions de notes. deleteTag (Tâches)
// l'expire aussi : la table `tags` est partagée et sa suppression retire les
// liens notes_tags, donc des pastilles de la liste des notes.
export const NOTES_TAG = "notes";
