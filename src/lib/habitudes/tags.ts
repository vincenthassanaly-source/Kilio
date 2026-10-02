// Tag de cache des lectures d'habitudes (voir cache.ts). Dans son propre
// fichier pour que les Server Actions qui l'expirent (actions/habitudes.ts,
// actions/objectifs.ts) ne forment pas d'import circulaire avec cache.ts, qui
// importe getHabitudesDuJour depuis actions/habitudes.ts.
//
// Expiré par updateTag dans toute Server Action qui modifie ce que lit
// getHabitudesDuJour : habitudes et habitude_entries, mais aussi objectifs et
// objectif_habitudes (la liste affiche les objectifs « en cours » liés).
export const HABITUDES_TAG = "habitudes";
