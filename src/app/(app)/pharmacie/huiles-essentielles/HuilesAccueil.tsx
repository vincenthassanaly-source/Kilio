"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/PullToRefresh";
import { TransitionLink } from "@/components/TransitionLink";
import { queryKeys } from "@/lib/query/keys";
import { addCard, addCardIcon, cardTight, eyebrow, input } from "@/lib/ui";
import { pluriel } from "@/lib/pharmacie/format";
import {
  AUCUN_FILTRE,
  filtrerHuiles,
  indicationsUtilisees,
  rechercherHuiles,
  type FiltresHuiles,
  type HuilesSnapshot,
  type PharmaHuile,
} from "@/lib/pharmacie/huiles";
import { IntrouvableCarte } from "../EtatSnapshot";
import { BadgesListe } from "./BadgesHuile";
import { AvecHuiles } from "./EtatHuiles";
import { HuileEditeur } from "./HuileEditeur";

const MAX_INDICATIONS_FILTRE = 8;

export function HuilesAccueil() {
  const queryClient = useQueryClient();
  // La recherche vit aussi dans l'URL (`?q=`) : au retour depuis une fiche,
  // elle et sa liste sont retrouvées (même principe que le référentiel).
  const searchParams = useSearchParams();
  const [requete, setRequete] = useState(() => searchParams.get("q") ?? "");
  const [filtres, setFiltres] = useState<FiltresHuiles>(AUCUN_FILTRE);
  const [ajout, setAjout] = useState(false);

  function saisir(valeur: string) {
    setRequete(valeur);
    const url = new URL(window.location.href);
    if (valeur) url.searchParams.set("q", valeur);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.pharmacieHuiles })}>
      <div className="flex flex-col gap-4">
        <AvecHuiles>
          {(snapshot) => (
            <>
              <button type="button" onClick={() => setAjout(true)} className={addCard}>
                <span aria-hidden className={addCardIcon}>
                  +
                </span>
                <span className="text-[15px] font-semibold text-ink">Ajouter une huile essentielle</span>
              </button>
              {ajout && <HuileEditeur huiles={snapshot.huiles} onClose={() => setAjout(false)} />}

              {snapshot.huiles.length === 0 ? (
                <IntrouvableCarte message="Aucune huile pour l'instant. Ajoute ta première fiche avec le bouton ci-dessus." />
              ) : (
                <>
                  <input
                    type="search"
                    value={requete}
                    onChange={(e) => saisir(e.target.value)}
                    placeholder="Nom, nom latin, indication…"
                    aria-label="Rechercher une huile essentielle"
                    enterKeyHint="search"
                    className={input}
                  />
                  <FiltresRapides snapshot={snapshot} filtres={filtres} onChange={setFiltres} />
                  <Liste snapshot={snapshot} requete={requete} filtres={filtres} />
                </>
              )}
            </>
          )}
        </AvecHuiles>
      </div>
    </PullToRefresh>
  );
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13.5px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
        actif ? "border-kcal bg-kcal text-on-kcal" : "border-line bg-surface text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

function FiltresRapides({
  snapshot,
  filtres,
  onChange,
}: {
  snapshot: HuilesSnapshot;
  filtres: FiltresHuiles;
  onChange: (f: FiltresHuiles) => void;
}) {
  const indications = indicationsUtilisees(snapshot.huiles).slice(0, MAX_INDICATIONS_FILTRE);

  return (
    <div role="group" aria-label="Filtres" className="flex flex-wrap gap-2">
      <Puce actif={filtres.comestible} onClick={() => onChange({ ...filtres, comestible: !filtres.comestible })}>
        Comestibles
      </Puce>
      <Puce actif={filtres.grossesse} onClick={() => onChange({ ...filtres, grossesse: !filtres.grossesse })}>
        Sans alerte grossesse
      </Puce>
      {indications.map((indication) => (
        <Puce
          key={indication}
          actif={filtres.indication === indication}
          onClick={() => onChange({ ...filtres, indication: filtres.indication === indication ? null : indication })}
        >
          {indication}
        </Puce>
      ))}
    </div>
  );
}

function Liste({ snapshot, requete, filtres }: { snapshot: HuilesSnapshot; requete: string; filtres: FiltresHuiles }) {
  const huiles = filtrerHuiles(rechercherHuiles(snapshot.huiles, requete), filtres);

  if (huiles.length === 0) {
    return (
      <p className="text-[14.5px] text-ink-2" role="status">
        Aucune huile ne correspond.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2.5" aria-label="Huiles essentielles">
      <p className={eyebrow} role="status">
        {pluriel(huiles.length, "huile")}
      </p>
      <ul className="flex flex-col gap-2">
        {huiles.map((huile) => (
          <LigneHuile key={huile.id} huile={huile} />
        ))}
      </ul>
    </section>
  );
}

function LigneHuile({ huile }: { huile: PharmaHuile }) {
  return (
    <li>
      <TransitionLink href={`/pharmacie/huiles-essentielles/${huile.id}`} className={`${cardTight} flex flex-col gap-2`}>
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold text-ink">{huile.nom_fr}</span>
          {huile.nom_latin && <span className="text-[13px] italic text-ink-2">{huile.nom_latin}</span>}
        </span>
        <BadgesListe huile={huile} />
      </TransitionLink>
    </li>
  );
}
