"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AddCourseForm } from "./courses/AddCourseForm";
import { EvenementForm } from "./aujourdhui/EvenementForm";
import { Modal } from "@/components/Modal";
import { goBackSteps, useBackClose } from "@/hooks/useBackClose";
import { getListes, getTags } from "@/app/actions/taches";
import { aujourdhuiISO } from "@/lib/date/recurrence";
import { queryKeys } from "@/lib/query/keys";
import { preloadAddTaskForm } from "./taches/preloadAddTaskForm";
import { showToast } from "@/components/toast/toast-store";
import { DUREE_TOAST_AVERTISSEMENT_MS } from "@/lib/taches/compute";
import { useAjoutRepasTermine } from "./nutrition/journal/AjoutRepasBouton";

const AddTaskForm = dynamic(() => import("./taches/AddTaskForm").then((m) => m.AddTaskForm), {
  ssr: false,
});
const NoteForm = dynamic(() => import("./notes/NoteForm").then((m) => m.NoteForm), { ssr: false });
const AjoutRepasPanneau = dynamic(
  () => import("./nutrition/journal/AjoutRepasPanneau").then((m) => m.AjoutRepasPanneau),
  { ssr: false }
);

type Mode = null | "menu" | "tache" | "evenement" | "note" | "course" | "repas";

// Mode « direct » : le FAB ouvre tout de suite le formulaire de tâche, sans
// passer par le menu Tâche/Note/Course (utilisé par /taches). Sans cette
// option, le comportement du dashboard est inchangé.
export type DirectTaskOptions = {
  defaultListeId?: string;
  defaultEcheance?: string;
  // Appelé avec l'id de la tâche créée (et, si une étape secondaire — tags,
  // images — a échoué, le texte d'avertissement à afficher) ; c'est à
  // l'appelant de rafraîchir ses données (le dashboard, lui, invalide déjà
  // queryKeys.taches).
  onCreated?: (id?: string, avertissement?: string) => void;
};

// listes/tags ne servent qu'une fois un formulaire ouvert : fetch client
// pur, non préchargé côté serveur, pour ne jamais retarder l'affichage des
// cartes principales du dashboard (voir reports/2026-09-04-dashboard-streaming-par-section.md).
export function QuickAddFab({ directTask }: { directTask?: DirectTaskOptions }) {
  const [mode, setMode] = useState<Mode>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: listes = [] } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });
  const { data: tags = [] } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });
  const direct = directTask !== undefined;
  const repasTermine = useAjoutRepasTermine();

  // Raccourcis d'appui long sur l'icône (public/manifest.json) : `?action=new`
  // ouvre le formulaire de tâche (mode direct de /taches), `?ajout=evenement`
  // celui d'événement. Le paramètre est retiré de l'URL pour qu'un
  // rechargement ne rouvre pas le formulaire.
  // La lecture et le nettoyage de l'URL sont dans le callback différé : le
  // nettoyage de l'effet l'annule (double rendu de React en dev) avant que
  // l'URL ait été modifiée.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const demande: Mode =
        params.get("ajout") === "evenement" ? "evenement" : direct && params.get("action") === "new" ? "tache" : null;
      if (!demande) return;
      params.delete("ajout");
      params.delete("action");
      const reste = params.toString();
      history.replaceState(history.state, "", window.location.pathname + (reste ? `?${reste}` : ""));
      setMode(demande);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [direct]);

  // The dial's history entry stays pushed for as long as *anything* is
  // open (menu or form) so a single back press from a form lands on the
  // menu, not straight back home. In direct mode there is no menu, hence a
  // single history entry (the form's own, below).
  useBackClose(mode !== null && !direct, () => setMode(null));
  // The form's own entry sits on top of the dial's. Guarded with a
  // functional update so it's a no-op if the dial-level handler above
  // already closed everything (e.g. goBackSteps(2) from onDone). In direct
  // mode, closing the form closes everything (no menu to land on).
  useBackClose(
    mode === "tache" || mode === "evenement" || mode === "note" || mode === "course" || mode === "repas",
    () =>
      setMode((m) => {
        if (direct) return null;
        return m === "tache" || m === "evenement" || m === "note" || m === "course" || m === "repas"
          ? "menu"
          : m;
      })
  );

  const dialOpen = mode !== null;
  const dialInteractive = mode === "menu";

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ pointerEvents: dialInteractive ? "auto" : "none" }}
        onClick={() => history.back()}
      />

      {/* `pointer-events-none` : la boîte du conteneur couvre aussi les entrées
          du menu masquées, empilées au-dessus du « + » (une colonne haute à
          droite). Sans ça, un geste de scroll y démarre sur un élément `fixed`,
          dont la chaîne de scroll saute `<main>` : la page ne défile plus.
          Chaque bouton réactive ses propres événements. */}
      <div
        className="pointer-events-none fixed right-4 z-40 flex flex-col-reverse items-center gap-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 90px)", viewTransitionName: "fab" }}
      >
        <button
          type="button"
          onClick={() => (mode === null ? setMode(direct ? "tache" : "menu") : history.back())}
          onPointerDown={preloadAddTaskForm}
          onFocus={preloadAddTaskForm}
          aria-label={direct ? "Ajouter une tâche" : mode === null ? "Ajouter" : "Fermer"}
          aria-expanded={direct ? undefined : mode !== null}
          aria-haspopup={direct ? "dialog" : undefined}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full text-on-kcal shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
          style={{ background: "var(--accent-kcal)" }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="transition-transform duration-200 ease-out"
            style={{ transform: dialOpen ? "rotate(45deg)" : "rotate(0deg)" }}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        {/* Entrées du menu : absentes en mode direct (seul le "+" est affiché). */}
        {!direct && (
        <>
        <button
          type="button"
          onClick={() => setMode("repas")}
          aria-label="Ajouter un repas"
          tabIndex={dialInteractive ? 0 : -1}
          className="flex items-center gap-2 transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: dialOpen ? 1 : 0,
            transform: dialOpen ? "translateY(0)" : "translateY(12px)",
            pointerEvents: dialInteractive ? "auto" : "none",
          }}
        >
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card">
            Repas
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3v8a2 2 0 0 0 2 2v8" />
              <path d="M11 3v8a2 2 0 0 1-2 2" />
              <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("course")}
          aria-label="Courses"
          tabIndex={dialInteractive ? 0 : -1}
          className="flex items-center gap-2 transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: dialOpen ? 1 : 0,
            transform: dialOpen ? "translateY(0)" : "translateY(12px)",
            pointerEvents: dialInteractive ? "auto" : "none",
          }}
        >
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card">
            Courses
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("tache")}
          aria-label="Nouvelle tâche"
          tabIndex={dialInteractive ? 0 : -1}
          className="flex items-center gap-2 transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: dialOpen ? 1 : 0,
            transform: dialOpen ? "translateY(0)" : "translateY(12px)",
            pointerEvents: dialInteractive ? "auto" : "none",
          }}
        >
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card">
            Tâches
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("evenement")}
          aria-label="Nouvel événement"
          tabIndex={dialInteractive ? 0 : -1}
          className="flex items-center gap-2 transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: dialOpen ? 1 : 0,
            transform: dialOpen ? "translateY(0)" : "translateY(12px)",
            pointerEvents: dialInteractive ? "auto" : "none",
          }}
        >
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card">
            Événement
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("note")}
          aria-label="Nouvelle note"
          tabIndex={dialInteractive ? 0 : -1}
          className="flex items-center gap-2 transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: dialOpen ? 1 : 0,
            transform: dialOpen ? "translateY(0)" : "translateY(12px)",
            pointerEvents: dialInteractive ? "auto" : "none",
          }}
        >
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card">
            Notes
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </span>
        </button>
        </>
        )}
      </div>

      <AnimatePresence>
        {mode === "tache" && (
          <Modal key="tache" title="Nouvelle tâche" onClose={() => history.back()}>
            <AddTaskForm
              listes={listes}
              tags={tags}
              defaultListeId={directTask?.defaultListeId}
              defaultEcheance={directTask?.defaultEcheance}
              onDone={(id, avertissement) => {
                if (direct) {
                  // Un seul niveau d'historique à refermer (pas de menu).
                  directTask?.onCreated?.(id, avertissement);
                  goBackSteps(1);
                } else {
                  queryClient.invalidateQueries({ queryKey: queryKeys.taches });
                  // Le dashboard n'affichait rien après une création : un
                  // avertissement (image ou tags en échec) ne doit pas être
                  // perdu en silence.
                  if (avertissement) showToast(avertissement, DUREE_TOAST_AVERTISSEMENT_MS);
                  goBackSteps(2);
                }
              }}
            />
          </Modal>
        )}

        {mode === "evenement" && (
          <Modal key="evenement" title="Nouvel événement" onClose={() => history.back()}>
            <EvenementForm
              dateParDefaut={aujourdhuiISO()}
              onSaved={() => {
                showToast("Événement ajouté");
                void queryClient.invalidateQueries({ queryKey: queryKeys.evenements });
                // Les écrans serveur (Agenda) relisent leurs données.
                router.refresh();
                goBackSteps(2);
              }}
            />
          </Modal>
        )}

        {mode === "note" && (
          <Modal key="note" title="Nouvelle note" onClose={() => history.back()}>
            <NoteForm
              tags={tags}
              onDone={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.notes });
                goBackSteps(2);
              }}
            />
          </Modal>
        )}

        {mode === "repas" && (
          <Modal key="repas" title="Ajouter un repas" onClose={() => history.back()}>
            {/* Sans date : le jour courant côté serveur, comme le Journal
                ouvert sans ?date. */}
            <AjoutRepasPanneau
              onAjoute={(item, moment) => {
                repasTermine(item, moment);
                goBackSteps(2);
              }}
            />
          </Modal>
        )}

        {mode === "course" && (
          <Modal key="course" title="Ajouter à la liste de courses" onClose={() => history.back()}>
            {/* Le formulaire reste ouvert après chaque ajout (#1) : la
                fermeture se fait uniquement par le bouton de fermeture de la
                Modal ou par le retour (useBackClose ci-dessus), plus par
                `onDone` après un ajout. */}
            <AddCourseForm />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
