"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { DocumentAvecFichiers } from "@/app/actions/documents";
import type { Tables } from "@/lib/supabase/types";
import { AddDocumentToggle } from "./AddDocumentToggle";
import { DocumentsList } from "./DocumentsList";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TAILLE_LOT_TRI } from "@/lib/documents/tri";
import { normalizeSearch } from "@/lib/normalize";
import { card, input, kcalPillTag, pillTag, primaryButton } from "@/lib/ui";

const TriVracModal = dynamic(() => import("./TriVracModal").then((m) => m.TriVracModal), { ssr: false });

type TriCle = "echeance" | "nom" | "recent" | "etiquette";
type Onglet = "documents" | "vrac";

const TRI_LABELS: Record<TriCle, string> = {
  echeance: "Échéance ↑",
  nom: "Nom A→Z",
  recent: "Récent",
  etiquette: "Étiquette A→Z",
};

const BOUTON_ICONE =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-alt";

function EtiquetteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 3.5h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 1.4-.6z" />
      <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
  etiquettes,
  categories,
  vracInitial = false,
}: {
  documents: DocumentAvecFichiers[];
  etiquettes: Tables<"etiquettes">[];
  categories: string[];
  /** Ouvre l'onglet Vrac (arrivée depuis le partage Android). */
  vracInitial?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [etiquetteFilter, setEtiquetteFilter] = useState<string[]>([]);
  const [tri, setTri] = useState<TriCle>("echeance");
  const [onglet, setOnglet] = useState<Onglet>(vracInitial ? "vrac" : "documents");
  const [triOuvert, setTriOuvert] = useState(false);
  // Documents restés en vrac lors d'un tri précédent (échec, décochés) : le
  // clic suivant sur « Trier » passe aux autres plutôt que de les reprendre.
  const [ignores, setIgnores] = useState<string[]>([]);

  const vrac = useMemo(
    () => documents.filter((d) => d.en_vrac).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [documents]
  );
  // Un onglet Vrac vide n'a rien à montrer : retour automatique aux documents.
  const ongletActif: Onglet = onglet === "vrac" && vrac.length > 0 ? "vrac" : "documents";
  const base = useMemo(
    () => (ongletActif === "vrac" ? vrac : documents.filter((d) => !d.en_vrac)),
    [ongletActif, vrac, documents]
  );

  function toggleEtiquetteFilter(id: string) {
    setEtiquetteFilter((ids) => (ids.includes(id) ? ids.filter((e) => e !== id) : [...ids, id]));
  }

  // Recherche client-side (nom, notes, catégorie, étiquette) : même approche
  // que NotesGrid, le volume mono-utilisateur ne justifie pas une recherche
  // full-text Postgres.
  const filtres = useMemo(() => {
    const term = normalizeSearch(search);
    return base.filter((document) => {
      const matchesSearch =
        term === "" ||
        normalizeSearch(document.nom).includes(term) ||
        normalizeSearch(document.notes ?? "").includes(term) ||
        normalizeSearch(document.categorie ?? "").includes(term) ||
        (document.etiquette ? normalizeSearch(document.etiquette.nom).includes(term) : false);
      const matchesEtiquette =
        etiquetteFilter.length === 0 ||
        (document.etiquette !== null && etiquetteFilter.includes(document.etiquette.id));
      return matchesSearch && matchesEtiquette;
    });
  }, [base, search, etiquetteFilter]);

  const tries = useMemo(() => {
    const copie = [...filtres];
    switch (tri) {
      case "nom":
        return copie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      case "recent":
        return copie.sort((a, b) => b.created_at.localeCompare(a.created_at));
      case "etiquette":
        return copie.sort((a, b) =>
          (a.etiquette?.nom ?? "").localeCompare(b.etiquette?.nom ?? "", "fr")
        );
      case "echeance":
      default:
        // L'ordre déjà renvoyé par getDocuments() (échéance croissante,
        // nulls en dernier) est préservé par ce tri stable.
        return copie.sort((a, b) => {
          if (a.date_echeance === b.date_echeance) return 0;
          if (a.date_echeance === null) return 1;
          if (b.date_echeance === null) return -1;
          return a.date_echeance.localeCompare(b.date_echeance);
        });
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
      {ongletActif === "documents" && <AddDocumentToggle etiquettes={etiquettes} categories={categories} />}

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
            <div className="flex items-center gap-2 overflow-x-auto pb-1" data-swipe-ignore>
              <Link
                href="/documents/categories"
                aria-label="Gérer les catégories"
                title="Gérer les catégories"
                className={BOUTON_ICONE}
              >
                <CategorieIcon />
              </Link>
              <Link
                href="/documents/etiquettes"
                aria-label="Gérer les étiquettes"
                title="Gérer les étiquettes"
                className={BOUTON_ICONE}
              >
                <EtiquetteIcon />
              </Link>
              {etiquettes.map((etiquette) => (
                <button
                  key={etiquette.id}
                  type="button"
                  onClick={() => toggleEtiquetteFilter(etiquette.id)}
                  className={
                    etiquetteFilter.includes(etiquette.id) ? `${kcalPillTag} shrink-0` : `${pillTag} shrink-0`
                  }
                >
                  {etiquette.nom}
                </button>
              ))}
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
            <p className="py-5 text-center text-sm text-ink-3">Aucun document ne correspond à ta recherche.</p>
          ) : (
            <DocumentsList documents={tries} etiquettes={etiquettes} categories={categories} />
          )}
        </>
      )}

      {aucunDocument && <DocumentsList documents={documents} etiquettes={etiquettes} categories={categories} />}

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
