"use client";

import { use, useState } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import {
  card,
  cardTight,
  eyebrow,
  pillClasse,
  pillTag,
  screenTitle,
  secondaryButton,
  sectionTitle,
  titreBlocClasse,
} from "@/lib/ui";
import { styleClasse } from "@/lib/pharmacie/couleurClasse";
import {
  cheminDeClasse,
  classeParId,
  composantsDeMolecule,
  moleculeParId,
  pathologiesDeMolecule,
  specialitesDeMolecule,
} from "@/lib/pharmacie/referentiel";
import { IntrouvableCarte } from "../../../EtatSnapshot";
import { RetourReferentiel } from "../../RetourReferentiel";
import { AvecReferentiel, BlocInfo } from "../../EtatReferentiel";
import { MoleculeEditeur } from "./MoleculeEditeur";

export default function MedicamentPage({ params }: { params: Promise<{ moleculeId: string }> }) {
  const { moleculeId } = use(params);
  const [edition, setEdition] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <AvecReferentiel>
        {(snapshot) => {
          const molecule = moleculeParId(snapshot, moleculeId);
          if (!molecule) {
            return (
              <>
                <RetourReferentiel />
                <IntrouvableCarte message="Ce médicament n'existe plus : il a peut-être été renommé ou fusionné." />
              </>
            );
          }

          const classe = classeParId(snapshot, molecule.classe_id);
          const chemin = classe ? cheminDeClasse(snapshot, classe) : [];
          const specialites = specialitesDeMolecule(snapshot, molecule.id);
          const composants = composantsDeMolecule(snapshot, molecule);
          const pathologies = pathologiesDeMolecule(snapshot, molecule);

          return (
            <div className="flex flex-col gap-4" style={styleClasse(snapshot, classe)}>
              <div className="flex flex-col gap-1">
                <RetourReferentiel href={classe ? `/pharmacie/referentiel/classe/${classe.id}` : undefined} />
                {chemin.length > 0 && <p className={eyebrow}>{chemin.map((c) => c.nom).join(" › ")}</p>}
                <h1 className={screenTitle}>{molecule.dci}</h1>
                {molecule.association && <span className={`${pillClasse} self-start`}>Association fixe</span>}
              </div>

              <section
                className={`${card} flex flex-col gap-4 bg-[color-mix(in_oklch,var(--classe)_7%,var(--color-surface))]`}
                aria-label="Fiche du médicament"
              >
                {molecule.indications.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <h2 className={titreBlocClasse}>Indications</h2>
                    <ul className="flex flex-wrap gap-1.5">
                      {molecule.indications.map((indication) => (
                        <li key={indication} className={pillClasse}>
                          {indication}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {composants.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <h2 className={titreBlocClasse}>Composants</h2>
                    <ul className="flex flex-wrap gap-2">
                      {composants.map(({ nom, molecule: liee }) => (
                        <li key={nom}>
                          {liee ? (
                            <TransitionLink
                              href={`/pharmacie/referentiel/medicament/${liee.id}`}
                              className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-semibold text-ink"
                            >
                              {nom}
                            </TransitionLink>
                          ) : (
                            <span className={pillTag}>{nom}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <BlocInfo titre="Particularités" texte={molecule.particularites} />
              </section>

              {specialites.length > 0 && (
                <section className="flex flex-col gap-2.5" aria-labelledby="titre-marques">
                  <h2 id="titre-marques" className={sectionTitle}>
                    Noms commerciaux
                  </h2>
                  <ul className={`${card} flex flex-col p-0`}>
                    {specialites.map((specialite) => (
                      <li
                        key={specialite.id}
                        className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0"
                      >
                        <span className="text-[14.5px] font-semibold text-ink">{specialite.nom}</span>
                        {specialite.dosages && <span className="text-right text-[12.5px] text-ink-2">{specialite.dosages}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {classe && (classe.mecanisme || classe.contre_indications || classe.interactions || classe.conseils) && (
                <section className="flex flex-col gap-2.5" aria-labelledby="titre-classe">
                  <h2 id="titre-classe" className={sectionTitle}>
                    Classe : {classe.nom}
                  </h2>
                  <div className={`${card} flex flex-col gap-4`}>
                    <BlocInfo titre="Mécanisme" texte={classe.mecanisme} />
                    <BlocInfo titre="Contre-indications" texte={classe.contre_indications} />
                    <BlocInfo titre="Interactions" texte={classe.interactions} />
                    <BlocInfo titre="Conseils au comptoir" texte={classe.conseils} />
                  </div>
                </section>
              )}

              {pathologies.length > 0 && (
                <section className="flex flex-col gap-2.5" aria-labelledby="titre-protocoles">
                  <h2 id="titre-protocoles" className={sectionTitle}>
                    Dans les protocoles
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {pathologies.map((pathologie) => (
                      <li key={pathologie.id}>
                        <TransitionLink
                          href={`/pharmacie/referentiel/pathologie/${pathologie.id}`}
                          className={`${cardTight} block text-[14.5px] font-semibold text-ink`}
                        >
                          {pathologie.nom}
                        </TransitionLink>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <button type="button" onClick={() => setEdition(true)} className={`${secondaryButton} self-start`}>
                Modifier la fiche
              </button>
              {edition && <MoleculeEditeur molecule={molecule} onClose={() => setEdition(false)} />}
            </div>
          );
        }}
      </AvecReferentiel>
    </div>
  );
}
