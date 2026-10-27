"use client";

import { useId, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { enregistrerReglagesVinted, getReglagesVinted } from "@/app/actions/vinted";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { card, errorText, input, label, primaryButton, sectionTitle } from "@/lib/ui";
import { parserHashtags } from "@/lib/vinted/kit";
import { COLIS_VINTED, type ReglagesVinted } from "@/lib/vinted/types";
import { ErrorInline } from "@/components/ErrorInline";

type Saisie = { signature: string; colis: string; communs: string; parCategorie: string };

// Une catégorie par ligne : « robes: #robe #vintage ».
function categoriesVersTexte(parCategorie: ReglagesVinted["hashtags_par_categorie"]): string {
  return Object.entries(parCategorie)
    .map(([categorie, tags]) => `${categorie}: ${tags.join(" ")}`)
    .join("\n");
}

function texteVersCategories(texte: string): Record<string, string[]> {
  const resultat: Record<string, string[]> = {};
  for (const ligne of texte.split("\n")) {
    const separateur = ligne.indexOf(":");
    if (separateur === -1) continue;
    const categorie = ligne.slice(0, separateur).trim();
    const tags = parserHashtags(ligne.slice(separateur + 1));
    if (categorie && tags.length > 0) resultat[categorie] = tags;
  }
  return resultat;
}

function Formulaire({ reglages }: { reglages: ReglagesVinted }) {
  const queryClient = useQueryClient();
  const uid = useId();
  const [saisie, setSaisie] = useState<Saisie>({
    signature: reglages.signature,
    colis: reglages.colis_defaut,
    communs: reglages.hashtags_communs.join(" "),
    parCategorie: categoriesVersTexte(reglages.hashtags_par_categorie),
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function maj<K extends keyof Saisie>(cle: K, valeur: Saisie[K]) {
    setSaisie((s) => ({ ...s, [cle]: valeur }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setErreur(null);
      const resultat = await runAction(
        () =>
          enregistrerReglagesVinted({
            signature: saisie.signature,
            colis_defaut: saisie.colis,
            hashtags_communs: parserHashtags(saisie.communs),
            hashtags_par_categorie: texteVersCategories(saisie.parCategorie),
          }),
        { silencieux: true }
      );
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.vintedReglages });
      showToast("Réglages enregistrés", 1800);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>Description</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-signature`} className={label}>
            Signature
          </label>
          <textarea
            id={`${uid}-signature`}
            className={`${input} min-h-24 resize-y`}
            value={saisie.signature}
            onChange={(e) => maj("signature", e.target.value)}
            placeholder="Envoi rapide et soigné. Lot possible : -10 % dès 2 articles."
          />
          <p className="text-xs text-ink-3">Ajoutée à la fin de chaque description, avant les hashtags.</p>
        </div>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>Colis</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-colis`} className={label}>
            Taille de colis par défaut
          </label>
          <input
            id={`${uid}-colis`}
            className={input}
            list={`${uid}-colis-liste`}
            value={saisie.colis}
            onChange={(e) => maj("colis", e.target.value)}
          />
          <datalist id={`${uid}-colis-liste`}>
            {COLIS_VINTED.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-xs text-ink-3">Appliquée aux nouvelles annonces et au kit quand le champ est vide.</p>
        </div>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>Hashtags</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-communs`} className={label}>
            Hashtags communs à toutes les annonces
          </label>
          <input
            id={`${uid}-communs`}
            className={input}
            value={saisie.communs}
            onChange={(e) => maj("communs", e.target.value)}
            placeholder="#vinted #seconde_main"
            autoCapitalize="none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-categories`} className={label}>
            Hashtags par catégorie
          </label>
          <textarea
            id={`${uid}-categories`}
            className={`${input} min-h-28 resize-y font-mono text-sm`}
            value={saisie.parCategorie}
            onChange={(e) => maj("parCategorie", e.target.value)}
            placeholder={"robes: #robe #vintage\nbaskets: #sneakers #running"}
            autoCapitalize="none"
          />
          <p className="text-xs text-ink-3">
            Une catégorie par ligne, suivie de deux-points. Elle est reconnue quand elle correspond exactement au champ « Catégorie » d&apos;une annonce.
          </p>
        </div>
      </section>

      {erreur && (
        <p className={errorText} role="alert">
          {erreur}
        </p>
      )}

      <button type="submit" disabled={enCours} className={`${primaryButton} min-h-11`}>
        {enCours ? "Enregistrement…" : "Enregistrer les réglages"}
      </button>
    </form>
  );
}

export function ReglagesForm() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: queryKeys.vintedReglages, queryFn: getReglagesVinted });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-[22px]" />
        <Skeleton className="h-28 w-full rounded-[22px]" />
        <Skeleton className="h-56 w-full rounded-[22px]" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorInline message="Impossible de charger les réglages." retry={() => refetch()} />;
  }

  return <Formulaire reglages={data} />;
}
