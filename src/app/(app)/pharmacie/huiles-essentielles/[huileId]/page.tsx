"use client";

import { use, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supprimerHuile } from "@/app/actions/huiles";
import { TransitionLink } from "@/components/TransitionLink";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, eyebrow, linkButton, pillIndication, pillTag, screenTitle, secondaryButton, sectionTitle } from "@/lib/ui";
import { huileParId, libelleVoie, type PharmaHuile } from "@/lib/pharmacie/huiles";
import { IntrouvableCarte } from "../../EtatSnapshot";
import { BadgeComestible, BadgeDermocaustique, BadgePhotosensibilisante, BadgePrecaution } from "../BadgesHuile";
import { AvecHuiles } from "../EtatHuiles";
import { HuileEditeur } from "../HuileEditeur";

function Retour() {
  return (
    <TransitionLink href="/pharmacie/huiles-essentielles" className={`${linkButton} self-start`}>
      ← Huiles essentielles
    </TransitionLink>
  );
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={titre}>
      <h2 className={sectionTitle}>{titre}</h2>
      <div className={`${card} flex flex-col gap-3`}>{children}</div>
    </section>
  );
}

function Texte({ titre, texte }: { titre: string; texte: string | null }) {
  if (!texte) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{titre}</h3>
      <p className="whitespace-pre-line text-[14.5px] leading-[1.5] text-ink">{texte}</p>
    </div>
  );
}

function Tags({ titre, tags, className }: { titre: string; tags: string[]; className: string }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{titre}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <li key={tag} className={className}>
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HuilePage({ params }: { params: Promise<{ huileId: string }> }) {
  const { huileId } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <AvecHuiles>
        {(snapshot) => {
          const huile = huileParId(snapshot, huileId);
          if (!huile) {
            return (
              <>
                <Retour />
                <IntrouvableCarte titre="Huile introuvable" message="Cette huile n'existe plus : elle a peut-être été supprimée." />
              </>
            );
          }
          return <Fiche huile={huile} huiles={snapshot.huiles} />;
        }}
      </AvecHuiles>
    </div>
  );
}

function Fiche({ huile, huiles }: { huile: PharmaHuile; huiles: PharmaHuile[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, startTransition] = useTransition();

  const identite = [
    ["Famille botanique", huile.famille],
    ["Partie distillée", huile.partie_distillee],
    ["Chémotype", huile.chemotype],
  ].filter((l): l is [string, string] => Boolean(l[1]));
  const aDesAlertes = huile.dermocaustique || huile.photosensibilisante || huile.precautions.length > 0 || huile.precautions_details;

  function supprimer() {
    startTransition(async () => {
      const resultat = await runAction(() => supprimerHuile(huile.id), { erreur: "La suppression a échoué." });
      if (!resultat.ok) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pharmacieHuiles }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pharmacie }),
      ]);
      showToast("Huile supprimée");
      router.push("/pharmacie/huiles-essentielles");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Retour />
        <h1 className={screenTitle}>{huile.nom_fr}</h1>
        {huile.nom_latin && <p className="text-[15px] italic text-ink-2">{huile.nom_latin}</p>}
        <div className="mt-1">
          <BadgeComestible huile={huile} />
        </div>
      </div>

      {/* La sécurité passe avant tout le reste : c'est ce qu'on cherche d'abord à vérifier. */}
      {aDesAlertes && (
        <Bloc titre="Précautions">
          <ul className="flex flex-wrap gap-1.5" aria-label="Alertes de sécurité">
            {huile.dermocaustique && (
              <li>
                <BadgeDermocaustique />
              </li>
            )}
            {huile.photosensibilisante && (
              <li>
                <BadgePhotosensibilisante />
              </li>
            )}
            {huile.precautions.map((cle) => (
              <li key={cle}>
                <BadgePrecaution cle={cle} />
              </li>
            ))}
          </ul>
          {huile.precautions.length > 0 && <p className={eyebrow}>Déconseillée ou à éviter pour les cas ci-dessus.</p>}
          <Texte titre="Précisions" texte={huile.precautions_details} />
        </Bloc>
      )}

      {(huile.voies.length > 0 || huile.dosage || huile.mode_emploi) && (
        <Bloc titre="Utilisation">
          {huile.voies.length > 0 && (
            <Tags titre="Voies" tags={huile.voies.map(libelleVoie)} className={pillTag.replace("shrink-0 ", "")} />
          )}
          <Texte titre="Dosage et dilution" texte={huile.dosage} />
          <Texte titre="Mode d'emploi" texte={huile.mode_emploi} />
        </Bloc>
      )}

      {(huile.indications.length > 0 || huile.proprietes.length > 0) && (
        <Bloc titre="Indications et propriétés">
          <Tags titre="Indications" tags={huile.indications} className={pillIndication} />
          <Tags titre="Propriétés" tags={huile.proprietes} className={pillTag.replace("shrink-0 ", "")} />
        </Bloc>
      )}

      {identite.length > 0 && (
        <Bloc titre="Identité botanique">
          <dl className="flex flex-col gap-2">
            {identite.map(([libelle, valeur]) => (
              <div key={libelle} className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-ink-2">{libelle}</dt>
                <dd className="text-right text-[14.5px] font-medium text-ink">{valeur}</dd>
              </div>
            ))}
          </dl>
        </Bloc>
      )}

      {(huile.notes || huile.sources) && (
        <Bloc titre="Notes">
          <Texte titre="Notes personnelles" texte={huile.notes} />
          <Texte titre="Sources" texte={huile.sources} />
        </Bloc>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setEdition(true)} className={`${secondaryButton} min-h-11`}>
          Modifier la fiche
        </button>
        {confirmation ? (
          <div className="flex items-center gap-2" role="group" aria-label="Confirmer la suppression">
            <button type="button" onClick={supprimer} disabled={enCours} className={`${dangerButton} min-h-11`}>
              {enCours ? "Suppression…" : "Confirmer la suppression"}
            </button>
            <button type="button" onClick={() => setConfirmation(false)} className={`${secondaryButton} min-h-11`}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmation(true)} className={`${dangerButton} min-h-11`}>
            Supprimer
          </button>
        )}
      </div>
      {confirmation && <p className={eyebrow}>Les cartes de révision de cette huile seront supprimées avec elle.</p>}
      {edition && <HuileEditeur huile={huile} huiles={huiles} onClose={() => setEdition(false)} />}
    </div>
  );
}
