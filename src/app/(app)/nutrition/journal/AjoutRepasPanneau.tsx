"use client";

import { useActionState, useDeferredValue, useId, useMemo, useState, type ReactNode } from "react";
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
  QUANTITE_MAX_ALIMENT,
  QUANTITE_MAX_PORTIONS,
  rechercherCatalogue,
  saisieParDefaut,
  type CatalogueItem,
  type ModeSaisie,
  type MomentRepas,
  type SaisieRecente,
} from "@/lib/nutrition/compute";
import { queryKeys } from "@/lib/query/keys";
import { errorText, input, nameTextComplet, navArrowButton, primaryButton } from "@/lib/ui";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ChevronIcon, PlusIcon } from "@/components/icons";
import { MoinsIcon } from "../MoinsIcon";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/** Enregistre la saisie : `addJournalEntry` (Journal) ou `addMenuEntry` (Menus). */
export type ActionSaisieRepas = (precedent: JournalFormState, formData: FormData) => Promise<JournalFormState>;

const libelleAjoutJournal = (moment: MomentRepas) => `Ajouter ${AJOUT_LABELS[moment]}`;

/**
 * Repas déjà saisi qu'on corrige (tap sur une ligne du Carnet ou d'un menu) :
 * `cle` est la clé catalogue de son aliment ou de sa recette (cleCatalogue),
 * `quantite` la quantité stockée (g/ml ou portions).
 */
export type EditionRepas = { id: string; cle: string; quantite: number; moment: MomentRepas };

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
          <span className={`block ${nameTextComplet} font-semibold`}>{item.nom}</span>
          <span className="block truncate text-caption text-ink-2">{detail}</span>
        </span>
        <span className="shrink-0 text-ink-3">
          <PlusIcon size={18} />
        </span>
      </button>
    </li>
  );
}

function EtapeChoix({
  moment,
  momentFige,
  requeteInitiale,
  onMoment,
  onChoisir,
}: {
  moment: MomentRepas;
  momentFige: boolean;
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
      {!momentFige && <ChoixMoment moment={moment} onChange={onMoment} />}

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
          <p className="text-small text-ink-2">Le catalogue n&apos;a pas pu être chargé. Vérifie la connexion.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`min-h-11 rounded-xl border border-line px-3 text-small font-semibold text-ink ${focusRing}`}
          >
            {isFetching ? "Nouvel essai…" : "Réessayer"}
          </button>
        </div>
      ) : enRecherche ? (
        resultats.length === 0 ? (
          <p className="py-3 text-small text-ink-2">
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
          <h3 className="px-1 text-small font-semibold text-ink-2">Récents</h3>
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
        <p className="py-3 text-small text-ink-2">
          Tape le nom d&apos;un aliment ou d&apos;une recette : tes derniers repas s&apos;afficheront ici ensuite.
        </p>
      )}
    </div>
  );
}

function EtapeQuantite({
  item,
  recent,
  idEdition,
  moment,
  momentFige,
  date,
  action,
  libelleAjout,
  onMoment,
  onRetour,
  onAjoute,
}: {
  item: CatalogueItem;
  recent?: SaisieRecente;
  /** Ligne corrigée : envoyée en champ `id`, le bouton devient « Enregistrer ». */
  idEdition?: string;
  moment: MomentRepas;
  momentFige: boolean;
  date?: string;
  action: ActionSaisieRepas;
  libelleAjout: (moment: MomentRepas) => string;
  onMoment: (m: MomentRepas) => void;
  onRetour: () => void;
  onAjoute: (item: CatalogueItem, moment: MomentRepas) => void;
}) {
  const champId = useId();
  const erreurId = useId();
  const quantiteErreurId = useId();
  const depart = saisieParDefaut(item, recent);
  const [mode, setMode] = useState<ModeSaisie>(depart.mode);
  // Texte brut du champ (accepte « 1,5 ») ; la valeur numérique en dérive.
  const [texte, setTexte] = useState(String(depart.valeur).replace(".", ","));
  const valeur = Number(texte.replace(",", "."));
  // Plafond dans l'unité saisie (pièces : l'équivalent de 5 000 g) ; le serveur le revérifie.
  const maxSaisie =
    item.type === "recette"
      ? QUANTITE_MAX_PORTIONS
      : mode === "piece" && item.poidsUniteG
        ? Math.max(1, Math.floor(QUANTITE_MAX_ALIMENT / item.poidsUniteG))
        : QUANTITE_MAX_ALIMENT;
  const tropGrand = Number.isFinite(valeur) && valeur > maxSaisie;
  const valide = Number.isFinite(valeur) && valeur > 0 && !tropGrand;
  const pas = pasSaisie(item, mode);
  const nutrition = valide ? nutritionSaisie(item, mode, valeur) : null;
  const avecPieces = item.type === "aliment" && item.poidsUniteG !== null;

  const [etat, formAction, enCours] = useActionState<JournalFormState, FormData>(
    async (precedent, formData) => {
      try {
        const resultat = await action(precedent, formData);
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

  const boutonPas = `flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-ink transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-alt active:scale-[0.97] ${focusRing}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="type" value={item.type} />
      <input type="hidden" name={item.type === "aliment" ? "aliment_id" : "recette_id"} value={item.id} />
      <input type="hidden" name="quantite" value={valide ? String(valeur) : ""} />
      <input type="hidden" name="saisie_mode" value={mode} />
      <input type="hidden" name="moment" value={moment} />
      {date && <input type="hidden" name="date" value={date} />}
      {idEdition && <input type="hidden" name="id" value={idEdition} />}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetour}
          aria-label="Changer d'aliment ou de recette"
          className={`${navArrowButton} shrink-0`}
        >
          <ChevronIcon sens="gauche" size={18} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-body font-bold text-ink">{item.nom}</p>
          <p className="truncate text-caption text-ink-2">{referenceKcal(item)}</p>
        </div>
      </div>

      {!momentFige && <ChoixMoment moment={moment} onChange={onMoment} />}

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
        <label htmlFor={champId} className="text-small font-medium text-ink">
          Quantité
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => ajuster(-pas)} aria-label={`Retirer ${String(pas).replace(".", ",")} ${uniteSaisie(item, mode, pas)}`} className={boutonPas}>
            <MoinsIcon size={20} />
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
              aria-describedby={[etat.error ? erreurId : null, !valide ? quantiteErreurId : null].filter(Boolean).join(" ") || undefined}
              className={`${input} w-full pr-20 text-center font-display text-heading font-semibold tabular-nums`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-small text-ink-2">
              {uniteSaisie(item, mode, valide ? valeur : 1)}
            </span>
          </div>
          <button type="button" onClick={() => ajuster(pas)} aria-label={`Ajouter ${String(pas).replace(".", ",")} ${uniteSaisie(item, mode, pas)}`} className={boutonPas}>
            <PlusIcon size={20} />
          </button>
        </div>
        <div className="flex gap-1.5">
          {raccourcis(item, mode).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTexte(String(r).replace(".", ","))}
              aria-pressed={valide && valeur === r}
              className={`min-h-11 flex-1 rounded-xl border text-small font-semibold tabular-nums transition-colors ${focusRing} ${
                valide && valeur === r ? "border-kcal/60 bg-kcal-soft text-kcal" : "border-line text-ink-2"
              }`}
            >
              {formatNombre(r)}
            </button>
          ))}
        </div>
        {!valide && (
          <p id={quantiteErreurId} className={errorText}>
            {tropGrand
              ? `Maximum ${formatNombre(maxSaisie)} ${uniteSaisie(item, mode, maxSaisie)}.`
              : "Saisis une quantité supérieure à 0."}
          </p>
        )}
      </div>

      <div className="flex items-baseline justify-between rounded-2xl bg-surface-alt px-4 py-3" aria-live="polite">
        <span className="font-display text-display font-semibold text-ink tabular-nums">
          {nutrition ? Math.round(nutrition.kcal) : "—"}
          <span className="ml-1 font-sans text-small font-semibold text-ink-2">kcal</span>
        </span>
        {nutrition && (
          <span className="flex gap-3 text-caption font-semibold tabular-nums">
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
        {idEdition ? (enCours ? "Enregistrement…" : "Enregistrer") : enCours ? "Ajout…" : libelleAjout(moment)}
      </button>
    </form>
  );
}

/**
 * Ouverture d'un repas à corriger : retrouve son aliment ou sa recette dans le
 * catalogue (déjà en cache la plupart du temps) puis ouvre directement le
 * dosage, pré-rempli avec la quantité et le moment enregistrés.
 */
function EtapeEdition({
  edition,
  children,
}: {
  edition: EditionRepas;
  children: (item: CatalogueItem, recent: SaisieRecente) => ReactNode;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.catalogueJournal,
    queryFn: getCatalogueJournal,
    staleTime: 5 * 60_000,
  });
  const item = data?.items.find((i) => cleCatalogue(i) === edition.cle);

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-alt" aria-busy="true" aria-label="Chargement du repas" />;
  }
  if (isError || !data) {
    return (
      <div className="flex flex-col items-start gap-2 py-2" role="alert">
        <p className="text-small text-ink-2">Le repas n&apos;a pas pu être chargé. Vérifie la connexion.</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className={`min-h-11 rounded-xl border border-line px-3 text-small font-semibold text-ink ${focusRing}`}
        >
          {isFetching ? "Nouvel essai…" : "Réessayer"}
        </button>
      </div>
    );
  }
  if (!item) {
    return <p className="py-3 text-small text-ink-2">Cet aliment ou cette recette n&apos;existe plus.</p>;
  }
  return children(item, { type: item.type, id: item.id, quantite: edition.quantite, moment: edition.moment });
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
  edition,
  momentFige = false,
  action = addJournalEntry,
  libelleAjout = libelleAjoutJournal,
  onAjoute,
}: {
  date?: string;
  /** Repas à corriger : ouvre le dosage pré-rempli ; `action` doit être l'action de modification. */
  edition?: EditionRepas;
  /** Moment imposé par l'appelant (créneau d'un menu) : le sélecteur de moment est masqué. */
  momentFige?: boolean;
  /** Action d'enregistrement ; le Journal par défaut. */
  action?: ActionSaisieRepas;
  /** Libellé du bouton de validation, selon le moment. */
  libelleAjout?: (moment: MomentRepas) => string;
  /**
   * Point de départ : un aliment ou une recette déjà choisi, avec sa quantité, ou une recherche
   * pré-remplie quand rien ne correspond.
   */
  depart?: { moment?: MomentRepas; requete?: string; item?: CatalogueItem; recent?: SaisieRecente };
  onAjoute: (item: CatalogueItem, moment: MomentRepas) => void;
}) {
  const [moment, setMoment] = useState<MomentRepas>(() => {
    if (edition) return edition.moment;
    if (depart?.moment) return depart.moment;
    const maintenant = new Date();
    return momentParDefaut(maintenant.getHours() + maintenant.getMinutes() / 60);
  });
  const [choix, setChoix] = useState<{ item: CatalogueItem; recent?: SaisieRecente } | null>(
    depart?.item ? { item: depart.item, recent: depart.recent } : null
  );

  // En correction, la flèche de retour permet de changer d'aliment : la ligne garde son id.
  const [changerItem, setChangerItem] = useState(false);

  if (edition && !choix && !changerItem) {
    return (
      <EtapeEdition edition={edition}>
        {(item, recent) => (
          <EtapeQuantite
            item={item}
            recent={recent}
            idEdition={edition.id}
            moment={moment}
            momentFige={momentFige}
            date={date}
            action={action}
            libelleAjout={libelleAjout}
            onMoment={setMoment}
            onRetour={() => setChangerItem(true)}
            onAjoute={onAjoute}
          />
        )}
      </EtapeEdition>
    );
  }

  return choix ? (
    <EtapeQuantite
      key={cleCatalogue(choix.item)}
      item={choix.item}
      recent={choix.recent}
      idEdition={edition?.id}
      moment={moment}
      momentFige={momentFige}
      date={date}
      action={action}
      libelleAjout={libelleAjout}
      onMoment={setMoment}
      onRetour={() => setChoix(null)}
      onAjoute={onAjoute}
    />
  ) : (
    <EtapeChoix
      moment={moment}
      momentFige={momentFige}
      requeteInitiale={depart?.requete ?? ""}
      onMoment={setMoment}
      onChoisir={(item, recent) => setChoix({ item, recent })}
    />
  );
}
