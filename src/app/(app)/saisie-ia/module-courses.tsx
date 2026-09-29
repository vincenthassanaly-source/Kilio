"use client";

import dynamic from "next/dynamic";
import { queryKeys } from "@/lib/query/keys";
import { LONGUEUR_MAX_LIBELLE_COURSE } from "@/lib/courses/compute";
import type { EditionFormulaire, ElementDe, ModuleIAClient } from "./module-client";
import { Avertissements, pluriel } from "./communs";

const AddCourseForm = dynamic(() => import("../courses/AddCourseForm").then((m) => m.AddCourseForm), {
  ssr: false,
});

type ElementCourse = ElementDe<"course">;

// Module « Courses » de « Ajouter avec l'IA » (facette client).

function Detail({ element }: { element: ElementCourse }) {
  return <Avertissements textes={element.donnees.avertissements} />;
}

function Formulaire({ edition, onDone }: { edition: EditionFormulaire; onDone: () => void }) {
  const initial = edition.element?.type === "course" ? edition.element.donnees.libelle : edition.titre;
  return <AddCourseForm initial={initial} onDone={onDone} />;
}

export const moduleCoursesClient: ModuleIAClient<ElementCourse> = {
  type: "course",
  nomType: "Course",
  libelles: {
    verifier: "Vérifie l'article proposé, puis valide.",
    aValider: (n) => pluriel(n, "1 article à valider", "{n} articles à valider"),
    creer: (n) => pluriel(n, "Ajouter l'article", "Ajouter {n} articles"),
    aucuneRetenue: "Aucun article retenu",
    creee: (n) => pluriel(n, "Article ajouté", "{n} articles ajoutés"),
    creationSimple: "Ajouter un article simple avec ce texte",
    titreFormulaire: "Nouvel article",
  },
  saisie: {
    invite: "Décris ce que tu veux acheter",
    label: "Décris les articles à ajouter aux courses",
    placeholder: "Ex. : lait, œufs, pain",
  },
  depuisTitre: (titre) => ({
    type: "course",
    donnees: { libelle: titre.slice(0, LONGUEUR_MAX_LIBELLE_COURSE), avertissements: [] },
  }),
  titre: (element) => element.donnees.libelle,
  versCreation: (element) => ({ type: "course", donnees: element.donnees }),
  Detail,
  Formulaire,
  invalider(queryClient) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.courses });
  },
};
