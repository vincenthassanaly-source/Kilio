"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { getListes, getTachesAvecRelations, getTags } from "@/app/actions/taches";
import { getPlanningTravail, getPlanningTravailExceptions } from "@/app/actions/planning-travail";
import { deleteEvenement, getEvenements, type Evenement } from "@/app/actions/evenements";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { EvenementForm } from "../aujourdhui/EvenementForm";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import { DUREE_TOAST_AVERTISSEMENT_MS, actualisationEchouee, etatListeTaches } from "@/lib/taches/compute";
import { Modal } from "@/components/Modal";
import { useBackClose } from "@/hooks/useBackClose";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { ListView } from "./ListView";
import { parseISODate, toISODate } from "@/lib/date/iso";
import { errorText, secondaryButton } from "@/lib/ui";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { ListItemSkeletonGroup } from "@/components/skeletons/ListItemSkeleton";

const AddTaskForm = dynamic(() => import("../taches/AddTaskForm").then((m) => m.AddTaskForm), {
  ssr: false,
});

type ViewKey = "jour" | "semaine" | "mois" | "liste";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "jour", label: "Jour" },
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "liste", label: "Liste" },
];

// Fond glissant du sélecteur de vue Jour/Semaine/Mois/Liste, sur le modèle
// de `ACTIVE_PILL_LAYOUT_ID`/`pillTransition` de BottomNav.tsx (id distinct
// : ce sélecteur et la bottom nav sont montés en même temps sur cet écran,
// un même layoutId ferait glisser le fond de l'un vers l'autre).
const AGENDA_VUE_ACTIVE_PILL = "agenda-vue-active-pill";
function vuePillTransition(reduceMotion: boolean) {
  return reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 500, damping: 40 };
}

// Distance horizontale minimum pour qu'un geste soit considéré comme un
// swipe intentionnel (plutôt qu'un tap ou un léger tremblement du doigt).
const SEUIL_SWIPE_HORIZONTAL_PX = 50;
// Tolérance verticale : au-delà, le geste est un scroll de page, pas un
// swipe de période — on n'interfère pas (pas de preventDefault) et on
// annule la détection pour ce geste.
const TOLERANCE_SWIPE_VERTICAL_PX = 60;

// Clé remontée à chaque changement de période affichée (indépendante de la
// vue Jour/Semaine/Mois) : force React à démonter/remonter le conteneur
// pour rejouer l'animation `agenda-glisse-*` définie dans globals.css.
function periodKey(view: ViewKey, date: Date): string {
  if (view === "semaine") return toISODate(startOfWeek(date, { weekStartsOn: 1 }));
  if (view === "mois") return toISODate(date).slice(0, 7);
  return toISODate(date);
}

export function AgendaView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const {
    data: taches,
    isLoading: tachesLoading,
    isError: tachesError,
    refetch: refetchTaches,
  } = useQuery({
    queryKey: queryKeys.taches,
    queryFn: getTachesAvecRelations,
  });
  const { data: listes = [] } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });
  const { data: tags = [] } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });
  // Aucune mutation côté app sur ces deux tables (écrites uniquement hors
  // Server Action, via le skill kilio-planning-travail) : `staleTime: 0`
  // pour ne jamais rester en cache, contrairement à `taches` (dont les
  // mutations in-app invalident déjà correctement le cache, cf. TaskCard) —
  // reproduit la garantie de l'ancien `export const dynamic =
  // "force-dynamic"` de cette route pour ces deux lectures précises.
  const { data: creneaux = [] } = useQuery({
    queryKey: queryKeys.planningTravail,
    queryFn: getPlanningTravail,
    staleTime: 0,
  });
  const { data: exceptions = [] } = useQuery({
    queryKey: queryKeys.planningTravailExceptions,
    queryFn: getPlanningTravailExceptions,
    staleTime: 0,
  });

  // Une actualisation ratée laisse les données en cache : on garde l'agenda
  // et on prévient, plutôt que de le remplacer par un message d'erreur.
  const etatListe = etatListeTaches({
    isLoading: tachesLoading,
    isError: tachesError,
    aDesDonnees: taches !== undefined,
  });
  const actualisationKo = actualisationEchouee({ isError: tachesError, aDesDonnees: taches !== undefined });

  const reduceMotion = useReducedMotion() ?? false;
  const [view, setView] = useState<ViewKey>("jour");
  // ?date=AAAA-MM-JJ : deep-link depuis la recherche globale (événements).
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const dateParam = searchParams.get("date");
    return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? parseISODate(dateParam) : startOfToday();
  });
  const [fabOpen, setFabOpen] = useState(false);
  // Événement léger en cours d'édition (`{}` = création), voir EvenementForm.
  const [evenementForm, setEvenementForm] = useState<{ evenement?: Evenement } | null>(null);
  const [evenementsMasques, setEvenementsMasques] = useState<ReadonlySet<string>>(() => new Set());

  // Événements du mois affiché, plus une semaine de marge de chaque côté (une
  // semaine à cheval sur deux mois reste complète). Les événements précédents
  // restent affichés pendant le chargement d'un autre mois.
  const fenetreDebut = toISODate(addDays(startOfMonth(selectedDate), -7));
  const fenetreFin = toISODate(addDays(endOfMonth(selectedDate), 7));
  const { data: evenementsBruts = [] } = useQuery({
    queryKey: queryKeys.evenementsPlage(fenetreDebut, fenetreFin),
    queryFn: () => getEvenements(fenetreDebut, fenetreFin),
    placeholderData: keepPreviousData,
  });
  const evenements = evenementsBruts.filter((e) => !evenementsMasques.has(e.id));
  // Tâche ciblée par un deep-link de notification (?tache=<id>, cf.
  // envoyer-rappels-taches). Contrairement à l'ancienne page Server
  // Component, `taches` n'est plus disponible dès le tout premier rendu
  // (chargement client via useQuery) : la date/mise en surbrillance sont
  // donc appliquées dans un effet une fois `taches` chargé, plutôt que dans
  // l'état initial. `deepLinkApplique` évite de ré-appliquer le deep-link
  // après un refetch ultérieur (ex. retour en arrière dans la session).
  const [tacheEnSurbrillanceId, setTacheEnSurbrillanceId] = useState<string | null>(null);
  const deepLinkAppliqueRef = useRef(false);

  useEffect(() => {
    if (deepLinkAppliqueRef.current || !taches) return;
    const tacheDeepLinkId = searchParams.get("tache");
    if (!tacheDeepLinkId) return;
    deepLinkAppliqueRef.current = true;
    const cible = taches.find((t) => t.id === tacheDeepLinkId && t.echeance);
    if (cible) {
      // Synchronisation ponctuelle depuis une donnée externe arrivée de
      // façon asynchrone (premier chargement de `taches`), gardée par
      // `deepLinkAppliqueRef` : ne s'exécute qu'une fois, pas un
      // enchaînement de re-rendus.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDate(parseISODate(cible.echeance!));
      setTacheEnSurbrillanceId(cible.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches]);

  // Nettoie le paramètre ?tache= de l'URL une fois lu ci-dessus, pour éviter
  // que le comportement se répète à chaque re-render/navigation ultérieure
  // dans la session (ex. retour en arrière, refetch de `taches`).
  useEffect(() => {
    if (!searchParams.get("tache") && !searchParams.get("date")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tache");
    params.delete("date");
    router.replace(params.toString() ? `/agenda?${params.toString()}` : "/agenda", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Sens du dernier changement de période (1 = vers la suivante, -1 = vers
  // la précédente), pilote le sens de la transition CSS ci-dessous. Mis à
  // jour aussi bien par le swipe que par les flèches ‹/› déjà existantes
  // dans chaque vue (et le bouton "Aujourd'hui"), en comparant la nouvelle
  // date à l'ancienne dans handleChangeDate.
  const [direction, setDirection] = useState<1 | -1>(1);
  // Point de départ du geste en cours (null si aucun geste).
  const toucheDebutRef = useRef<{ x: number; y: number } | null>(null);
  // true dès que le geste en cours s'est révélé vertical (scroll de page) :
  // on ne déclenche alors plus de changement de période à la fin, sans avoir
  // bloqué le scroll natif (aucun preventDefault n'est appelé ici).
  const swipeAnnulePourGesteRef = useRef(false);
  // Élément scrollable horizontalement le plus proche sous le doigt au
  // démarrage du geste (marqué `[data-swipe-ignore]`, ex. la grille Semaine
  // qui défile au doigt quand elle est zoomée), et son scrollLeft à cet
  // instant. Contrairement à Officio — où data-swipe-ignore ne couvre qu'un
  // petit strip annexe — cette zone occupe ici la quasi-totalité de la vue
  // Semaine : l'ignorer dès le touchstart désactiverait le swipe de semaine
  // presque partout. On laisse donc le geste démarrer normalement et on ne
  // l'annule qu'a posteriori, au touchend, si un défilement horizontal a
  // réellement eu lieu dans cet élément (cf. gererToucheFin) — ce qui laisse
  // le swipe de semaine fonctionner près des bords de la grille (déjà en
  // butée de scroll) et à chaque fois qu'elle n'a pas besoin de défiler.
  const swipeIgnoreElRef = useRef<HTMLElement | null>(null);
  const swipeIgnoreScrollLeftDebutRef = useRef(0);

  // Une seule entrée d'historique pour les deux fenêtres (jamais ouvertes en
  // même temps) : Retour ferme la fenêtre au lieu de quitter l'agenda.
  useBackClose(fabOpen || evenementForm !== null, () => {
    setFabOpen(false);
    setEvenementForm(null);
  });

  function selectDay(date: Date) {
    setSelectedDate(date);
    setView("jour");
  }

  // Tap sur un bloc de la grille Jour (cf. DayView/TacheBlock) : surligne la
  // tâche et scrolle sa TaskCard en vue, en réutilisant le mécanisme déjà en
  // place pour le deep-link de notification. Un retap sur le même bloc doit
  // rejouer l'effet (scroll + anneau) alors que l'id sélectionné ne change
  // pas : `setTacheEnSurbrillanceId(id)` seul ne re-rendrait rien (React
  // bail out sur un state primitif identique), donc aucun effet keyé sur
  // `highlighted` (TaskCard) ne se redéclencherait. On repasse d'abord par
  // `null` (retire réellement la surbrillance le temps d'un repaint) puis on
  // refixe l'id à la frame suivante — un aller-retour false→true garanti,
  // que ce soit une nouvelle sélection ou la même qu'avant.
  function handleSelectTache(id: string) {
    setTacheEnSurbrillanceId(null);
    requestAnimationFrame(() => setTacheEnSurbrillanceId(id));
  }

  // Suppression d'un événement avec toast « Annuler » : masqué tout de suite,
  // supprimé côté serveur à l'expiration du toast.
  function supprimerEvenement(evenement: Evenement) {
    setEvenementForm(null);
    const retirer = () =>
      setEvenementsMasques((m) => {
        const suivant = new Set(m);
        suivant.delete(evenement.id);
        return suivant;
      });
    supprimerAvecAnnulation({
      texte: `« ${evenement.titre} » supprimé`,
      ariaLabel: `Annuler la suppression de « ${evenement.titre} »`,
      masquer: () => setEvenementsMasques((m) => new Set(m).add(evenement.id)),
      restaurer: retirer,
      supprimer: () => deleteEvenement(evenement.id),
      erreur: `Impossible de supprimer « ${evenement.titre} ». Réessaie.`,
      onSupprime: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.evenements }).then(retirer);
      },
    });
  }

  function handleChangeDate(date: Date) {
    if (date.getTime() > selectedDate.getTime()) setDirection(1);
    else if (date.getTime() < selectedDate.getTime()) setDirection(-1);
    setSelectedDate(date);
  }

  function gererToucheDebut(e: React.TouchEvent<HTMLDivElement>) {
    // Pinch-zoom (T13) : dès qu'un deuxième doigt se pose, le geste n'est
    // plus un swipe de période.
    if (e.touches.length > 1) {
      swipeAnnulePourGesteRef.current = true;
      return;
    }
    const cible = e.target as HTMLElement;
    const ignoreEl = cible.closest<HTMLElement>("[data-swipe-ignore]");
    swipeIgnoreElRef.current = ignoreEl;
    swipeIgnoreScrollLeftDebutRef.current = ignoreEl?.scrollLeft ?? 0;
    const touche = e.touches[0];
    toucheDebutRef.current = { x: touche.clientX, y: touche.clientY };
    swipeAnnulePourGesteRef.current = false;
  }

  function gererToucheMove(e: React.TouchEvent<HTMLDivElement>) {
    const debut = toucheDebutRef.current;
    if (!debut || swipeAnnulePourGesteRef.current) return;
    if (e.touches.length > 1) {
      swipeAnnulePourGesteRef.current = true;
      return;
    }
    const touche = e.touches[0];
    if (Math.abs(touche.clientY - debut.y) > TOLERANCE_SWIPE_VERTICAL_PX) {
      swipeAnnulePourGesteRef.current = true;
    }
  }

  function gererToucheFin(e: React.TouchEvent<HTMLDivElement>) {
    // Un doigt levé alors qu'un autre reste posé : fin de pinch, pas swipe.
    if (e.touches.length > 0) return;
    const debut = toucheDebutRef.current;
    const annule = swipeAnnulePourGesteRef.current;
    const ignoreEl = swipeIgnoreElRef.current;
    const aDefileHorizontalement =
      ignoreEl !== null && Math.abs(ignoreEl.scrollLeft - swipeIgnoreScrollLeftDebutRef.current) > 2;
    toucheDebutRef.current = null;
    swipeAnnulePourGesteRef.current = false;
    swipeIgnoreElRef.current = null;
    if (!debut) return;

    const touche = e.changedTouches[0];
    const deltaX = touche.clientX - debut.x;
    const deltaY = touche.clientY - debut.y;
    if (
      annule ||
      aDefileHorizontalement ||
      Math.abs(deltaX) < SEUIL_SWIPE_HORIZONTAL_PX ||
      Math.abs(deltaY) > TOLERANCE_SWIPE_VERTICAL_PX
    ) {
      return;
    }

    if (view === "jour") {
      handleChangeDate(deltaX < 0 ? addDays(selectedDate, 1) : subDays(selectedDate, 1));
    } else if (view === "semaine") {
      handleChangeDate(deltaX < 0 ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1));
    } else if (view === "mois") {
      handleChangeDate(deltaX < 0 ? addMonths(selectedDate, 1) : subMonths(selectedDate, 1));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setFabOpen(true)}
        aria-label="Ajouter une tâche"
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-on-agenda shadow-card"
        style={{ background: "var(--accent-agenda)", bottom: "calc(env(safe-area-inset-bottom) + 90px)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <AnimatePresence>
        {fabOpen && (
          <Modal key="nouvelle-tache" title="Nouvelle tâche" onClose={() => setFabOpen(false)}>
            <AddTaskForm
              listes={listes}
              tags={tags}
              defaultEcheance={toISODate(selectedDate)}
              onDone={(_id, avertissement) => {
                setFabOpen(false);
                queryClient.invalidateQueries({ queryKey: queryKeys.taches });
                // Création réussie mais tags/image en échec : ne pas le taire.
                if (avertissement) showToast(avertissement, DUREE_TOAST_AVERTISSEMENT_MS);
              }}
            />
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {evenementForm && (
          <Modal
            key="evenement"
            title={evenementForm.evenement ? "Modifier l'événement" : "Nouvel événement"}
            onClose={() => setEvenementForm(null)}
          >
            <EvenementForm
              evenement={evenementForm.evenement}
              dateParDefaut={toISODate(selectedDate)}
              onSaved={() => {
                setEvenementForm(null);
                showToast(evenementForm.evenement ? "Événement modifié" : "Événement ajouté");
                queryClient.invalidateQueries({ queryKey: queryKeys.evenements });
              }}
              onSupprimer={
                evenementForm.evenement ? () => supprimerEvenement(evenementForm.evenement!) : undefined
              }
            />
          </Modal>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-2xl border border-line bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              className="relative flex-1 rounded-xl py-2 text-[13px] font-semibold"
            >
              {view === v.key && (
                <motion.div
                  layoutId={AGENDA_VUE_ACTIVE_PILL}
                  className="absolute inset-0 rounded-xl bg-agenda"
                  transition={vuePillTransition(reduceMotion)}
                />
              )}
              <span className={`relative transition-colors ${view === v.key ? "text-on-agenda" : "text-ink-2"}`}>
                {v.label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setEvenementForm({})}
          aria-label="Ajouter un événement"
          className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agenda"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Événement
        </button>
      </div>

      {actualisationKo && (
        <p role="status" className={errorText}>
          Actualisation impossible : dernières données affichées.
        </p>
      )}
      {etatListe === "chargement" ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <ListItemSkeletonGroup count={5} withSubtitle />
        </div>
      ) : etatListe === "erreur" || !taches ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="alert">
          <p className={errorText}>Erreur de chargement de l&apos;agenda. Réessaie.</p>
          <button type="button" onClick={() => refetchTaches()} className={secondaryButton}>
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {view !== "liste" && (
            <div onTouchStart={gererToucheDebut} onTouchMove={gererToucheMove} onTouchEnd={gererToucheFin}>
              <div
                key={periodKey(view, selectedDate)}
                className={direction === 1 ? "agenda-glisse-suivant" : "agenda-glisse-precedent"}
              >
                {view === "jour" && (
                  <DayView
                    taches={taches}
                    listes={listes}
                    tags={tags}
                    creneaux={creneaux}
                    exceptions={exceptions}
                    evenements={evenements}
                    selectedDate={selectedDate}
                    onChangeDate={handleChangeDate}
                    tacheEnSurbrillanceId={tacheEnSurbrillanceId}
                    onSelectTache={handleSelectTache}
                    onSelectEvenement={(evenement) => setEvenementForm({ evenement })}
                  />
                )}
                {view === "semaine" && (
                  <WeekView
                    taches={taches}
                    creneaux={creneaux}
                    exceptions={exceptions}
                    evenements={evenements}
                    selectedDate={selectedDate}
                    onChangeDate={handleChangeDate}
                    onSelectDay={selectDay}
                  />
                )}
                {view === "mois" && (
                  <MonthView
                    taches={taches}
                    evenements={evenements}
                    creneaux={creneaux}
                    exceptions={exceptions}
                    selectedDate={selectedDate}
                    onChangeDate={handleChangeDate}
                    onSelectDay={selectDay}
                  />
                )}
              </div>
            </div>
          )}
          {view === "liste" && <ListView
              taches={taches}
              evenements={evenements}
              listes={listes}
              tags={tags}
              onSelectEvenement={(evenement) => setEvenementForm({ evenement })}
            />}
        </>
      )}
    </div>
  );
}
