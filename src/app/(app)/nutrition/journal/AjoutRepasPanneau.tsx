"use client";

import { useActionState, useDeferredValue, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addJournalEntry, getCatalogueJournal, type JournalFormState } from "@/app/actions/journal";
import { MESSAGE_HORS_LIGNE } from "@/lib/actions/runAction";
import {
  AJOUT_LABELS,
  MOMENTS_REPAS,
  MOMENT_LABELS,
  cleCatalogue,
  momentParDefaut,
  nutritionSaisie,
  pasSaisie,
  rechercherCatalogue,
  saisieParDefaut,
  type CatalogueItem,
  type ModeSaisie,
  type MomentRepas,
  type SaisieRecente,
} from "@/lib/nutrition/compute";
import { queryKeys } from "@/lib/query/keys";
import { errorText, input, primaryButton } from "@/lib/ui";
import { SegmentedControl } from "@/components/SegmentedControl";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

function arrondir(n: number) {
  return Math.round(n * 10) / 10;
}

function formatNombre(n: number) {
  return arrondir(n).toLocaleString("fr-FR");
}

// Libellé de référence affiché sous le nom, pour choisir sans ouvrir :
// kcal par portion, par pièce quand l'aliment en a une, sinon pour 100 g.
function referenceKcal(item: CatalogueItem): string {
  if (item.type === "recette") return `Recette · ${Math.round(item.parPortion.kcal)} kcal / portion`;
  if (item.unite === "piece" && item.poidsUniteG) {
    return `${Math.round((item.par100.kcal * item.poidsUniteG) / 100)} kcal / pièce`;
  }
  return `${Math.round(item.par100.kcal)} kcal / 100 ${item.unite === "ml" ? "ml" : "g"}`;
}

function detailRecent(item: CatalogueItem, recent: SaisieRecente): string {
  if (item.type === "recette") {
    return `${formatNombre(recent.quantite)} portion${recent.quantite > 1 ? "s" : ""} · ${MOMENT_LABELS[recent.moment]}`;
  }
  return `${formatNombre(recent.quantite)} ${item.unite === "ml" ? "ml" : "g"} · ${MOMENT_LABELS[recent.moment]}`;
}

function uniteSaisie(item: CatalogueItem, mode: ModeSaisie, valeur: number): string {
  if (item.type === "recette") return valeur > 1 ? "portions" : "portion";
  if (mode === "piece") return valeur > 1 ? "pièces" : "pièce";
  return item.unite === "ml" ? "ml" : "g";
}

function raccourcis(item: CatalogueItem, mode: ModeSaisie): number[] {
  if (item.type === "recette") return [0.5, 1, 1.5, 2];
  if (mode === "piece") return [1, 2, 3, 4];
  return [50, 100, 150, 200];
}

const OPTIONS_MOMENT = MOMENTS_REPAS.map((m) => ({ value: m, label: MOMENT_LABELS[m] }));

/** Contrôle segmenté du moment de repas, pré-rempli selon l'heure. */
function ChoixMoment({ moment, onChange }: { moment: MomentRepas; onChange: (m: MomentRepas) => void }) {
  return <SegmentedControl ariaLabel="Moment du repas" taille="sm" options={OPTIONS_MOMENT} value={moment} onChange={onChange} />;
}

function LigneCatalogue({
  item,
  detail,
  onChoisir,
}: {
  item: CatalogueItem;
  detail: string;
  onChoisir: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onChoisir}
        className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface-alt active:bg-surface-alt ${focusRing}`}
      >
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{item.nom}</span>
          <span className="block truncate text-xs text-ink-2">{detail}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </li>
  );
}

function EtapeChoix({
  moment,
  requeteInitiale,
  onMoment,
  onChoisir,
}: {
  moment: MomentRepas;
  requeteInitiale: string;
  onMoment: (m: MomentRepas) => void;
  onChoisir: (item: CatalogueItem, recent?: SaisieRecente) => void;
}) {
  const champId = useId();
  const [requete, setRequete] = useState(requeteInitiale);
  // La liste filtrée suit la frappe sans la ralentir (rerender-use-deferred-value).
  const requeteDifferee = useDeferredValue(requete);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.catalogueJournal,
    queryFn: getCatalogueJournal,
    staleTime: 5 * 60_000,
  });

  const parCle = useMemo(() => new Map((data?.items ?? []).map((i) => [cleCatalogue(i), i])), [data]);
  const resultats = useMemo(
    () => (data ? rechercherCatalogue(data.items, requeteDifferee) : []),
    [data, requeteDifferee]
  );
  const recents = useMemo(
    () =>
      (data?.recents ?? []).flatMap((r) => {
        const item = parCle.get(cleCatalogue(r));
        return item ? [{ item, recent: r }] : [];
      }),
    [data, parCle]
  );
  const enRecherche = requete.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <ChoixMoment moment={moment} onChange={onMoment} />

      <label htmlFor={champId} className="sr-only">
        Rechercher un aliment ou une recette
      </label>
      <input
        id={champId}
        type="search"
        name="recherche-repas"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Rechercher un aliment ou une recette…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={`${input} w-full text-base`}
      />

      {isLoading ? (
        <ul className="flex flex-col gap-1" aria-busy="true" aria-label="Chargement du catalogue">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[52px] animate-pulse rounded-2xl bg-surface-alt" />
          ))}
        </ul>
      ) : isError || !data ? (
        <div className="flex flex-col items-start gap-2 py-2" role="alert">
          <p className="text-sm text-ink-2">Le catalogue n&apos;a pas pu être chargé. Vérifie la connexion.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`min-h-11 rounded-xl border border-line px-3 text-sm font-semibold text-ink ${focusRing}`}
          >
            {isFetching ? "Nouvel essai…" : "Réessayer"}
          </button>
        </div>
      ) : enRecherche ? (
        resultats.length === 0 ? (
          <p className="py-3 text-sm text-ink-2">
            Aucun aliment ni recette pour « {requete.trim()} ».
          </p>
        ) : (
          <ul className="-mx-1 flex flex-col" aria-label="Résultats">
            {resultats.map((item) => (
              <LigneCatalogue
                key={cleCatalogue(item)}
                item={item}
                detail={referenceKcal(item)}
                onChoisir={() => onChoisir(item)}
              />
            ))}
          </ul>
        )
      ) : recents.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="px-1 text-[12.5px] font-semibold text-ink-2">Récents</h3>
          <ul className="-mx-1 flex flex-col">
            {recents.map(({ item, recent }) => (
              <LigneCatalogue
                key={cleCatalogue(item)}
                item={item}
                detail={detailRecent(item, recent)}
                onChoisir={() => onChoisir(item, recent)}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-3 text-sm text-ink-2">
          Tape le nom d&apos;un aliment ou d&apos;une recette : tes derniers repas s&apos;afficheront ici ensuite.
        </p>
      )}
    </div>
  );
}

function EtapeQuantite({
  item,
  recent,
  moment,
  date,
  onMoment,
  onRetour,
  onAjoute,
}: {
  item: CatalogueItem;
  recent?: SaisieRecente;
  moment: MomentRepas;
  date?: string;
  onMoment: (m: MomentRepas) => void;
  onRetour: () => void;
  onAjoute: (item: CatalogueItem, moment: MomentRepas) => void;
}) {
  const champId = useId();
  const erreurId = useId();
  const depart = saisieParDefaut(item, recent);
  const [mode, setMode] = useState<ModeSaisie>(depart.mode);
  // Texte brut du champ (accepte « 1,5 ») ; la valeur numérique en dérive.
  const [texte, setTexte] = useState(String(depart.valeur).replace(".", ","));
  const valeur = Number(texte.replace(",", "."));
  const valide = Number.isFinite(valeur) && valeur > 0;
  const pas = pasSaisie(item, mode);
  const nutrition = valide ? nutritionSaisie(item, mode, valeur) : null;
  const avecPieces = item.type === "aliment" && item.poidsUniteG !== null;

  const [etat, formAction, enCours] = useActionState<JournalFormState, FormData>(
    async (precedent, formData) => {
      try {
        const resultat = await addJournalEntry(precedent, formData);
        if (resultat.ok) onAjoute(item, moment);
        return resultat;
      } catch {
        // Contrat T1 : jamais d'exception vers l'error boundary ; la saisie
        // reste en place pour réessayer.
        return { error: MESSAGE_HORS_LIGNE };
      }
    },
    { error: null }
  );

  function ajuster(delta: number) {
    const base = valide ? valeur : 0;
    const suivant = Math.max(pas, arrondir(base + delta));
    setTexte(String(suivant).replace(".", ","));
  }

  function changerMode(m: ModeSaisie) {
    if (m === mode || item.type !== "aliment" || !item.poidsUniteG) return;
    // Conversion de la valeur en cours pour garder la même quantité réelle.
    const suivant =
      m === "piece"
        ? Math.max(0.5, Math.round(((valide ? valeur : 100) / item.poidsUniteG) * 2) / 2)
        : Math.round((valide ? valeur : 1) * item.poidsUniteG);
    setMode(m);
    setTexte(String(suivant).replace(".", ","));
  }

  const boutonPas = `flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-xl text-ink transition active:scale-[0.97] ${focusRing}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="type" value={item.type} />
      <input type="hidden" name={item.type === "aliment" ? "aliment_id" : "recette_id"} value={item.id} />
      <input type="hidden" name="quantite" value={valide ? String(valeur) : ""} />
      <input type="hidden" name="saisie_mode" value={mode} />
      <input type="hidden" name="moment" value={moment} />
      {date && <input type="hidden" name="date" value={date} />}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetour}
          aria-label="Changer d'aliment ou de recette"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink ${focusRing}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-ink">{item.nom}</p>
          <p className="truncate text-xs text-ink-2">{referenceKcal(item)}</p>
        </div>
      </div>

      <ChoixMoment moment={moment} onChange={onMoment} />

      {avecPieces && (
        <SegmentedControl
          ariaLabel="Unité de saisie"
          taille="sm"
          className="self-start"
          options={[
            { value: "piece", label: "Pièces" },
            { value: "grammes", label: item.unite === "ml" ? "ml" : "Grammes" },
          ]}
          value={mode}
          onChange={changerMode}
        />
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={champId} className="text-sm font-medium text-ink">
          Quantité
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => ajuster(-pas)} aria-label={`Retirer ${String(pas).replace(".", ",")}`} className={boutonPas}>
            −
          </button>
          <div className="relative min-w-0 flex-1">
            <input
              id={champId}
              name="quantite-saisie"
              value={texte}
              onChange={(e) => setTexte(e.target.value.replace(/[^\d.,]/g, ""))}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={!valide}
              aria-describedby={etat.error ? erreurId : undefined}
              className={`${input} w-full pr-20 text-center font-display text-xl font-semibold tabular-nums`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-2">
              {uniteSaisie(item, mode, valide ? valeur : 1)}
            </span>
          </div>
          <button type="button" onClick={() => ajuster(pas)} aria-label={`Ajouter ${String(pas).replace(".", ",")}`} className={boutonPas}>
            +
          </button>
        </div>
        <div className="flex gap-1.5">
          {raccourcis(item, mode).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTexte(String(r).replace(".", ","))}
              aria-pressed={valide && valeur === r}
              className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold tabular-nums transition-colors ${focusRing} ${
                valide && valeur === r ? "border-kcal/60 bg-kcal-soft text-kcal" : "border-line text-ink-2"
              }`}
            >
              {formatNombre(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between rounded-2xl bg-surface-alt px-4 py-3" aria-live="polite">
        <span className="font-display text-[28px] font-semibold text-ink tabular-nums">
          {nutrition ? Math.round(nutrition.kcal) : "—"}
          <span className="ml-1 font-sans text-sm font-semibold text-ink-2">kcal</span>
        </span>
        {nutrition && (
          <span className="flex gap-3 text-xs font-semibold tabular-nums">
            <span style={{ color: "var(--accent-protein)" }}>P {Math.round(nutrition.proteines)} g</span>
            <span style={{ color: "var(--accent-carbs)" }}>G {Math.round(nutrition.glucides)} g</span>
            <span style={{ color: "var(--accent-fat)" }}>L {Math.round(nutrition.lipides)} g</span>
          </span>
        )}
      </div>

      {etat.error && (
        <p id={erreurId} role="alert" className={errorText}>
          {etat.error}
        </p>
      )}

      <button type="submit" disabled={!valide || enCours} className={`${primaryButton} min-h-12 w-full`}>
        {enCours ? "Ajout…" : `Ajouter ${AJOUT_LABELS[moment]}`}
      </button>
    </form>
  );
}

/**
 * Flux d'ajout de repas (constat J-P0-1) en deux temps dans une même
 * feuille : choisir (récents ou recherche aliment/recette, moment
 * pré-rempli selon l'heure), puis doser (g/ml, pièces ou portions, avec
 * aperçu kcal/macros) et ajouter via `addJournalEntry`. Utilisé par le
 * Journal (date affichée) et par le « + » du dashboard (sans date : jour
 * courant côté serveur).
 */
export function AjoutRepasPanneau({
  date,
  depart,
  onAjoute,
}: {
  date?: string;
  /**
   * Point de départ : un aliment ou une recette déjà choisi, avec sa quantité, ou une recherche
   * pré-remplie quand rien ne correspond.
   */
  depart?: { moment?: MomentRepas; requete?: string; item?: CatalogueItem; recent?: SaisieRecente };
  onAjoute: (item: CatalogueItem, moment: MomentRepas) => void;
}) {
  const [moment, setMoment] = useState<MomentRepas>(() => {
    if (depart?.moment) return depart.moment;
    const maintenant = new Date();
    return momentParDefaut(maintenant.getHours() + maintenant.getMinutes() / 60);
  });
  const [choix, setChoix] = useState<{ item: CatalogueItem; recent?: SaisieRecente } | null>(
    depart?.item ? { item: depart.item, recent: depart.recent } : null
  );

  return choix ? (
    <EtapeQuantite
      key={cleCatalogue(choix.item)}
      item={choix.item}
      recent={choix.recent}
      moment={moment}
      date={date}
      onMoment={setMoment}
      onRetour={() => setChoix(null)}
      onAjoute={onAjoute}
    />
  ) : (
    <EtapeChoix
      moment={moment}
      requeteInitiale={depart?.requete ?? ""}
      onMoment={setMoment}
      onChoisir={(item, recent) => setChoix({ item, recent })}
    />
  );
}
