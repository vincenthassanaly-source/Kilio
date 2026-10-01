"use client";

import { use } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import { card, cardTight, eyebrow, pillClasse, screenTitle, sectionTitle } from "@/lib/ui";
import { pluriel } from "@/lib/pharmacie/format";
import { styleClasse } from "@/lib/pharmacie/couleurClasse";
import {
  cheminDeClasse,
  classeParId,
  moleculesDeClasse,
  nbMoleculesDeClasse,
  pathologiesDeClasse,
  sousClasses,
  specialitesDeMolecule,
} from "@/lib/pharmacie/referentiel";
import { IntrouvableCarte } from "../../../EtatSnapshot";
import { RetourReferentiel } from "../../RetourReferentiel";
import { AvecReferentiel, BlocInfo } from "../../EtatReferentiel";

export default function ClassePage({ params }: { params: Promise<{ classeId: string }> }) {
  const { classeId } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <AvecReferentiel>
        {(snapshot) => {
          const classe = classeParId(snapshot, classeId);
          if (!classe) {
            return (
              <>
                <RetourReferentiel />
                <IntrouvableCarte message="Cette classe n'existe plus : elle a peut-être été renommée ou fusionnée." />
              </>
            );
          }

          const chemin = cheminDeClasse(snapshot, classe);
          const parent = chemin.length > 1 ? chemin[chemin.length - 2] : null;
          const enfants = sousClasses(snapshot, classe.id);
          const molecules = moleculesDeClasse(snapshot, classe.id);
          const pathologies = pathologiesDeClasse(snapshot, classe.id);

          return (
            <div className="flex flex-col gap-4" style={styleClasse(snapshot, classe)}>
              <div className="flex flex-col gap-1">
                <RetourReferentiel />
                {parent && <p className={eyebrow}>{chemin.slice(0, -1).map((c) => c.nom).join(" › ")}</p>}
                <h1 className={screenTitle}>{classe.nom}</h1>
                {classe.atc && <span className={`${pillClasse} self-start`}>ATC {classe.atc}</span>}
              </div>

              {(classe.mecanisme || classe.contre_indications || classe.interactions || classe.conseils) && (
                <div className={`${card} flex flex-col gap-4 bg-[color-mix(in_oklch,var(--classe)_7%,var(--color-surface))]`}>
                  <BlocInfo titre="Mécanisme" texte={classe.mecanisme} />
                  <BlocInfo titre="Contre-indications" texte={classe.contre_indications} />
                  <BlocInfo titre="Interactions" texte={classe.interactions} />
                  <BlocInfo titre="Conseils au comptoir" texte={classe.conseils} />
                </div>
              )}

              {enfants.length > 0 && (
                <section className="flex flex-col gap-2.5" aria-labelledby="titre-sous-classes">
                  <h2 id="titre-sous-classes" className={sectionTitle}>
                    Sous-classes
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {enfants.map((enfant) => (
                      <li key={enfant.id}>
                        <TransitionLink
                          href={`/pharmacie/referentiel/classe/${enfant.id}`}
                          className={`${cardTight} flex items-baseline justify-between gap-3`}
                        >
                          <span className="text-[14.5px] font-semibold text-ink">{enfant.nom}</span>
                          <span className={`${eyebrow} shrink-0 font-normal`}>
                            {pluriel(nbMoleculesDeClasse(snapshot, enfant.id), "molécule")}
                          </span>
                        </TransitionLink>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {molecules.length > 0 && (
                <section className="flex flex-col gap-2.5" aria-labelledby="titre-molecules">
                  <h2 id="titre-molecules" className={sectionTitle}>
                    Médicaments ({molecules.length})
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {molecules.map((molecule) => {
                      const marques = specialitesDeMolecule(snapshot, molecule.id).map((s) => s.nom);
                      return (
                        <li key={molecule.id}>
                          <TransitionLink
                            href={`/pharmacie/referentiel/medicament/${molecule.id}`}
                            className={`${cardTight} flex flex-col gap-0.5`}
                          >
                            <span className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
                              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--classe)]" />
                              {molecule.dci}
                            </span>
                            {marques.length > 0 && <span className="text-[13px] text-ink-2">{marques.join(" · ")}</span>}
                            {molecule.indications.length > 0 && (
                              <span className="line-clamp-1 text-[12.5px] text-ink-3">{molecule.indications.join(" · ")}</span>
                            )}
                          </TransitionLink>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {pathologies.length > 0 && (
                <section className="flex flex-col gap-2.5" aria-labelledby="titre-pathologies-classe">
                  <h2 id="titre-pathologies-classe" className={sectionTitle}>
                    Dans les protocoles
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {pathologies.map((pathologie) => (
                      <li key={pathologie.id}>
                        <TransitionLink
                          href={`/pharmacie/referentiel/pathologie/${pathologie.id}`}
                          className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-semibold text-ink"
                        >
                          {pathologie.nom}
                        </TransitionLink>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          );
        }}
      </AvecReferentiel>
    </div>
  );
}
