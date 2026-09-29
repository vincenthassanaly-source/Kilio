"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runAction } from "@/lib/actions/runAction";
import {
  analyserSaisieTaches,
  creerTachesProposees,
  preparerListe,
  type TacheACreer,
} from "@/app/actions/saisie-taches";
import { getListes, getTags } from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import { goBackSteps, useBackClose } from "@/hooks/useBackClose";
import { Modal } from "@/components/Modal";
import { CheckToggle } from "@/components/CheckToggle";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { DUREE_TOAST_AVERTISSEMENT_MS } from "@/lib/taches/compute";
import { addCardIcon, card, ghostButton, input, kcalPillTag, pillTag, primaryButton, secondaryButton } from "@/lib/ui";
import {
  MAX_TEXTE,
  libelleQuand,
  libelleRappel,
  libelleRepetition,
  type PrecisionDonnee,
  type TachePropose,
} from "@/lib/taches/saisie-naturelle";
import { preloadAddTaskForm } from "./taches/preloadAddTaskForm";

const AddTaskForm = dynamic(() => import("./taches/AddTaskForm").then((m) => m.AddTaskForm), {
  ssr: false,
});

type Etape = "saisie" | "analyse" | "question" | "apercu" | "erreur";
type Ligne = { cle: number; tache: TachePropose; retenue: boolean; echec?: string };
type Erreur = { code: "quota" | "echec" | "incomprehensible"; message: string };
// `cle` : ligne de l'aperçu à retirer une fois le formulaire validé ; null
// pour la création simple depuis le texte brut (repli sans IA).
type Edition = { cle: number | null; titre: string; tache?: TachePropose; listeId?: string };

const MESSAGE_ANALYSE = "L'analyse a échoué. Réessaie.";

// Même trait que les icônes de l'app (stroke 1.8, currentColor) : étincelles
// pour l'IA, comme la carte « Programme du jour ».
function IconeEtincelles() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
    </svg>
  );
}

function IconeChevron({ ouvert, reduit }: { ouvert: boolean; reduit: boolean }) {
  return (
    <motion.svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-3)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      animate={{ rotate: ouvert ? 180 : 0 }}
      transition={{ duration: reduit ? 0 : 0.2, ease: "easeOut" }}
    >
      <path d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}

function IconeAttention() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-[3px] shrink-0">
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

function versCreation(t: TachePropose): TacheACreer {
  return {
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
  };
}

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

// Saisie de tâches en langage naturel : la carte s'étend sur place (comme
// « Programme du jour », jamais de navigation). Gemini propose, l'aperçu
// montre ce qui serait créé, et rien n'existe avant le tap de validation.
// Le formulaire de tâche habituel sert de sortie de secours : « Modifier »
// une proposition, ou création simple quand l'IA est indisponible.
export function DashboardSaisieIACard() {
  const reduit = useReducedMotion() ?? false;
  const queryClient = useQueryClient();
  const { data: listes = [] } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });
  const { data: tags = [] } = useQuery({ queryKey: queryKeys.tags, queryFn: getTags });

  const panneauId = useId();
  const champId = useId();
  const champRef = useRef<HTMLTextAreaElement>(null);
  const questionRef = useRef<HTMLParagraphElement>(null);
  // Numéro de la dernière requête : une réponse arrivée après un retour en
  // arrière ou une fermeture est ignorée.
  const requete = useRef(0);

  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>("saisie");
  const [texte, setTexte] = useState("");
  const [precisions, setPrecisions] = useState<PrecisionDonnee[]>([]);
  const [question, setQuestion] = useState<{ texte: string; choix: string[] } | null>(null);
  const [autreReponse, setAutreReponse] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState<Erreur | null>(null);
  const [creation, setCreation] = useState(false);
  const [preparation, setPreparation] = useState<number | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);

  // Même mécanique que QuickAddFab : le retour du navigateur ferme le
  // formulaire, jamais l'app.
  useBackClose(edition !== null, () => setEdition(null));

  useEffect(() => {
    if (ouvert && etape === "saisie") champRef.current?.focus();
  }, [ouvert, etape]);

  useEffect(() => {
    if (etape === "question") questionRef.current?.focus();
  }, [etape, question]);

  function reinitialiser() {
    requete.current += 1;
    setOuvert(false);
    setEtape("saisie");
    setTexte("");
    setPrecisions([]);
    setQuestion(null);
    setAutreReponse("");
    setLignes([]);
    setErreur(null);
    setCreation(false);
  }

  async function analyser(texteAnalyse: string, precisionsAnalyse: PrecisionDonnee[]) {
    const numero = ++requete.current;
    setPrecisions(precisionsAnalyse);
    setAutreReponse("");
    setEtape("analyse");

    const resultat = await runAction(() => analyserSaisieTaches(texteAnalyse, precisionsAnalyse), {
      erreur: MESSAGE_ANALYSE,
      silencieux: true,
    });
    if (numero !== requete.current) return;

    if (!resultat.ok) {
      setErreur({ code: "echec", message: resultat.error });
      setEtape("erreur");
      return;
    }
    const analyse = resultat.data;
    if (analyse.statut === "taches") {
      setLignes(analyse.taches.map((tache, cle) => ({ cle, tache, retenue: true })));
      setEtape("apercu");
    } else if (analyse.statut === "question") {
      setQuestion({ texte: analyse.question, choix: analyse.choix });
      setEtape("question");
    } else {
      setErreur({ code: analyse.code, message: analyse.message });
      setEtape("erreur");
    }
  }

  function soumettre() {
    const propre = texte.trim();
    if (propre) void analyser(propre, []);
  }

  function repondre(reponse: string) {
    const propre = reponse.trim();
    if (!propre || !question) return;
    void analyser(texte.trim(), [...precisions, { question: question.texte, reponse: propre }]);
  }

  function modifierLeTexte() {
    requete.current += 1;
    setPrecisions([]);
    setQuestion(null);
    setErreur(null);
    setEtape("saisie");
  }

  function basculerLigne(cle: number) {
    setLignes((courantes) => courantes.map((l) => (l.cle === cle ? { ...l, retenue: !l.retenue } : l)));
  }

  async function creer() {
    const retenues = lignes.filter((l) => l.retenue);
    if (retenues.length === 0 || creation) return;
    setCreation(true);

    const resultat = await runAction(() => creerTachesProposees(retenues.map((l) => versCreation(l.tache))), {
      erreur: "La création a échoué. Réessaie.",
    });
    setCreation(false);
    if (!resultat.ok) return; // toast déjà affiché par runAction, l'aperçu reste intact

    const reussies = new Set<number>();
    const echecs = new Map<number, string>();
    for (const r of resultat.data) {
      const cle = retenues[r.index].cle;
      if (r.ok) {
        reussies.add(cle);
        if (r.avertissement) showToast(r.avertissement, DUREE_TOAST_AVERTISSEMENT_MS);
      } else {
        echecs.set(cle, r.message);
      }
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    void queryClient.invalidateQueries({ queryKey: queryKeys.listes });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    if (reussies.size > 0) showToast(reussies.size === 1 ? "Tâche créée" : `${reussies.size} tâches créées`);

    if (echecs.size === 0) {
      reinitialiser();
      return;
    }
    // Seules les tâches en échec restent, avec la raison ; état courant
    // plutôt que la copie d'avant l'attente serveur.
    setLignes((courantes) =>
      courantes.filter((l) => echecs.has(l.cle)).map((l) => ({ ...l, retenue: true, echec: echecs.get(l.cle) }))
    );
  }

  async function modifier(ligne: Ligne) {
    const t = ligne.tache;
    let listeId = t.listeId ?? undefined;
    if (!listeId && t.nouvelleListe) {
      // Le formulaire ne sait choisir qu'une liste existante : elle est créée
      // au moment où Vincent choisit de poursuivre avec cette tâche.
      setPreparation(ligne.cle);
      const nom = t.nouvelleListe;
      const resultat = await runAction(() => preparerListe(nom), {
        erreur: "La liste n'a pas pu être créée. Réessaie.",
      });
      setPreparation(null);
      if (!resultat.ok) return;
      listeId = resultat.data.id;
      await queryClient.invalidateQueries({ queryKey: queryKeys.listes });
    }
    setEdition({ cle: ligne.cle, titre: t.titre, tache: t, listeId });
  }

  function creerSimple() {
    setEdition({ cle: null, titre: texte.trim() });
  }

  function formulaireTermine(avertissement?: string) {
    const courante = edition;
    void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    if (avertissement) showToast(avertissement, DUREE_TOAST_AVERTISSEMENT_MS);
    showToast("Tâche créée");
    goBackSteps(1);

    if (courante?.cle == null) {
      reinitialiser();
      return;
    }
    const cleCreee = courante.cle;
    const restantes = lignes.filter((l) => l.cle !== cleCreee);
    if (restantes.length === 0) reinitialiser();
    else setLignes(restantes);
  }

  const retenues = lignes.filter((l) => l.retenue).length;
  const sousTitre = !ouvert
    ? "Décris ta tâche en une phrase"
    : {
        saisie: "Décris ta tâche en une phrase",
        analyse: "Analyse en cours…",
        question: "Une précision est nécessaire",
        apercu: lignes.length === 1 ? "1 tâche à valider" : `${lignes.length} tâches à valider`,
        erreur: "L'analyse n'a pas abouti",
      }[etape];

  return (
    // Pas d'animation `layout` sur la carte : un changement d'étape (analyse →
    // aperçu…) modifie sa hauteur d'un coup, et la projection de framer-motion
    // déformerait le texte pendant la transition. Seules l'ouverture et la
    // fermeture animent la hauteur (panneau ci-dessous).
    <div className={card}>
      <motion.button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        whileTap={reduit ? undefined : { scale: 0.98 }}
        aria-expanded={ouvert}
        aria-controls={panneauId}
        className={`flex w-full items-center gap-3 rounded-xl text-left ${focusRing}`}
      >
        <span className={addCardIcon}>
          <IconeEtincelles />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-ink">Ajouter avec l&apos;IA</span>
          <span className="truncate text-[12.5px] text-ink-2">{sousTitre}</span>
        </span>
        <IconeChevron ouvert={ouvert} reduit={reduit} />
      </motion.button>

      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.div
            id={panneauId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduit ? 0 : 0.25, ease: "easeOut" }}
            // Marge négative compensée : l'anneau de focus des boutons pleine
            // largeur n'est pas rogné par `overflow-hidden`.
            className="-mx-1 -mb-1 overflow-hidden px-1 pb-1"
          >
            <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
              {etape === "saisie" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    soumettre();
                  }}
                  className="flex flex-col gap-3"
                >
                  <label htmlFor={champId} className="sr-only">
                    Décris la ou les tâches à ajouter
                  </label>
                  <textarea
                    id={champId}
                    ref={champRef}
                    rows={3}
                    value={texte}
                    maxLength={MAX_TEXTE}
                    enterKeyHint="send"
                    placeholder="Ex. : dentiste jeudi 14h, rappel la veille"
                    onChange={(e) => setTexte(e.target.value)}
                    onKeyDown={(e) => {
                      // Entrée envoie (un seul geste au clavier mobile),
                      // Maj+Entrée saute une ligne ; la validation d'un mot
                      // par le clavier (IME) n'envoie rien.
                      if (e.key !== "Enter" || e.shiftKey) return;
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      e.preventDefault();
                      soumettre();
                    }}
                    className={`${input} w-full resize-none placeholder:text-ink-2`}
                  />
                  <button type="submit" disabled={!texte.trim()} className={`${primaryButton} min-h-11 w-full`}>
                    Analyser
                  </button>
                  <p className="text-pretty text-[12.5px] text-ink-2">Rien n&apos;est créé avant que tu valides.</p>
                </form>
              )}

              {etape === "analyse" && (
                <div role="status" className="flex flex-col gap-2 py-1">
                  <p className="line-clamp-2 text-[13.5px] text-ink-2">« {texte} »</p>
                  <Skeleton className="h-[14px] w-[88%]" />
                  <Skeleton className="h-[14px] w-[64%]" />
                  <span className="sr-only">Analyse en cours…</span>
                </div>
              )}

              {etape === "question" && question && (
                <div className="flex flex-col gap-3">
                  <p className="line-clamp-2 text-[12.5px] text-ink-2">« {texte} »</p>
                  <p
                    ref={questionRef}
                    tabIndex={-1}
                    id={`${champId}-question`}
                    className="text-balance text-[15px] font-semibold text-ink outline-none"
                  >
                    {question.texte}
                  </p>
                  {question.choix.length > 0 && (
                    <div role="group" aria-labelledby={`${champId}-question`} className="flex flex-wrap gap-2">
                      {question.choix.map((choix) => (
                        <button
                          key={choix}
                          type="button"
                          onClick={() => repondre(choix)}
                          className={`${secondaryButton} min-h-11 text-sm`}
                        >
                          {choix}
                        </button>
                      ))}
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      repondre(autreReponse);
                    }}
                    className="flex items-center gap-2"
                  >
                    <label htmlFor={`${champId}-autre`} className="sr-only">
                      Autre réponse
                    </label>
                    <input
                      id={`${champId}-autre`}
                      value={autreReponse}
                      maxLength={120}
                      enterKeyHint="send"
                      placeholder="Autre réponse"
                      onChange={(e) => setAutreReponse(e.target.value)}
                      className={`${input} min-w-0 flex-1 placeholder:text-ink-2`}
                    />
                    <button type="submit" disabled={!autreReponse.trim()} className={`${primaryButton} min-h-11 shrink-0`}>
                      Envoyer
                    </button>
                  </form>
                  <button type="button" onClick={modifierLeTexte} className={`${ghostButton} self-start`}>
                    Modifier mon texte
                  </button>
                </div>
              )}

              {etape === "apercu" && (
                <div className="flex flex-col gap-3">
                  <p role="status" className="text-pretty text-[12.5px] text-ink-2">
                    {lignes.length === 1
                      ? "Vérifie la tâche proposée, puis valide."
                      : "Décoche ce que tu ne veux pas, puis valide."}
                  </p>
                  <ul className="flex flex-col divide-y divide-line">
                    {lignes.map((ligne) => (
                      <li key={ligne.cle} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <CheckToggle
                          checked={ligne.retenue}
                          onToggle={() => basculerLigne(ligne.cle)}
                          label={`Créer « ${ligne.tache.titre} »`}
                          hitSlop={8}
                          className="mt-0.5"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`min-w-0 flex-1 text-balance text-[14px] font-semibold ${ligne.retenue ? "text-ink" : "text-ink-2 line-through"}`}>
                              {ligne.tache.titre}
                            </p>
                            <button
                              type="button"
                              disabled={preparation !== null}
                              onClick={() => void modifier(ligne)}
                              onPointerDown={preloadAddTaskForm}
                              onFocus={preloadAddTaskForm}
                              aria-label={`Modifier « ${ligne.tache.titre} »`}
                              className={`${ghostButton} -mt-1.5 shrink-0 disabled:opacity-60`}
                            >
                              {preparation === ligne.cle ? "…" : "Modifier"}
                            </button>
                          </div>
                          <p className="text-[12.5px] tabular-nums text-ink-2">{libelleQuand(ligne.tache)}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {pastilles(ligne.tache).map((p) => (
                              <span key={p.texte} className={p.accent ? kcalPillTag : pillTag}>
                                {p.texte}
                              </span>
                            ))}
                          </div>
                          {ligne.tache.avertissements.map((avertissement) => (
                            <p key={avertissement} className="flex items-start gap-1.5 text-[12.5px] text-ink-2">
                              <IconeAttention />
                              <span>{avertissement}</span>
                            </p>
                          ))}
                          {ligne.echec && (
                            <p role="alert" className="text-[12.5px] font-medium text-alert">
                              {ligne.echec}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void creer()}
                      disabled={retenues === 0 || creation}
                      className={`${primaryButton} min-h-11 w-full`}
                    >
                      {creation
                        ? "Création…"
                        : retenues === 0
                          ? "Aucune tâche retenue"
                          : retenues === 1
                            ? "Créer la tâche"
                            : `Créer ${retenues} tâches`}
                    </button>
                    <button type="button" onClick={modifierLeTexte} disabled={creation} className={`${secondaryButton} min-h-11 w-full`}>
                      Modifier mon texte
                    </button>
                  </div>
                </div>
              )}

              {etape === "erreur" && erreur && (
                <div className="flex flex-col gap-3">
                  <div role="alert" className="flex flex-col gap-1">
                    <p className="text-pretty text-[13.5px] text-ink">{erreur.message}</p>
                    <p className="line-clamp-2 text-[12.5px] text-ink-2">Ton texte est conservé : « {texte} »</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {erreur.code !== "incomprehensible" && (
                      <button
                        type="button"
                        onClick={() => void analyser(texte.trim(), precisions)}
                        className={`${erreur.code === "quota" ? secondaryButton : primaryButton} min-h-11 w-full`}
                      >
                        Réessayer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={creerSimple}
                      onPointerDown={preloadAddTaskForm}
                      onFocus={preloadAddTaskForm}
                      className={`${erreur.code === "quota" ? primaryButton : secondaryButton} min-h-11 w-full`}
                    >
                      Créer une tâche simple avec ce texte
                    </button>
                    <button type="button" onClick={modifierLeTexte} className={`${ghostButton} self-start`}>
                      Modifier mon texte
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {edition && (
          <Modal key="edition" title="Nouvelle tâche" onClose={() => history.back()}>
            <AddTaskForm
              listes={listes}
              tags={tags}
              defaultListeId={edition.listeId}
              defaultEcheance={edition.tache?.echeance ?? undefined}
              defaultHeure={edition.tache?.heure ?? undefined}
              initial={
                edition.tache
                  ? {
                      titre: edition.tache.titre,
                      priorite: edition.tache.priorite,
                      toute_la_journee: edition.tache.toute_la_journee,
                      heure_fin: edition.tache.heure_fin,
                      rappel_minutes: edition.tache.rappel_minutes,
                      recurrence_frequence: edition.tache.recurrence_frequence,
                      recurrence_fin: edition.tache.recurrence_fin,
                      tagIds: edition.tache.tagIds,
                      nouveauxTags: edition.tache.nouveauxTags,
                    }
                  : { titre: edition.titre }
              }
              onDone={(_id, avertissement) => formulaireTermine(avertissement)}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
