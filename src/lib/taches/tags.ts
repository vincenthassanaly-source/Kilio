// Tag de cache des lectures de tâches et de listes (voir cache.ts). Dans son
// propre fichier pour que les écritures qui l'expirent (actions/taches.ts,
// route reporter-rappel) ne forment pas d'import circulaire avec cache.ts,
// qui importe les lectures depuis actions/taches.ts.
//
// Expiré par revalidateTag(…, { expire: 0 }) : contrairement à updateTag,
// il fonctionne aussi dans les routes API (action « Fait » / « Reporter » des
// notifications push), et l'option expire: 0 ne sert jamais de donnée périmée.
export const TACHES_TAG = "taches";
