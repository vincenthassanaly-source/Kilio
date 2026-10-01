"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/PullToRefresh";
import { TransitionLink } from "@/components/TransitionLink";
import { queryKeys } from "@/lib/query/keys";
import { cardTight, eyebrow, input } from "@/lib/ui";
import { pluriel } from "@/lib/pharmacie/format";
import {
  classeParId,
  classesRacines,
  hrefResultat,
  moleculesParInitiale,
  nbMoleculesDeClasse,
  profilsDePathologie,
  rechercherReferentiel,
  sousClasses,
  type PharmaRefSnapshot,
} from "@/lib/pharmacie/referentiel";
import { styleClasse } from "@/lib/pharmacie/couleurClasse";
import { IntrouvableCarte } from "../EtatSnapshot";
import { AvecReferentiel } from "./EtatReferentiel";
import { GroupeRepliable, SectionRepliable } from "./Repliable";

export function ReferentielAccueil() {
  const queryClient = useQueryClient();
  const [requete, setRequete] = useState("");

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.pharmacieReferentiel })}>
      <div className="flex flex-col gap-5">
        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="DCI, nom commercial, classe, pathologie…"
          aria-label="Rechercher dans le référentiel"
          enterKeyHint="search"
          className={input}
        />
        <AvecReferentiel>
          {(snapshot) =>
            snapshot.molecules.length === 0 ? (
              <IntrouvableCarte message="Le référentiel est vide. Demande à Claude dans le chat de créer les premières classes et fiches." />
            ) : requete.trim().length >= 2 ? (
              <Resultats snapshot={snapshot} requete={requete} />
            ) : (
              <Sommaire snapshot={snapshot} />
            )
          }
        </AvecReferentiel>
      </div>
    </PullToRefresh>
  );
}

const ETIQUETTE_TYPE = { molecule: "Médicament", classe: "Classe", pathologie: "Pathologie" } as const;

function Resultats({ snapshot, requete }: { snapshot: PharmaRefSnapshot; requete: string }) {
  const resultats = rechercherReferentiel(snapshot, requete);

  if (resultats.length === 0) {
    return (
      <p className="text-[14.5px] text-ink-2" role="status">
        Rien ne correspond à « {requete.trim()} ».
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Résultats de recherche">
      {resultats.map((r) => (
        <li key={`${r.type}-${r.id}`}>
          <TransitionLink href={hrefResultat(r)} className={`${cardTight} flex flex-col gap-0.5`}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{ETIQUETTE_TYPE[r.type]}</span>
            <span className="text-[14.5px] font-semibold text-ink">{r.titre}</span>
            {r.detail && <span className="text-[13px] text-ink-2">{r.detail}</span>}
          </TransitionLink>
        </li>
      ))}
    </ul>
  );
}

function Sommaire({ snapshot }: { snapshot: PharmaRefSnapshot }) {
  const racines = classesRacines(snapshot);
  const index = moleculesParInitiale(snapshot);

  return (
    <>
      <SectionRepliable id="ref-pathologies" titre="Pathologies et protocoles" compteur={snapshot.pathologies.length}>
        <ul className="flex flex-col gap-2">
          {snapshot.pathologies.map((pathologie) => {
            const profils = profilsDePathologie(snapshot, pathologie.id);
            return (
              <li key={pathologie.id}>
                <TransitionLink
                  href={`/pharmacie/referentiel/pathologie/${pathologie.id}`}
                  className={`${cardTight} flex items-baseline justify-between gap-3`}
                >
                  <span className="text-[14.5px] font-semibold text-ink">{pathologie.nom}</span>
                  <span className={`${eyebrow} shrink-0 font-normal`}>{pluriel(profils.length, "profil")}</span>
                </TransitionLink>
              </li>
            );
          })}
        </ul>
      </SectionRepliable>

      <SectionRepliable id="ref-classes" titre="Classes thérapeutiques" compteur={racines.length}>
        <div className="flex flex-col gap-3">
          {racines.map((racine) => {
            const classes = sousClasses(snapshot, racine.id);
            return (
              <GroupeRepliable
                key={racine.id}
                id={`ref-classes-${racine.id}`}
                titre={
                  <>
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--classe)]" />
                    {racine.nom}
                  </>
                }
                titreClassName="text-[13px] font-semibold text-[var(--classe)]"
                compteur={classes.length}
                style={styleClasse(snapshot, racine)}
              >
                <ul className="flex flex-col px-4">
                  {classes.map((classe) => (
                    <li key={classe.id}>
                      <TransitionLink
                        href={`/pharmacie/referentiel/classe/${classe.id}`}
                        className="relative flex min-h-11 items-center justify-between gap-3 border-t border-line py-2 first:border-t-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
                      >
                        <span className="text-[14.5px] font-medium text-ink">{classe.nom}</span>
                        <span className="shrink-0 text-[12px] text-ink-2">{nbMoleculesDeClasse(snapshot, classe.id)}</span>
                      </TransitionLink>
                    </li>
                  ))}
                </ul>
              </GroupeRepliable>
            );
          })}
        </div>
      </SectionRepliable>

      <SectionRepliable id="ref-az" titre="Médicaments A–Z" compteur={`(${snapshot.molecules.length})`}>
        <div className="flex flex-col gap-3">
          {index.map(({ initiale, molecules }) => (
            <GroupeRepliable
              key={initiale}
              id={`ref-az-${initiale}`}
              titre={initiale}
              titreClassName="text-[15px] font-semibold text-ink"
              compteur={molecules.length}
            >
              <ul className="flex flex-col">
                {molecules.map((molecule) => (
                  <li key={molecule.id} style={styleClasse(snapshot, classeParId(snapshot, molecule.classe_id))}>
                    <TransitionLink
                      href={`/pharmacie/referentiel/medicament/${molecule.id}`}
                      className="flex min-h-11 items-center gap-2.5 px-4 py-2 text-[14.5px] text-ink border-t border-line first:border-t-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
                    >
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--classe)]" />
                      {molecule.dci}
                    </TransitionLink>
                  </li>
                ))}
              </ul>
            </GroupeRepliable>
          ))}
        </div>
      </SectionRepliable>
    </>
  );
}
