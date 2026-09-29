"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { runAction } from "@/lib/actions/runAction";
import { preparerListe } from "@/app/actions/saisie-taches";
import { getListes, getTags } from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import { kcalPillTag, pillTag } from "@/lib/ui";
import {
  libelleQuand,
  libelleRappel,
  libelleRepetition,
  type TachePropose,
} from "@/lib/taches/saisie-naturelle";
import { preloadAddTaskForm } from "../taches/preloadAddTaskForm";
import { Avertissements, pluriel } from "./communs";
import type { EditionFormulaire, ElementDe, ModuleIAClient } from "./module-client";

type ElementTache = ElementDe<"tache">;

const AddTaskForm = dynamic(() => import("../taches/AddTaskForm").then((m) => m.AddTaskForm), {
  ssr: false,
});

// Module « Tâches » de « Ajouter avec l'IA » (facette client).

function pastilles(t: TachePropose): { texte: string; accent?: boolean }[] {
  const liste: { texte: string; accent?: boolean }[] = [];
  if (t.priorite !== "aucune") liste.push({ texte: `Priorité ${t.priorite}` });
  if (t.rappel_minutes !== null) liste.push({ texte: `Rappel : ${libelleRappel(t.rappel_minutes)}` });
  if (t.recurrence_frequence) liste.push({ texte: libelleRepetition(t.recurrence_frequence) });
  liste.push(
    t.nouvelleListe
      ? { texte: `Nouvelle liste : ${t.listeNom}`, accent: true }
      : { texte: t.listeNom }
  );
  for (const nom of t.tagNoms) liste.push({ texte: `#${nom}` });
  return liste;
}

function Detail({ element }: { element: ElementTache }) {
  const t = element.donnees;
  return (
    <>
      <p className="text-[12.5px] tabular-nums text-ink-2">{libelleQuand(t)}</p>
      <div className="flex flex-wrap gap-1.5">
        {pastilles(t).map((p) => (
          <span key={p.texte} className={p.accent ? kcalPillTag : pillTag}>
            {p.texte}
          </span>
        ))}
      </div>
      <Avertissements textes={t.avertissements} />
    </>
  );
}

function Formulaire({
  edition,
  onDone,
}: {
  edition: EditionFormulaire;
  onDone: (avertissement?: string) => void;
}) {
  const { data: listes = [] } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });
  const { data: tags = [] } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });
  const t = edition.element?.type === "tache" ? edition.element.donnees : undefined;

  return (
    <AddTaskForm
      listes={listes}
      tags={tags}
      defaultListeId={t?.listeId ?? undefined}
      defaultEcheance={t?.echeance ?? undefined}
      defaultHeure={t?.heure ?? undefined}
      initial={
        t
          ? {
              titre: t.titre,
              priorite: t.priorite,
              toute_la_journee: t.toute_la_journee,
              heure_fin: t.heure_fin,
              rappel_minutes: t.rappel_minutes,
              recurrence_frequence: t.recurrence_frequence,
              recurrence_fin: t.recurrence_fin,
              tagIds: t.tagIds,
              nouveauxTags: t.nouveauxTags,
            }
          : { titre: edition.titre }
      }
      onDone={(_id, avertissement) => onDone(avertissement)}
    />
  );
}

function tacheDepuisTitre(titre: string): ElementTache {
  return {
    type: "tache",
    donnees: {
      titre: titre.slice(0, 200),
      echeance: null,
      heure: null,
      heure_fin: null,
      toute_la_journee: false,
      priorite: "aucune",
      rappel_minutes: null,
      recurrence_frequence: null,
      recurrence_fin: null,
      // Sans liste : le serveur prend la première, comme le formulaire.
      listeId: null,
      nouvelleListe: null,
      listeNom: "Liste par défaut",
      tagIds: [],
      nouveauxTags: [],
      tagNoms: [],
      avertissements: [],
    },
  };
}

export const moduleTachesClient: ModuleIAClient<ElementTache> = {
  type: "tache",
  nomType: "Tâche",
  depuisTitre: tacheDepuisTitre,
  libelles: {
    verifier: "Vérifie la tâche proposée, puis valide.",
    aValider: (n) => pluriel(n, "1 tâche à valider", "{n} tâches à valider"),
    creer: (n) => pluriel(n, "Créer la tâche", "Créer {n} tâches"),
    aucuneRetenue: "Aucune tâche retenue",
    creee: (n) => pluriel(n, "Tâche créée", "{n} tâches créées"),
    creationSimple: "Créer une tâche simple avec ce texte",
    titreFormulaire: "Nouvelle tâche",
  },
  saisie: {
    invite: "Décris ta tâche en une phrase",
    label: "Décris la ou les tâches à ajouter",
    placeholder: "Ex. : dentiste jeudi 14h, rappel la veille",
  },
  titre: (element) => element.donnees.titre,
  versCreation: (element) => {
    const t = element.donnees;
    return {
      type: "tache",
      donnees: {
        titre: t.titre,
        echeance: t.echeance,
        heure: t.heure,
        heure_fin: t.heure_fin,
        toute_la_journee: t.toute_la_journee,
        priorite: t.priorite,
        rappel_minutes: t.rappel_minutes,
        recurrence_frequence: t.recurrence_frequence,
        recurrence_fin: t.recurrence_fin,
        listeId: t.listeId,
        nouvelleListe: t.nouvelleListe,
        tagIds: t.tagIds,
        nouveauxTags: t.nouveauxTags,
      },
    };
  },
  Detail,
  // Le formulaire ne sait choisir qu'une liste existante : elle est créée au
  // moment où Vincent choisit de poursuivre avec cette tâche.
  async preparerEdition(element) {
    const t = element.donnees;
    if (t.listeId || !t.nouvelleListe) return { ok: true, data: element };
    const nom = t.nouvelleListe;
    const resultat = await runAction(() => preparerListe(nom), {
      erreur: "La liste n'a pas pu être créée. Réessaie.",
    });
    if (!resultat.ok) return resultat;
    return {
      ok: true,
      data: { type: "tache", donnees: { ...t, listeId: resultat.data.id, nouvelleListe: null } },
    };
  },
  precharger: preloadAddTaskForm,
  Formulaire,
  invalider(queryClient) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    void queryClient.invalidateQueries({ queryKey: queryKeys.listes });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tags });
  },
};
