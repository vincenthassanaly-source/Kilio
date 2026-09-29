"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { getCatalogueJournal } from "@/app/actions/journal";
import { queryKeys } from "@/lib/query/keys";
import { aujourdhuiParis } from "@/lib/date/paris";
import { MOMENT_LABELS, cleCatalogue, momentParDefaut } from "@/lib/nutrition/compute";
import { libelleJourRepas, repasComplet } from "@/lib/nutrition/saisie-naturelle";
import { kcalPillTag, pillTag } from "@/lib/ui";
import type { EditionFormulaire, ElementDe, ModuleIAClient } from "./module-client";
import { Avertissements, pluriel } from "./communs";

type ElementRepas = ElementDe<"repas">;

const AjoutRepasPanneau = dynamic(
  () => import("../nutrition/journal/AjoutRepasPanneau").then((m) => m.AjoutRepasPanneau),
  { ssr: false }
);

// Module « Repas » de « Ajouter avec l'IA » (facette client).

function Detail({ element }: { element: ElementRepas }) {
  const r = element.donnees;
  const incomplet = !repasComplet(r);
  return (
    <>
      <p className="text-[12.5px] tabular-nums text-ink-2">
        {libelleJourRepas(r.date, aujourdhuiParis())} · {MOMENT_LABELS[r.moment]}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className={incomplet ? kcalPillTag : pillTag}>{r.quantiteLibelle ?? "Quantité à préciser"}</span>
        {r.kcal !== null && <span className={pillTag}>{r.kcal} kcal</span>}
        {r.cible === null && <span className={kcalPillTag}>Aliment à préciser</span>}
      </div>
      <Avertissements textes={r.avertissements} />
    </>
  );
}

function Formulaire({ edition, onDone }: { edition: EditionFormulaire; onDone: () => void }) {
  const r = edition.element?.type === "repas" ? edition.element.donnees : null;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.catalogueJournal,
    queryFn: getCatalogueJournal,
    staleTime: 5 * 60_000,
  });

  // Le catalogue sert à retrouver l'aliment choisi : sans lui, le panneau
  // ouvrirait la recherche à la place de l'étape de quantité.
  if (r?.cible && isLoading) {
    return (
      <p role="status" className="py-3 text-sm text-ink-2">
        Chargement…
      </p>
    );
  }
  const cible = r?.cible;
  const item = cible && data?.items.find((i) => cleCatalogue(i) === cleCatalogue(cible));

  return (
    <AjoutRepasPanneau
      date={r?.date}
      depart={
        item && r
          ? {
              moment: r.moment,
              item,
              recent:
                r.quantite === null ? undefined : { type: item.type, id: item.id, quantite: r.quantite, moment: r.moment },
            }
          : { moment: r?.moment, requete: r?.nom ?? edition.titre }
      }
      onAjoute={() => onDone()}
    />
  );
}

export const moduleRepasClient: ModuleIAClient<ElementRepas> = {
  type: "repas",
  nomType: "Repas",
  libelles: {
    verifier: "Vérifie le repas proposé, puis valide.",
    aValider: (n) => pluriel(n, "1 repas à valider", "{n} repas à valider"),
    creer: (n) => pluriel(n, "Ajouter le repas", "Ajouter {n} repas"),
    aucuneRetenue: "Aucun repas retenu",
    creee: (n) => pluriel(n, "Repas ajouté", "{n} repas ajoutés"),
    creationSimple: "Ajouter un repas avec ce texte",
    titreFormulaire: "Ajouter un repas",
  },
  saisie: {
    invite: "Décris ce que tu as mangé",
    label: "Décris les repas à ajouter",
    placeholder: "Ex. : 2 œufs et un yaourt ce matin",
  },
  // Sans aliment ni quantité : à préciser dans « Modifier » (le journal exige
  // un aliment ou une recette).
  depuisTitre: (titre) => {
    const maintenant = new Date();
    return {
      type: "repas",
      donnees: {
        nom: titre.slice(0, 60),
        cible: null,
        quantite: null,
        quantiteLibelle: null,
        moment: momentParDefaut(maintenant.getHours() + maintenant.getMinutes() / 60),
        date: aujourdhuiParis(),
        kcal: null,
        avertissements: ["Aucun aliment du catalogue ne correspond : choisis-le dans « Modifier »."],
      },
    };
  },
  retenueParDefaut: (element) => repasComplet(element.donnees),
  titre: (element) => element.donnees.nom,
  versCreation: (element) => {
    const { cible, quantite, moment, date } = element.donnees;
    return { type: "repas", donnees: { cible, quantite, moment, date } };
  },
  Detail,
  Formulaire,
  invalider(queryClient) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.catalogueJournal });
    void queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
  },
};
