"use client";

import { Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TransitionLink } from "@/components/TransitionLink";
import { card, eyebrow, screenTitle } from "@/lib/ui";
import {
  LIBELLE_ROLE,
  libelleNbMedicaments,
  pathologieParId,
  profilsDePathologie,
  type ItemResolu,
  type LigneResolue,
  type RoleItem,
} from "@/lib/pharmacie/referentiel";
import { IntrouvableCarte, PharmacieSkeleton } from "../../../EtatSnapshot";
import { RetourReferentiel } from "../../RetourReferentiel";
import { AvecReferentiel } from "../../EtatReferentiel";

// Le rôle est dit en toutes lettres et par un pictogramme : la couleur
// n'est jamais le seul vecteur d'information.
const STYLE_ROLE: Record<RoleItem, { bordure: string; pastille: string; signe: string }> = {
  traitement: { bordure: "border-l-kcal", pastille: "bg-kcal-soft text-kcal", signe: "✓" },
  association: { bordure: "border-l-warning", pastille: "bg-surface-alt text-ink-2", signe: "+" },
  eviter: { bordure: "border-l-alert", pastille: "bg-surface-alt text-alert", signe: "✕" },
};

const ORDRE_ROLE: RoleItem[] = ["traitement", "association", "eviter"];

function hrefItem({ classe, molecule }: ItemResolu): string | null {
  if (molecule) return `/pharmacie/referentiel/medicament/${molecule.id}`;
  if (classe) return `/pharmacie/referentiel/classe/${classe.id}`;
  return null;
}

function LigneTraitement({ ligne }: { ligne: LigneResolue }) {
  const nbMedicaments = libelleNbMedicaments(ligne.ligne.nb_medicaments);
  return (
    <li className={`${card} flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kcal-soft font-display text-[15px] font-bold text-kcal"
          aria-label={`Étape ${ligne.ligne.rang}`}
        >
          {ligne.ligne.rang}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {nbMedicaments && (
            <span className="self-start rounded-full bg-kcal-soft px-2.5 py-0.5 text-[12px] font-semibold text-kcal">{nbMedicaments}</span>
          )}
          <h3 className="text-[15px] font-semibold leading-snug text-ink text-balance">{ligne.ligne.titre}</h3>
          {ligne.ligne.description && <p className="text-[13.5px] leading-[1.5] text-ink-2">{ligne.ligne.description}</p>}
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {ORDRE_ROLE.flatMap((role) =>
          ligne.items
            .filter((i) => i.item.role === role)
            .map((resolu) => {
              const style = STYLE_ROLE[role];
              const nom = resolu.molecule?.dci ?? resolu.classe?.nom ?? "Élément supprimé";
              const href = hrefItem(resolu);
              const contenu = (
                <>
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${style.pastille}`} aria-hidden="true">
                    {style.signe}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{LIBELLE_ROLE[role]}</span>
                    <span className="text-[14.5px] font-semibold text-ink">{nom}</span>
                    {resolu.item.note && <span className="text-[12.5px] text-ink-2">{resolu.item.note}</span>}
                  </span>
                </>
              );
              return (
                <li key={resolu.item.id} className="flex flex-col gap-1.5">
                  {resolu.item.ou_precedent && (
                    <span className="pl-3 text-[12px] font-semibold uppercase tracking-wide text-ink-3">ou</span>
                  )}
                  {href ? (
                    <TransitionLink
                      href={href}
                      className={`flex min-h-11 items-center gap-2.5 rounded-xl border-l-4 bg-surface-alt px-3 py-2 ${style.bordure}`}
                    >
                      {contenu}
                    </TransitionLink>
                  ) : (
                    <div className={`flex items-center gap-2.5 rounded-xl border-l-4 bg-surface-alt px-3 py-2 ${style.bordure}`}>{contenu}</div>
                  )}
                </li>
              );
            })
        )}
      </ul>
    </li>
  );
}

export default function PathologiePage({ params }: { params: Promise<{ pathologieId: string }> }) {
  const { pathologieId } = use(params);
  return (
    <Suspense fallback={<PharmacieSkeleton />}>
      <PathologieContenu pathologieId={pathologieId} />
    </Suspense>
  );
}

function PathologieContenu({ pathologieId }: { pathologieId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Le profil vit dans l'URL : il survit au retour depuis une classe ou un
  // médicament. `replace` pour ne pas empiler une entrée d'historique par choix.
  const profilChoisi = searchParams.get("profil");
  const choisirProfil = (profil: string) =>
    router.replace(`?profil=${encodeURIComponent(profil)}`, { scroll: false });

  return (
    <div className="flex flex-col gap-4">
      <AvecReferentiel>
        {(snapshot) => {
          const pathologie = pathologieParId(snapshot, pathologieId);
          if (!pathologie) {
            return (
              <>
                <RetourReferentiel />
                <IntrouvableCarte message="Cette pathologie n'existe plus : elle a peut-être été renommée ou fusionnée." />
              </>
            );
          }

          const profils = profilsDePathologie(snapshot, pathologie.id);
          const courant = profils.find((p) => p.profil === profilChoisi) ?? profils[0];

          return (
            <>
              <div className="flex flex-col gap-1">
                <RetourReferentiel />
                <h1 className={screenTitle}>{pathologie.nom}</h1>
              </div>

              {pathologie.resume && <p className="text-[14.5px] leading-[1.55] text-ink">{pathologie.resume}</p>}
              {pathologie.source && (
                <p className={eyebrow}>
                  Source : {pathologie.source}
                  {pathologie.source_date ? ` (${pathologie.source_date})` : ""}
                </p>
              )}

              {profils.length === 0 ? (
                <IntrouvableCarte message="Aucun protocole pour l'instant." />
              ) : (
                <>
                  {profils.length > 1 && (
                    <div role="group" aria-label="Profil du patient" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                      {profils.map(({ profil }) => {
                        const actif = profil === courant.profil;
                        return (
                          <button
                            key={profil}
                            type="button"
                            aria-pressed={actif}
                            onClick={() => choisirProfil(profil)}
                            className={`min-h-11 shrink-0 rounded-full border px-3.5 text-[13.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                              actif ? "border-kcal bg-kcal-soft text-kcal" : "border-line bg-surface text-ink-2"
                            }`}
                          >
                            {profil}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <ol className="flex flex-col gap-3" aria-label={`Stratégie pour le profil ${courant.profil}`}>
                    {courant.lignes.map((ligne) => (
                      <LigneTraitement key={ligne.ligne.id} ligne={ligne} />
                    ))}
                  </ol>
                </>
              )}
            </>
          );
        }}
      </AvecReferentiel>
    </div>
  );
}
