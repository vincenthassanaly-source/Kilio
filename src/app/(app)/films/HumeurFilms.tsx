"use client";

import { useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getStatutsFilms, recommanderParHumeur } from "@/app/actions/films";
import { ErrorInline } from "@/components/ErrorInline";
import { lireResultat } from "@/lib/films/lire";
import { HUMEUR_MAX } from "@/lib/films/humeur";
import { queryKeys } from "@/lib/query/keys";
import { emptyState, input, label, metaText, pillTag, primaryButton, sectionTitle, textButton, zoneTapPill } from "@/lib/ui";
import { RANGEE_FILMS, TuileFilm } from "./TuileFilm";
import { useActionsFilms } from "./useActionsFilms";

const EXEMPLES = ["Réconfortant et pas trop long", "Un thriller qui tient en haleine", "À voir en famille", "Un classique des années 90"];

function IconeEtincelle() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M8 8l2 2M14 14l2 2M16 8l-2 2M10 14l-2 2" />
    </svg>
  );
}

/** « Pas d'idée ? » : l'utilisateur décrit son envie, l'IA la traduit en filtres et TMDB répond avec de vrais films.
 * On montre ce qui a été compris (genres, époque, durée…) pour qu'un résultat surprenant s'explique. */
export function HumeurFilms({ mesIds }: { mesIds: ReadonlySet<number> }) {
  const idPanneau = useId();
  const [ouvert, setOuvert] = useState(false);
  const [envie, setEnvie] = useState("");
  const { ajouter, retirer } = useActionsFilms();
  const statuts = useQuery({ queryKey: queryKeys.filmsStatuts, queryFn: () => lireResultat(getStatutsFilms()) });

  const proposition = useMutation({
    mutationFn: (vars: { texte: string; surMesPlateformes: boolean }) =>
      lireResultat(recommanderParHumeur(vars.texte, vars.surMesPlateformes)),
  });
  const resultat = proposition.data;
  const texte = envie.trim();

  function proposer(surMesPlateformes: boolean) {
    if (texte) proposition.mutate({ texte, surMesPlateformes });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => setOuvert((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 text-left text-small font-semibold text-ink transition-[color,background-color,transform] active:scale-[0.99] hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <span className="text-kcal">
          <IconeEtincelle />
        </span>
        Pas d&apos;idée ? Décris ton envie
      </button>

      {ouvert && (
        <form
          id={idPanneau}
          onSubmit={(e) => {
            e.preventDefault();
            proposer(true);
          }}
          className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className={label}>Ton envie</span>
            <textarea
              value={envie}
              onChange={(e) => setEnvie(e.target.value)}
              maxLength={HUMEUR_MAX}
              rows={2}
              placeholder="Un film réconfortant, pas trop long…"
              className={`${input} resize-none`}
            />
          </label>
          <ul className="flex flex-wrap gap-x-2 gap-y-4">
            {EXEMPLES.map((exemple) => (
              <li key={exemple}>
                <button type="button" onClick={() => setEnvie(exemple)} className={`${pillTag} ${zoneTapPill} transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal`}>
                  {exemple}
                </button>
              </li>
            ))}
          </ul>
          <button type="submit" disabled={!texte || proposition.isPending} className={primaryButton}>
            {proposition.isPending ? "Je cherche…" : "Proposer des films"}
          </button>
        </form>
      )}

      {proposition.isError && (
        <ErrorInline niveau={2} message={proposition.error.message} retry={() => proposer(proposition.variables?.surMesPlateformes ?? true)} />
      )}

      {resultat && !proposition.isError && (
        <section aria-label="Pour ton envie" className="flex flex-col gap-3">
          <h2 className={sectionTitle}>Pour ton envie</h2>
          {resultat.compris.length > 0 && <p className={metaText}>Compris : {resultat.compris.join(" · ")}</p>}
          {!resultat.plateformesAppliquees && (
            <p className="text-small text-ink-2 text-pretty">Résultats hors de tes plateformes : la disponibilité est indiquée sous chaque film.</p>
          )}

          {resultat.films.length === 0 ? (
            <div className={emptyState}>
              Aucun film ne correspond à cette envie{resultat.plateformesAppliquees ? " sur tes plateformes" : ""}.
              {resultat.plateformesAppliquees && (
                <>
                  <br />
                  <button type="button" onClick={() => proposer(false)} className={textButton}>
                    Chercher aussi hors de mes plateformes
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className={RANGEE_FILMS} data-swipe-ignore>
              {resultat.films.map((film) => {
                const dansListe = statuts.data?.[film.id] !== undefined;
                const aAjouter = { id: film.id, titre: film.titre, annee: film.annee, affiche: film.affiche };
                return (
                  <TuileFilm
                    key={film.id}
                    film={film}
                    mesIds={mesIds}
                    dansListe={dansListe}
                    onToggle={() => void (dansListe ? retirer(aAjouter) : ajouter(aAjouter))}
                  />
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
