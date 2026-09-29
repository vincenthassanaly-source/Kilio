"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { runAction } from "@/lib/actions/runAction";
import { analyserSaisie, creerElementsProposes } from "@/app/actions/saisie-ia";
import { goBackSteps, useBackClose } from "@/hooks/useBackClose";
import { Modal } from "@/components/Modal";
import { CheckToggle } from "@/components/CheckToggle";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { DUREE_TOAST_AVERTISSEMENT_MS } from "@/lib/taches/compute";
import { addCardIcon, card, ghostButton, input, primaryButton, secondaryButton } from "@/lib/ui";
import { MAX_TEXTE, type ElementPropose, type PrecisionDonnee, type TypeElement } from "@/lib/saisie-ia/types";
import type { ModuleIAClient } from "./module-client";
import { pluriel } from "./communs";
import { MODULE_PAR_DEFAUT, TEXTES_SAISIE, TYPES_ELEMENT, moduleClient } from "./modules-client";

type Etape = "saisie" | "analyse" | "question" | "apercu" | "erreur";
type Ligne = { cle: number; element: ElementPropose; retenue: boolean; echec?: string };
type Erreur = { code: "quota" | "echec" | "incomprehensible"; message: string; detail?: string };
// `cle` : ligne de l'aperçu à retirer une fois le formulaire validé ; null
// pour la création simple depuis le texte brut (repli sans IA).
type Edition = { cle: number | null; moduleIA: ModuleIAClient; element: ElementPropose | null; titre: string };

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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

// Libellés d'un lot : ceux du module quand toutes les lignes en viennent, des
// termes neutres quand plusieurs modules sont mêlés.
function moduleDuLot(elements: ElementPropose[]): ModuleIAClient | null {
  const types = new Set(elements.map((e) => e.type));
  return types.size === 1 ? moduleClient(elements[0].type) : null;
}

const LIBELLES_NEUTRES = {
  verifier: "Vérifie ce qui est proposé, puis valide.",
  aValider: (n: number) => pluriel(n, "1 élément à valider", "{n} éléments à valider"),
  creer: (n: number) => pluriel(n, "Créer l'élément", "Créer {n} éléments"),
  aucuneRetenue: "Rien de retenu",
};

function libellesLot(moduleIA: ModuleIAClient | null) {
  return moduleIA ? moduleIA.libelles : LIBELLES_NEUTRES;
}

// « Ajouter avec l'IA » : la carte s'étend sur place (comme « Programme du
// jour », jamais de navigation). Gemini propose, l'aperçu montre ce qui serait
// créé dans chaque module branché (modules-client.ts), et rien n'existe avant le
// tap de validation. Le formulaire manuel du module sert de sortie de secours :
// « Modifier » une proposition, ou création simple quand l'IA est indisponible.
export function SaisieIABarre() {
  const reduit = useReducedMotion() ?? false;
  const queryClient = useQueryClient();

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

    const resultat = await runAction(() => analyserSaisie(texteAnalyse, precisionsAnalyse), {
      erreur: MESSAGE_ANALYSE,
      silencieux: true,
    });
    if (numero !== requete.current) return;

    if (!resultat.ok) {
      // Le message de repli de runAction (exception côté appel) sans cause
      // plus précise : le serveur n'a pas répondu correctement (plantage ou
      // délai de la fonction), ce que l'action ne peut pas rattraper elle-même.
      setErreur({
        code: "echec",
        message: resultat.error,
        detail:
          resultat.error === MESSAGE_ANALYSE
            ? "Le serveur n'a pas répondu correctement (erreur ou délai de la fonction)."
            : undefined,
      });
      setEtape("erreur");
      return;
    }
    const analyse = resultat.data;
    if (analyse.statut === "elements") {
      setLignes(
        analyse.elements.map((element, cle) => ({
          cle,
          element,
          retenue: moduleClient(element.type).retenueParDefaut?.(element) ?? true,
        }))
      );
      setEtape("apercu");
    } else if (analyse.statut === "question") {
      setQuestion({ texte: analyse.question, choix: analyse.choix });
      setEtape("question");
    } else {
      setErreur({ code: analyse.code, message: analyse.message, detail: analyse.detail });
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

  // Sélecteur de type d'une ligne : la proposition est refaite dans l'autre
  // module à partir de son titre (les détails propres à l'ancien type, comme
  // la date d'une tâche, ne sont pas conservés).
  function changerType(cle: number, type: TypeElement) {
    setLignes((courantes) =>
      courantes.map((l) => {
        if (l.cle !== cle || l.element.type === type) return l;
        const ancien = moduleClient(l.element.type);
        const moduleIA = moduleClient(type);
        const element = moduleIA.depuisTitre(ancien.titre(l.element));
        // Le choix de l'utilisateur est gardé, sauf quand il ne venait que de
        // l'état de départ : une proposition incomplète (repas sans aliment)
        // est décochée d'office, et repart cochée dès qu'elle devient complète.
        const completeAvant = ancien.retenueParDefaut?.(l.element) ?? true;
        const completeApres = moduleIA.retenueParDefaut?.(element) ?? true;
        return { cle, element, retenue: completeApres ? (completeAvant ? l.retenue : true) : false };
      })
    );
  }

  function basculerLigne(cle: number) {
    setLignes((courantes) => courantes.map((l) => (l.cle === cle ? { ...l, retenue: !l.retenue } : l)));
  }

  async function creer() {
    const retenues = lignes.filter((l) => l.retenue);
    if (retenues.length === 0 || creation) return;
    setCreation(true);

    const resultat = await runAction(
      () => creerElementsProposes(retenues.map((l) => moduleClient(l.element.type).versCreation(l.element))),
      { erreur: "La création a échoué. Réessaie." }
    );
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

    for (const moduleIA of new Set(retenues.map((l) => moduleClient(l.element.type)))) {
      moduleIA.invalider(queryClient);
    }
    if (reussies.size > 0) {
      const creees = retenues.filter((l) => reussies.has(l.cle)).map((l) => l.element);
      const moduleIA = moduleDuLot(creees);
      showToast(moduleIA ? moduleIA.libelles.creee(creees.length) : pluriel(creees.length, "Élément créé", "{n} éléments créés"));
    }

    if (echecs.size === 0) {
      reinitialiser();
      return;
    }
    // Seuls les éléments en échec restent, avec la raison ; état courant
    // plutôt que la copie d'avant l'attente serveur.
    setLignes((courantes) =>
      courantes.filter((l) => echecs.has(l.cle)).map((l) => ({ ...l, retenue: true, echec: echecs.get(l.cle) }))
    );
  }

  async function modifier(ligne: Ligne) {
    const moduleIA = moduleClient(ligne.element.type);
    let element = ligne.element;
    if (moduleIA.preparerEdition) {
      setPreparation(ligne.cle);
      const resultat = await moduleIA.preparerEdition(element);
      setPreparation(null);
      if (!resultat.ok) return;
      element = resultat.data;
    }
    setEdition({ cle: ligne.cle, moduleIA, element, titre: moduleIA.titre(element) });
  }

  function creerSimple() {
    setEdition({ cle: null, moduleIA: MODULE_PAR_DEFAUT, element: null, titre: texte.trim() });
  }

  function formulaireTermine(avertissement?: string) {
    const courante = edition;
    if (!courante) return;
    courante.moduleIA.invalider(queryClient);
    if (avertissement) showToast(avertissement, DUREE_TOAST_AVERTISSEMENT_MS);
    showToast(courante.moduleIA.libelles.creee(1));
    goBackSteps(1);

    if (courante.cle == null) {
      reinitialiser();
      return;
    }
    const cleCreee = courante.cle;
    const restantes = lignes.filter((l) => l.cle !== cleCreee);
    if (restantes.length === 0) reinitialiser();
    else setLignes(restantes);
  }

  const retenues = lignes.filter((l) => l.retenue).length;
  // Libellés de l'aperçu : ceux du module quand toutes les lignes en viennent,
  // neutres sinon. Le bouton de validation suit les lignes retenues (ce qui
  // sera créé), le reste suit toutes les lignes affichées.
  const elementsApercu = lignes.map((l) => l.element);
  const elementsRetenus = lignes.filter((l) => l.retenue).map((l) => l.element);
  const nomElements = libellesLot(moduleDuLot(elementsApercu));
  const nomRetenus = libellesLot(moduleDuLot(elementsRetenus.length > 0 ? elementsRetenus : elementsApercu));
  const sousTitre = !ouvert
    ? TEXTES_SAISIE.invite
    : {
        saisie: TEXTES_SAISIE.invite,
        analyse: "Analyse en cours…",
        question: "Une précision est nécessaire",
        apercu: nomElements.aValider(lignes.length),
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
                    {TEXTES_SAISIE.label}
                  </label>
                  <textarea
                    id={champId}
                    ref={champRef}
                    rows={3}
                    value={texte}
                    maxLength={MAX_TEXTE}
                    enterKeyHint="send"
                    placeholder={TEXTES_SAISIE.placeholder}
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
                    {lignes.length === 1 ? nomElements.verifier : "Décoche ce que tu ne veux pas, puis valide."}
                  </p>
                  <ul className="flex flex-col divide-y divide-line">
                    {lignes.map((ligne) => {
                      const moduleIA = moduleClient(ligne.element.type);
                      const titre = moduleIA.titre(ligne.element);
                      return (
                        <li key={ligne.cle} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <CheckToggle
                            checked={ligne.retenue}
                            onToggle={() => basculerLigne(ligne.cle)}
                            label={`Créer « ${titre} »`}
                            hitSlop={8}
                            className="mt-0.5"
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`min-w-0 flex-1 text-balance text-[14px] font-semibold ${ligne.retenue ? "text-ink" : "text-ink-2 line-through"}`}>
                                {titre}
                              </p>
                              <button
                                type="button"
                                disabled={preparation !== null}
                                onClick={() => void modifier(ligne)}
                                onPointerDown={moduleIA.precharger}
                                onFocus={moduleIA.precharger}
                                aria-label={`Modifier « ${titre} »`}
                                className={`${ghostButton} -mt-1.5 shrink-0 disabled:opacity-60`}
                              >
                                {preparation === ligne.cle ? "…" : "Modifier"}
                              </button>
                            </div>
                            {TYPES_ELEMENT.length > 1 && (
                              <select
                                aria-label={`Type de « ${titre} »`}
                                value={ligne.element.type}
                                disabled={creation}
                                onChange={(e) => changerType(ligne.cle, e.target.value as TypeElement)}
                                className={`min-h-9 w-fit rounded-full border border-line bg-surface-alt px-3 text-[12.5px] font-semibold text-ink disabled:opacity-60 ${focusRing}`}
                              >
                                {TYPES_ELEMENT.map((type) => (
                                  <option key={type} value={type}>
                                    {moduleClient(type).nomType}
                                  </option>
                                ))}
                              </select>
                            )}
                            <moduleIA.Detail element={ligne.element} />
                            {ligne.echec && (
                              <p role="alert" className="text-[12.5px] font-medium text-alert">
                                {ligne.echec}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void creer()}
                      disabled={retenues === 0 || creation}
                      className={`${primaryButton} min-h-11 w-full`}
                    >
                      {creation ? "Création…" : retenues === 0 ? nomRetenus.aucuneRetenue : nomRetenus.creer(retenues)}
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
                    {erreur.detail && (
                      <p className="break-words text-[12.5px] text-ink-2">Détail : {erreur.detail}</p>
                    )}
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
                      onPointerDown={MODULE_PAR_DEFAUT.precharger}
                      onFocus={MODULE_PAR_DEFAUT.precharger}
                      className={`${erreur.code === "quota" ? primaryButton : secondaryButton} min-h-11 w-full`}
                    >
                      {MODULE_PAR_DEFAUT.libelles.creationSimple}
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
          <Modal key="edition" title={edition.moduleIA.libelles.titreFormulaire} onClose={() => history.back()}>
            <edition.moduleIA.Formulaire edition={edition} onDone={formulaireTermine} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
