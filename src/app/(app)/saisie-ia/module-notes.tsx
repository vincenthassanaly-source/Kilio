"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { getTags } from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import { pillTag } from "@/lib/ui";
import type { EditionFormulaire, ElementDe, ModuleIAClient } from "./module-client";
import { Avertissements } from "./communs";

type ElementNote = ElementDe<"note">;

const NoteForm = dynamic(() => import("../notes/NoteForm").then((m) => m.NoteForm), { ssr: false });

// Module « Notes » de « Ajouter avec l'IA » (facette client).

function Detail({ element }: { element: ElementNote }) {
  const n = element.donnees;
  const pastilles = [n.type === "checklist" ? `Checklist · ${n.items.length} ${n.items.length === 1 ? "élément" : "éléments"}` : "Texte", ...n.tagNoms.map((t) => `#${t}`)];
  return (
    <>
      {n.type === "texte" && n.contenu !== n.titre && (
        <p className="line-clamp-2 whitespace-pre-line text-[12.5px] text-ink-2">{n.contenu}</p>
      )}
      {n.type === "checklist" && (
        <p className="line-clamp-2 text-[12.5px] text-ink-2">{n.items.join(" · ")}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {pastilles.map((texte) => (
          <span key={texte} className={pillTag}>
            {texte}
          </span>
        ))}
      </div>
      <Avertissements textes={n.avertissements} />
    </>
  );
}

function Formulaire({ edition, onDone }: { edition: EditionFormulaire; onDone: () => void }) {
  const { data: tags = [] } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });
  const n = edition.element?.type === "note" ? edition.element.donnees : undefined;
  return (
    <NoteForm
      tags={tags}
      onDone={onDone}
      initial={
        n
          ? { titre: n.titre, type: n.type, contenu: n.contenu, items: n.items, tagIds: n.tagIds, nouveauxTags: n.nouveauxTags }
          : { titre: edition.titre, type: "texte", contenu: "", items: [], tagIds: [], nouveauxTags: [] }
      }
    />
  );
}

export const moduleNotesClient: ModuleIAClient<ElementNote> = {
  type: "note",
  nomType: "Note",
  libelles: {
    verifier: "Vérifie la note proposée, puis valide.",
    aValider: (n) => (n === 1 ? "1 note à valider" : `${n} notes à valider`),
    creer: (n) => (n === 1 ? "Créer la note" : `Créer ${n} notes`),
    aucuneRetenue: "Aucune note retenue",
    creee: (n) => (n === 1 ? "Note créée" : `${n} notes créées`),
    creationSimple: "Créer une note simple avec ce texte",
    titreFormulaire: "Nouvelle note",
  },
  saisie: {
    invite: "Décris ta note en une phrase",
    label: "Décris la note à ajouter",
    placeholder: "Ex. : idée de cadeau pour Léa, un livre de cuisine",
  },
  // Une note texte exige un contenu : le titre sert de contenu de départ.
  depuisTitre: (titre) => ({
    type: "note",
    donnees: {
      titre: titre.slice(0, 100),
      type: "texte",
      contenu: titre,
      items: [],
      tagIds: [],
      nouveauxTags: [],
      tagNoms: [],
      avertissements: [],
    },
  }),
  titre: (element) => element.donnees.titre,
  versCreation: (element) => ({ type: "note", donnees: element.donnees }),
  Detail,
  Formulaire,
  invalider(queryClient) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tags });
  },
};
