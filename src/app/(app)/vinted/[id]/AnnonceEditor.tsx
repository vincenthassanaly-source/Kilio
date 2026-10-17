"use client";

import { useId, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  changerStatutAnnonce,
  modifierAnnonce,
  supprimerAnnonce,
  type AnnonceVinted,
} from "@/app/actions/vinted";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showToast } from "@/components/toast/toast-store";
import { TransitionLink } from "@/components/TransitionLink";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, errorText, input, label, linkButton, primaryButton, screenTitle, sectionTitle } from "@/lib/ui";
import { champsManquants, depasseLimites, descriptionFinale, hashtagsSuggeres, messageManquants, parserHashtags, parserPrix } from "@/lib/vinted/kit";
import {
  COLIS_VINTED,
  DESCRIPTION_MAX,
  ETATS_VINTED,
  LIBELLE_STATUT,
  STATUTS,
  TITRE_MAX,
  estStatut,
  type ChampsAnnonce,
  type ReglagesVinted,
  type Statut,
} from "@/lib/vinted/types";
import { KitPublication } from "./KitPublication";
import { PhotosEditor } from "./PhotosEditor";

type Saisie = Omit<ChampsAnnonce, "prix" | "hashtags"> & { prix: string; hashtags: string };

function versSaisie(a: AnnonceVinted): Saisie {
  return {
    titre: a.titre,
    description: a.description,
    categorie: a.categorie,
    marque: a.marque,
    taille: a.taille,
    etat: a.etat,
    couleur: a.couleur,
    matiere: a.matiere,
    colis: a.colis,
    prix: a.prix === null ? "" : String(a.prix).replace(".", ","),
    hashtags: a.hashtags.join(" "),
  };
}

function versChamps(s: Saisie): ChampsAnnonce {
  const { prix, hashtags, ...reste } = s;
  return { ...reste, prix: parserPrix(prix), hashtags: parserHashtags(hashtags) };
}

function Champ({
  libelle,
  children,
  aide,
}: {
  libelle: string;
  children: (id: string) => React.ReactNode;
  aide?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>
        {libelle}
      </label>
      {children(id)}
      {aide && <div className="text-xs text-ink-3">{aide}</div>}
    </div>
  );
}

export function AnnonceEditor({ annonce, reglages }: { annonce: AnnonceVinted; reglages: ReglagesVinted }) {
  const queryClient = useQueryClient();
  const navigate = useViewTransitionNavigate();
  const [initiale, setInitiale] = useState(() => versSaisie(annonce));
  const [saisie, setSaisie] = useState(initiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const statut: Statut = estStatut(annonce.statut) ? annonce.statut : "brouillon";
  const modifie = JSON.stringify(saisie) !== JSON.stringify(initiale);
  const champs = versChamps(saisie);
  const limites = depasseLimites(champs, reglages.signature);
  const manquants = champsManquants(champs, annonce.photos.length, reglages);
  const suggestions = hashtagsSuggeres(saisie.categorie, champs.hashtags, reglages);
  const longueurFinale = descriptionFinale(champs, reglages).length;

  function maj<K extends keyof Saisie>(cle: K, valeur: Saisie[K]) {
    setSaisie((s) => ({ ...s, [cle]: valeur }));
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.vinted });
  }

  async function enregistrer(): Promise<boolean> {
    if (limites.titre || limites.description) {
      setErreur(
        limites.titre
          ? `Le titre dépasse ${TITRE_MAX} caractères.`
          : `La description (avec signature et hashtags) dépasse ${DESCRIPTION_MAX} caractères.`
      );
      return false;
    }
    if (saisie.prix.trim() && champs.prix === null) {
      setErreur("Le prix est invalide.");
      return false;
    }
    setErreur(null);
    const resultat = await runAction(() => modifierAnnonce(annonce.id, champs), { silencieux: true });
    if (!resultat.ok) {
      setErreur(resultat.error);
      return false;
    }
    setInitiale(saisie);
    invalidate();
    return true;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (await enregistrer()) showToast("Annonce enregistrée", 1800);
    });
  }

  function onStatut(nouveau: Statut) {
    if (nouveau === statut) return;
    startTransition(async () => {
      // Le statut « Prêt » est validé côté serveur sur la version enregistrée.
      if (modifie && !(await enregistrer())) return;
      const resultat = await runAction(() => changerStatutAnnonce(annonce.id, nouveau), { silencieux: true });
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      setErreur(null);
      invalidate();
      showToast(`Statut : ${LIBELLE_STATUT[nouveau]}`, 1800);
    });
  }

  function onSupprimer() {
    startTransition(async () => {
      const resultat = await runAction(() => supprimerAnnonce(annonce.id), { erreur: "La suppression a échoué. Réessaie." });
      setConfirmerSuppression(false);
      if (resultat.ok) {
        invalidate();
        navigate("/vinted");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <TransitionLink href="/vinted" className={`${linkButton} self-start`}>
          ‹ Vinted
        </TransitionLink>
        <h1 className={screenTitle}>{saisie.titre.trim() || "Nouvelle annonce"}</h1>
      </div>

      <section className={`${card} flex flex-col gap-3`}>
        <Champ libelle="Statut" aide={statut === "brouillon" && manquants.length > 0 ? messageManquants(manquants) : undefined}>
          {(id) => (
            <select
              id={id}
              className={input}
              value={statut}
              disabled={enCours}
              onChange={(e) => estStatut(e.target.value) && onStatut(e.target.value)}
            >
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {LIBELLE_STATUT[s]}
                </option>
              ))}
            </select>
          )}
        </Champ>
      </section>

      <PhotosEditor annonceId={annonce.id} photos={annonce.photos} />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={sectionTitle}>Annonce</h2>

          <Champ
            libelle="Titre"
            aide={
              <span className={limites.titre ? "text-alert" : ""}>
                {saisie.titre.length}/{TITRE_MAX}
              </span>
            }
          >
            {(id) => (
              <input
                id={id}
                className={input}
                value={saisie.titre}
                onChange={(e) => maj("titre", e.target.value)}
                placeholder="Marque, type, taille, couleur"
                enterKeyHint="next"
              />
            )}
          </Champ>

          <Champ
            libelle="Description"
            aide={
              <span className={limites.description ? "text-alert" : ""}>
                Texte final avec signature et hashtags : {longueurFinale}/{DESCRIPTION_MAX}
              </span>
            }
          >
            {(id) => (
              <textarea
                id={id}
                className={`${input} min-h-36 resize-y`}
                value={saisie.description}
                onChange={(e) => maj("description", e.target.value)}
                placeholder="État, mesures, défauts éventuels, matière…"
              />
            )}
          </Champ>

          <Champ libelle="Hashtags" aide="Séparés par un espace ; les # et les accents sont gérés automatiquement.">
            {(id) => (
              <input
                id={id}
                className={input}
                value={saisie.hashtags}
                onChange={(e) => maj("hashtags", e.target.value)}
                placeholder="#robe #vintage"
                autoCapitalize="none"
              />
            )}
          </Champ>
          {suggestions.length > 0 && (
            <button
              type="button"
              className="min-h-11 self-start text-sm font-semibold text-kcal underline-offset-2 hover:underline"
              onClick={() => maj("hashtags", [...champs.hashtags, ...suggestions].join(" "))}
            >
              Ajouter mes hashtags habituels ({suggestions.length})
            </button>
          )}
        </section>

        <section className={`${card} grid grid-cols-2 gap-3`}>
          <h2 className={`${sectionTitle} col-span-2`}>Détails</h2>
          <div className="col-span-2">
            <Champ libelle="Catégorie">
              {(id) => (
                <input
                  id={id}
                  className={input}
                  value={saisie.categorie}
                  onChange={(e) => maj("categorie", e.target.value)}
                  placeholder="Femmes › Robes › Robes midi"
                />
              )}
            </Champ>
          </div>
          <Champ libelle="Marque">
            {(id) => <input id={id} className={input} value={saisie.marque} onChange={(e) => maj("marque", e.target.value)} />}
          </Champ>
          <Champ libelle="Taille">
            {(id) => <input id={id} className={input} value={saisie.taille} onChange={(e) => maj("taille", e.target.value)} />}
          </Champ>
          <Champ libelle="État">
            {(id) => (
              <>
                <input id={id} className={input} list={`${id}-etats`} value={saisie.etat} onChange={(e) => maj("etat", e.target.value)} />
                <datalist id={`${id}-etats`}>
                  {ETATS_VINTED.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </>
            )}
          </Champ>
          <Champ libelle="Couleur">
            {(id) => <input id={id} className={input} value={saisie.couleur} onChange={(e) => maj("couleur", e.target.value)} />}
          </Champ>
          <Champ libelle="Matière">
            {(id) => <input id={id} className={input} value={saisie.matiere} onChange={(e) => maj("matiere", e.target.value)} />}
          </Champ>
          <Champ libelle="Prix (€)">
            {(id) => (
              <input
                id={id}
                className={input}
                inputMode="decimal"
                value={saisie.prix}
                onChange={(e) => maj("prix", e.target.value)}
                placeholder="12,50"
              />
            )}
          </Champ>
          <div className="col-span-2">
            <Champ libelle="Colis" aide={reglages.colis_defaut ? `Par défaut : ${reglages.colis_defaut}` : undefined}>
              {(id) => (
                <>
                  <input id={id} className={input} list={`${id}-colis`} value={saisie.colis} onChange={(e) => maj("colis", e.target.value)} />
                  <datalist id={`${id}-colis`}>
                    {COLIS_VINTED.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Champ>
          </div>
        </section>

        {erreur && (
          <p className={errorText} role="alert">
            {erreur}
          </p>
        )}

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
          <button type="submit" disabled={enCours || !modifie} className={`${primaryButton} min-h-11 flex-1`}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          <span className="text-xs text-ink-3" role="status">
            {modifie ? "Modifications non enregistrées" : "À jour"}
          </span>
        </div>
      </form>

      <KitPublication
        champs={champs}
        reglages={reglages}
        urlsPhotos={annonce.photos.map((p) => p.url)}
        prixTexte={champs.prix === null ? "" : String(champs.prix)}
      />

      <button type="button" className={`${dangerButton} self-start`} onClick={() => setConfirmerSuppression(true)}>
        Supprimer l&apos;annonce
      </button>

      <ConfirmDialog
        open={confirmerSuppression}
        titre="Supprimer cette annonce ?"
        confirmer={`Supprimer l'annonce et ${annonce.photos.length} photo${annonce.photos.length > 1 ? "s" : ""}`}
        enCours={enCours}
        onConfirm={onSupprimer}
        onClose={() => setConfirmerSuppression(false)}
      >
        <p>Les photos sont effacées définitivement. Cette action est irréversible.</p>
      </ConfirmDialog>
    </div>
  );
}
