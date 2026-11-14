"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  creerCategorie,
  fusionnerCategories,
  renommerCategorie,
  supprimerCategorie,
  type CategorieAvecCompte,
} from "@/app/actions/documents-categories";
import { runAction } from "@/lib/actions/runAction";
import type { ActionResult } from "@/lib/actions/result";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { useMasques } from "@/lib/actions/elementsMasques";
import { CATEGORIE_MAX } from "@/lib/documents/tri";
import {
  actionsLigne,
  card,
  dangerButton,
  errorText,
  ghostButton,
  input,
  listCard,
  metaText,
  nameTextComplet,
  primaryButton,
  textButton,
} from "@/lib/ui";

function libelleNombre(nb: number) {
  return nb === 0 ? "Aucun document" : `${nb} document${nb > 1 ? "s" : ""}`;
}

function AjoutCategorie() {
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(() => creerCategorie(nom), { silencieux: true });
      if (resultat.ok) setNom("");
      else setErreur(resultat.error);
    });
  }

  return (
    <form onSubmit={ajouter} className={`${card} flex flex-col gap-2`}>
      <label htmlFor="nouvelle-categorie" className="text-sm font-medium text-ink">
        Nouvelle catégorie
      </label>
      <div className="flex gap-2">
        <input
          id="nouvelle-categorie"
          value={nom}
          maxLength={CATEGORIE_MAX}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex. Banque"
          className={`${input} min-w-0 flex-1`}
        />
        <button type="submit" disabled={enCours || !nom.trim()} className={primaryButton}>
          Ajouter
        </button>
      </div>
      {erreur && (
        <p role="alert" className={errorText}>
          {erreur}
        </p>
      )}
    </form>
  );
}

function LigneCategorie({ categorie, autres }: { categorie: CategorieAvecCompte; autres: CategorieAvecCompte[] }) {
  const [mode, setMode] = useState<"lecture" | "renommer" | "fusionner">("lecture");
  const [nom, setNom] = useState(categorie.nom);
  const [cible, setCible] = useState(autres[0]?.id ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function executer(action: () => Promise<ActionResult<undefined>>, apres?: () => void) {
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(action, { silencieux: true });
      if (resultat.ok) apres?.();
      else setErreur(resultat.error);
    });
  }

  // Suppression différée : la catégorie disparaît tout de suite, « Annuler » la
  // ramène pendant le délai du toast. Les documents qui la portent ne sont
  // touchés qu'à l'expiration du délai : ils gardent alors leur contenu mais
  // n'ont plus de catégorie. Annuler = rien n'a changé.
  function supprimer() {
    setErreur(null);
    const consequence =
      categorie.nb > 0
        ? ` · ${categorie.nb} document${categorie.nb > 1 ? "s" : ""} sans catégorie`
        : "";
    supprimerAvecAnnulation({
      texte: `Catégorie « ${categorie.nom} » supprimée${consequence}`,
      ariaLabel: `Annuler la suppression de la catégorie « ${categorie.nom} »`,
      masque: { type: "categorie-document", id: categorie.id },
      supprimer: () => supprimerCategorie(categorie.id),
      erreur: `Impossible de supprimer la catégorie « ${categorie.nom} ». Réessaie.`,
    });
  }

  if (mode === "renommer") {
    return (
      <li className={`${listCard} gap-2`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nom.trim()) executer(() => renommerCategorie(categorie.id, nom), () => setMode("lecture"));
          }}
          className="flex flex-col gap-2"
        >
          <input
            value={nom}
            maxLength={CATEGORIE_MAX}
            onChange={(e) => setNom(e.target.value)}
            aria-label={`Nouveau nom de la catégorie ${categorie.nom}`}
            autoFocus
            className={`${input} py-1.5`}
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={enCours || !nom.trim()} className={ghostButton}>
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setNom(categorie.nom);
                setErreur(null);
                setMode("lecture");
              }}
              className={textButton}
            >
              Annuler
            </button>
          </div>
        </form>
        {erreur && (
          <p role="alert" className={errorText}>
            {erreur}
          </p>
        )}
      </li>
    );
  }

  if (mode === "fusionner") {
    return (
      <li className={`${listCard} gap-2`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (cible) executer(() => fusionnerCategories(categorie.id, cible), () => setMode("lecture"));
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor={`fusion-${categorie.id}`} className="text-sm text-ink">
            Fusionner « {categorie.nom} » dans :
          </label>
          <select
            id={`fusion-${categorie.id}`}
            value={cible}
            onChange={(e) => setCible(e.target.value)}
            className={`${input} py-1.5`}
          >
            {autres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          <p className={metaText}>
            {categorie.nb > 0 ? `${libelleNombre(categorie.nb)} passeront dans la catégorie choisie. ` : ""}« {categorie.nom} » sera supprimée.
          </p>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={enCours || !cible} className={ghostButton}>
              Fusionner
            </button>
            <button
              type="button"
              onClick={() => {
                setErreur(null);
                setMode("lecture");
              }}
              className={textButton}
            >
              Annuler
            </button>
          </div>
        </form>
        {erreur && (
          <p role="alert" className={errorText}>
            {erreur}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className={`${listCard} gap-2`}>
      <div className="flex flex-col gap-2">
        {/* Toucher le nom ouvre la liste des documents de la catégorie (page
            Documents filtrée). L'état local (déjà enregistré côté serveur), pas la
            prop : un renommage réussi doit s'afficher tout de suite (CLICK-PATH-702). */}
        <Link
          href={`/documents?categorie=${encodeURIComponent(nom)}`}
          aria-label={`Voir les documents de la catégorie ${nom} (${libelleNombre(categorie.nb).toLowerCase()})`}
          className="flex min-w-0 items-center justify-between gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          <div className="flex min-w-0 flex-col">
            <p className={nameTextComplet}>{nom}</p>
            <span className={metaText}>{libelleNombre(categorie.nb)}</span>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-ink-3"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
        <div className={actionsLigne}>
          <button type="button" onClick={() => setMode("renommer")} className={ghostButton}>
            Modifier
          </button>
          {autres.length > 0 && (
            <button type="button" onClick={() => setMode("fusionner")} className={ghostButton}>
              Fusionner
            </button>
          )}
          <button type="button" onClick={supprimer} className={dangerButton}>
            Supprimer
          </button>
        </div>
      </div>
      {erreur && (
        <p role="alert" className={errorText}>
          {erreur}
        </p>
      )}
    </li>
  );
}

export function CategoriesManager({ categories: toutes }: { categories: CategorieAvecCompte[] }) {
  // Catégories en cours de suppression (toast « Annuler » encore affiché) : cachées.
  const masquees = useMasques("categorie-document");
  const categories = toutes.filter((c) => !masquees.has(c.id));
  return (
    <div className="flex flex-col gap-4">
      <AjoutCategorie />
      {categories.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-2 py-8 text-center`}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
          </svg>
          <p className="text-body font-bold text-ink text-balance">Aucune catégorie pour l&apos;instant.</p>
          <p className="text-sm text-ink-2 text-pretty">Crée-en une ci-dessus pour classer tes documents.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((categorie) => (
            <LigneCategorie
              key={categorie.id}
              categorie={categorie}
              autres={categories.filter((c) => c.id !== categorie.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
