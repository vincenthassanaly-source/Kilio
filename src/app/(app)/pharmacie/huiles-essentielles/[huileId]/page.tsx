"use client";

import { use, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supprimerHuile } from "@/app/actions/huiles";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, eyebrow, pillIndication, pillTag, screenTitle, secondaryButton, sectionTitle } from "@/lib/ui";
import { huileParId, libelleVoie, type PharmaHuile } from "@/lib/pharmacie/huiles";
import { IntrouvableCarte } from "../../EtatSnapshot";
import { BadgeComestible, BadgeDermocaustique, BadgePhotosensibilisante, BadgePrecaution } from "../BadgesHuile";
import { AvecHuiles } from "../EtatHuiles";
import { HuileEditeur } from "../HuileEditeur";
import { BackLink } from "@/components/BackLink";

function Retour() {
  return (
    <BackLink href="/pharmacie/huiles-essentielles">Huiles essentielles</BackLink>
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
      <h3 className="text-small font-semibold uppercase tracking-wide text-ink-3">{titre}</h3>
      <p className="whitespace-pre-line text-body leading-[1.5] text-ink">{texte}</p>
    </div>
  );
}

function Tags({ titre, tags, className }: { titre: string; tags: string[]; className: string }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-small font-semibold uppercase tracking-wide text-ink-3">{titre}</h3>
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

  const identite = [
    ["Famille botanique", huile.famille],
    ["Partie distillée", huile.partie_distillee],
    ["Chémotype", huile.chemotype],
  ].filter((l): l is [string, string] => Boolean(l[1]));
  const aDesAlertes = huile.dermocaustique || huile.photosensibilisante || huile.precautions.length > 0 || huile.precautions_details;

  // Suppression différée : retour à la liste (où l'huile est masquée), « Annuler »
  // la ramène pendant le délai du toast. Les cartes de révision de cette huile
  // sont supprimées avec elle à l'expiration du délai ; annuler = rien n'a changé.
  function supprimer() {
    supprimerAvecAnnulation({
      texte: `Huile « ${huile.nom_fr} » supprimée avec ses cartes de révision`,
      ariaLabel: `Annuler la suppression de l'huile « ${huile.nom_fr} »`,
      masque: { type: "huile", id: huile.id },
      masquer: () => router.push("/pharmacie/huiles-essentielles"),
      supprimer: () => supprimerHuile(huile.id),
      erreur: `Impossible de supprimer l'huile « ${huile.nom_fr} ». Réessaie.`,
      onSupprime: () =>
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.pharmacieHuiles }),
          queryClient.invalidateQueries({ queryKey: queryKeys.pharmacie }),
        ]),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Retour />
        <h1 className={screenTitle}>{huile.nom_fr}</h1>
        {huile.nom_latin && <p className="text-body italic text-ink-2">{huile.nom_latin}</p>}
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
                <dt className="text-small text-ink-2">{libelle}</dt>
                <dd className="text-right text-body font-medium text-ink">{valeur}</dd>
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
        <button type="button" onClick={supprimer} className={`${dangerButton} min-h-11`}>
          Supprimer
        </button>
      </div>
      {edition && <HuileEditeur huile={huile} huiles={huiles} onClose={() => setEdition(false)} />}
    </div>
  );
}
