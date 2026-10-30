"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { DocumentAvecFichiers } from "@/app/actions/documents";
import { AddDocumentToggle } from "./AddDocumentToggle";
import { DocumentsList } from "./DocumentsList";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TAILLE_LOT_TRI } from "@/lib/documents/tri";
import { normalizeSearch } from "@/lib/normalize";
import { card, input, kcalPillTag, pillTag, primaryButton, secondaryButton, zoneTapPill } from "@/lib/ui";

const TriVracModal = dynamic(() => import("./TriVracModal").then((m) => m.TriVracModal), { ssr: false });
const ReorganiserModal = dynamic(() => import("./ReorganiserModal").then((m) => m.ReorganiserModal), { ssr: false });

/** Il faut au moins deux documents classés pour que réorganiser ait un sens. */
const DOCUMENTS_MIN_REORGANISATION = 2;

type TriCle = "recent" | "nom" | "categorie";
type Onglet = "documents" | "vrac";

const TRI_LABELS: Record<TriCle, string> = {
  recent: "Récent",
  nom: "Nom A→Z",
  categorie: "Catégorie A→Z",
};

const BOUTON_ICONE =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-alt";

function CategorieIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function EtincelleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

export function DocumentsBrowser({
  documents,
  categories,
  vracInitial = false,
  categoriesInitiales = [],
}: {
  documents: DocumentAvecFichiers[];
  /** Noms des catégories (table documents_categories). */
  categories: string[];
  /** Ouvre l'onglet Vrac (arrivée depuis le partage Android). */
  vracInitial?: boolean;
  /** Catégories présélectionnées (`?categorie=` : lien depuis l'écran Catégories). */
  categoriesInitiales?: string[];
}) {
  const [search, setSearch] = useState("");
  const [categorieFilter, setCategorieFilter] = useState<string[]>(categoriesInitiales);
  const [tri, setTri] = useState<TriCle>("recent");
  const [onglet, setOnglet] = useState<Onglet>(vracInitial ? "vrac" : "documents");
  const [triOuvert, setTriOuvert] = useState(false);
  const [reorganiserOuvert, setReorganiserOuvert] = useState(false);
  // Documents restés en vrac lors d'un tri précédent (échec, décochés) : le
  // clic suivant sur « Trier » passe aux autres plutôt que de les reprendre.
  const [ignores, setIgnores] = useState<string[]>([]);

  const vrac = useMemo(
    () => documents.filter((d) => d.en_vrac).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [documents]
  );
  // Un onglet Vrac vide n'a rien à montrer : retour automatique aux documents.
  const ongletActif: Onglet = onglet === "vrac" && vrac.length > 0 ? "vrac" : "documents";
  const classes = useMemo(() => documents.filter((d) => !d.en_vrac), [documents]);
  const base = ongletActif === "vrac" ? vrac : classes;

  // Pastilles : les catégories qui ont au moins un document classé (une
  // catégorie vide n'apporte rien à filtrer), plus celles déjà sélectionnées
  // pour que l'on voie pourquoi la liste est vide.
  const pastilles = useMemo(() => {
    const comptes = new Map<string, number>();
    for (const document of classes) {
      if (document.categorie) comptes.set(document.categorie, (comptes.get(document.categorie) ?? 0) + 1);
    }
    const noms = new Set<string>([...comptes.keys(), ...categorieFilter]);
    // Ordre de la liste des catégories, puis celles qui n'y figurent plus.
    const ordonnees = [...categories.filter((c) => noms.has(c)), ...[...noms].filter((c) => !categories.includes(c))];
    return ordonnees.map((nom) => ({ nom, nb: comptes.get(nom) ?? 0 }));
  }, [classes, categories, categorieFilter]);

  function toggleCategorie(nom: string) {
    setCategorieFilter((noms) => (noms.includes(nom) ? noms.filter((n) => n !== nom) : [...noms, nom]));
  }

  // Recherche client-side (nom, notes, catégorie) : même approche que
  // NotesGrid, le volume mono-utilisateur ne justifie pas une recherche
  // full-text Postgres.
  const filtres = useMemo(() => {
    const term = normalizeSearch(search);
    const filtrer = ongletActif === "documents" && categorieFilter.length > 0;
    return base.filter((document) => {
      const matchesSearch =
        term === "" ||
        normalizeSearch(document.nom).includes(term) ||
        normalizeSearch(document.notes ?? "").includes(term) ||
        normalizeSearch(document.categorie ?? "").includes(term);
      const matchesCategorie = !filtrer || (document.categorie !== null && categorieFilter.includes(document.categorie));
      return matchesSearch && matchesCategorie;
    });
  }, [base, search, categorieFilter, ongletActif]);

  const tries = useMemo(() => {
    const copie = [...filtres];
    switch (tri) {
      case "nom":
        return copie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      case "categorie":
        return copie.sort((a, b) => {
          if (a.categorie === b.categorie) return a.nom.localeCompare(b.nom, "fr");
          if (a.categorie === null) return 1;
          if (b.categorie === null) return -1;
          return a.categorie.localeCompare(b.categorie, "fr");
        });
      case "recent":
      default:
        return copie.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }, [filtres, tri]);

  // Prochain lot à trier : les plus anciens d'abord, en laissant de côté ceux
  // déjà passés et restés en vrac ; s'il ne reste qu'eux, on les reprend.
  const lotATrier = useMemo(() => {
    const restants = vrac.filter((d) => !ignores.includes(d.id));
    return (restants.length > 0 ? restants : vrac).slice(0, TAILLE_LOT_TRI);
  }, [vrac, ignores]);

  const aucunDocument = documents.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {classes.length >= DOCUMENTS_MIN_REORGANISATION && (
        <button
          type="button"
          onClick={() => setReorganiserOuvert(true)}
          className={`${secondaryButton} flex min-h-11 items-center justify-center gap-2 self-end px-4 py-2 text-sm`}
        >
          <EtincelleIcon />
          Réorganiser
        </button>
      )}

      {ongletActif === "documents" && <AddDocumentToggle categories={categories} />}

      {vrac.length > 0 && (
        <SegmentedControl<Onglet>
          ariaLabel="Documents ou vrac"
          value={ongletActif}
          onChange={setOnglet}
          glissant
          options={[
            { value: "documents", label: "Documents" },
            { value: "vrac", label: `Vrac (${vrac.length})`, ariaLabel: `Vrac, ${vrac.length} à trier` },
          ]}
        />
      )}

      {ongletActif === "vrac" && (
        <div className={`${card} flex flex-col gap-3`}>
          <p className="text-sm text-ink-2">
            Documents reçus par le partage, en attente de classement. Gemini propose un nom et une catégorie ; tu
            valides avant que rien ne change.
          </p>
          <button
            type="button"
            onClick={() => setTriOuvert(true)}
            className={`${primaryButton} flex items-center justify-center gap-2`}
          >
            <EtincelleIcon />
            {vrac.length > TAILLE_LOT_TRI ? `Trier ${TAILLE_LOT_TRI} documents` : "Trier"}
          </button>
          {vrac.length > TAILLE_LOT_TRI && (
            <p className="-mt-1 text-xs text-ink-3">
              Les documents sont triés par lots de {TAILLE_LOT_TRI} : relance après chaque lot.
            </p>
          )}
        </div>
      )}

      {!aucunDocument && (
        <>
          {ongletActif === "documents" && (
            // Les pastilles passent à la ligne au lieu de défiler dans une seule
            // rangée coupée : toutes les catégories restent visibles. 16 px
            // entre les rangées pour que les zones de toucher ne se chevauchent pas.
            <div className="flex flex-wrap items-center gap-x-2 gap-y-4" role="group" aria-label="Filtrer par catégorie">
              <Link
                href="/documents/categories"
                aria-label="Gérer les catégories"
                title="Gérer les catégories"
                className={BOUTON_ICONE}
              >
                <CategorieIcon />
              </Link>
              {pastilles.map(({ nom, nb }) => {
                const actif = categorieFilter.includes(nom);
                return (
                  <button
                    key={nom}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => toggleCategorie(nom)}
                    className={`${actif ? kcalPillTag : pillTag} ${zoneTapPill}`}
                  >
                    {/* L'état ne tient pas qu'à la couleur : coche + aria-pressed. */}
                    {actif && <span aria-hidden="true">✓ </span>}
                    {nom} <span className="tabular-nums opacity-70">{nb}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Rechercher un document…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${input} min-w-0 flex-1`}
            />
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value as TriCle)}
              aria-label="Trier les documents"
              className={`${input} max-w-[152px] shrink-0 truncate`}
            >
              {(Object.keys(TRI_LABELS) as TriCle[]).map((key) => (
                <option key={key} value={key}>
                  {TRI_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {base.length === 0 ? (
            <p className="py-5 text-center text-sm text-ink-3">
              Tous tes documents sont en vrac : trie-les depuis l&apos;onglet Vrac.
            </p>
          ) : filtres.length === 0 ? (
            <p className="py-5 text-center text-sm text-ink-3">
              {ongletActif === "documents" && categorieFilter.length > 0 && search === ""
                ? "Aucun document dans cette catégorie."
                : "Aucun document ne correspond à ta recherche."}
            </p>
          ) : (
            <DocumentsList documents={tries} categories={categories} />
          )}
        </>
      )}

      {aucunDocument && <DocumentsList documents={documents} categories={categories} />}

      {reorganiserOuvert && <ReorganiserModal categories={categories} onClose={() => setReorganiserOuvert(false)} />}

      {triOuvert && (
        <TriVracModal
          lot={lotATrier}
          categories={categories}
          onClose={() => setTriOuvert(false)}
          onIgnores={(ids) => setIgnores((courants) => [...new Set([...courants, ...ids])])}
        />
      )}
    </div>
  );
}
