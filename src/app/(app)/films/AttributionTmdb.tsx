/** Mentions imposées par TMDB (conditions d'utilisation de l'API) et par JustWatch
 * (source des disponibilités). À garder visibles sur chaque écran du module. */
export function AttributionTmdb() {
  return (
    <p className="text-pretty pt-2 text-center text-caption text-ink-3">
      Données de films : TMDB. Disponibilités en streaming : JustWatch. Ce service utilise l&apos;API TMDB mais n&apos;est ni approuvé ni certifié par TMDB.
    </p>
  );
}
