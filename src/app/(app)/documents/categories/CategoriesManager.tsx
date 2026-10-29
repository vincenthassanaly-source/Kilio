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
import { confirmDelete } from "@/lib/confirm";
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

  function supprimer() {
    const phrase =
      categorie.nb > 0
        ? `Supprimer la catégorie « ${categorie.nom} » ? Ses ${categorie.nb} document${categorie.nb > 1 ? "s" : ""} ne seront pas supprimés mais n'auront plus de catégorie.`
        : `Supprimer la catégorie « ${categorie.nom} » ?`;
    if (!confirmDelete(phrase)) return;
    executer(() => supprimerCategorie(categorie.id));
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
              className="text-sm text-ink-2 underline"
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
              className="text-sm text-ink-2 underline"
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
          <button type="button" disabled={enCours} onClick={supprimer} className={dangerButton}>
            Suppr.
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

export function CategoriesManager({ categories }: { categories: CategorieAvecCompte[] }) {
  return (
    <div className="flex flex-col gap-4">
      <AjoutCategorie />
      {categories.length === 0 ? (
        <p className="text-ink-2">Aucune catégorie pour l&apos;instant.</p>
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
