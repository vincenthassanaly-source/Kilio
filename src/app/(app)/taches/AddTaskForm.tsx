"use client";

import { useId, startTransition, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  createTache,
  updateTache,
  type TacheAvecRelations,
  type TacheFormState,
} from "@/app/actions/taches";
import type { Enums, Tables } from "@/lib/supabase/types";
import { FREQUENCE_LABELS, aujourdhuiISO } from "@/lib/budget/compute";
import {
  DUREES_MINUTES,
  champsAvancesRenseignes,
  libelleDuree,
  messageHorsLigne,
  type TacheInitiale,
} from "@/lib/taches/compute";
import { isNetworkError } from "@/lib/offline/queue";
import { errorText, input, label as labelClass, primaryButton, secondaryButton } from "@/lib/ui";
import { SegmentedControl } from "@/components/SegmentedControl";

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M3.8 16.5l5-5a1.8 1.8 0 0 1 2.5 0l3.4 3.4M14.5 12.7l1.4-1.4a1.8 1.8 0 0 1 2.5 0l2.4 2.4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ImageThumb({
  src,
  onRemove,
  removeLabel,
  disabled,
}: {
  src: string;
  onRemove: () => void;
  removeLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative h-14 w-14 shrink-0">
      <Image
        src={src}
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 rounded-2xl border border-line object-cover"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-alert text-[11px] font-bold text-on-accent disabled:opacity-60"
      >
        ×
      </button>
    </div>
  );
}

const initialState: TacheFormState = { error: null };
// Marge sous next.config.ts (serverActions.bodySizeLimit: "4mb") : une
// requête refusée par cette limite plante toute la page (le fetch de
// Server Action échoue avant même que createTache/uploadTacheImages ne
// s'exécute, donc rien ne peut l'intercepter côté serveur). On bloque donc
// l'envoi en amont, côté client, avec un message clair plutôt que de
// laisser passer une requête vouée à échouer.
const MAX_IMAGES_TOTAL_BYTES = 3.8 * 1024 * 1024;
const FREQUENCES = Object.keys(FREQUENCE_LABELS) as Enums<"frequence_recurrence">[];
const TITRE_MAX_HEIGHT_PX = 160; // ~8-9 lignes avant de passer en scroll interne

const PRIORITES: { value: Enums<"priorite_tache">; label: string }[] = [
  { value: "aucune", label: "Aucune" },
  { value: "basse", label: "Basse" },
  { value: "moyenne", label: "Moyenne" },
  { value: "haute", label: "Haute" },
];

export function AddTaskForm({
  tache,
  listes,
  tags,
  defaultListeId,
  defaultEcheance,
  defaultHeure,
  initial,
  onDone,
}: {
  tache?: TacheAvecRelations;
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  defaultListeId?: string;
  defaultEcheance?: string;
  defaultHeure?: string;
  // Valeurs de départ en création (saisie en langage naturel) ; ignorées
  // dès que `tache` est fourni.
  initial?: TacheInitiale;
  // `id` : id de la tâche créée (création réussie uniquement, cf.
  // TacheFormState). `avertissement` : la tâche est créée mais une étape
  // secondaire (tags, images) a échoué. Les appelants qui n'en ont pas
  // besoin ignorent ces arguments.
  onDone?: (id?: string, avertissement?: string) => void;
}) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const actionServeur = tache ? updateTache : createTache;
  // Envoi impossible (hors ligne, erreur réseau) : on renvoie une erreur de
  // formulaire en français au lieu de laisser l'exception remonter jusqu'à
  // error.tsx, et la saisie est conservée. Aucune file hors ligne pour la
  // création/édition (formulaire avec fichiers) : c'est un simple réessai.
  // Toute autre erreur est relancée.
  const action = async (prevState: TacheFormState, formData: FormData): Promise<TacheFormState> => {
    const messageReseau = messageHorsLigne(Boolean(tache));
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { error: messageReseau };
    }
    try {
      return await actionServeur(prevState, formData);
    } catch (err) {
      if (isNetworkError(err)) return { error: messageReseau };
      throw err;
    }
  };
  const [state, formAction, pending] = useActionState(action, initialState);
  const prevPending = useRef(pending);

  const [titre, setTitre] = useState(tache?.titre ?? initial?.titre ?? "");
  const titreRef = useRef<HTMLTextAreaElement>(null);
  const echeanceRef = useRef<HTMLInputElement>(null);
  // Suivent l'état d'envoi hors rendu, pour que l'envoi par la touche Entrée
  // (handlers natifs) ne dépende jamais d'une valeur périmée et ne déclenche
  // jamais une seconde soumission pendant qu'une action est en cours.
  const pendingRef = useRef(pending);
  const submitLockRef = useRef(false);
  const shiftRef = useRef(false);

  // Replié par défaut en création. Déplié d'office quand des champs avancés
  // sont déjà renseignés : en édition, ou en création avec une heure
  // pré-remplie (créneau choisi dans l'Agenda) qu'on ne doit pas cacher.
  const [optionsOuvertes, setOptionsOuvertes] = useState(() =>
    tache
      ? champsAvancesRenseignes(tache)
      : Boolean(
          defaultHeure ||
            initial?.heure_fin ||
            initial?.rappel_minutes != null ||
            initial?.recurrence_frequence ||
            initial?.toute_la_journee ||
            initial?.tagIds?.length ||
            initial?.nouveauxTags?.length ||
            (initial?.priorite && initial.priorite !== "aucune")
        )
  );

  const [priorite, setPriorite] = useState<Enums<"priorite_tache">>(
    tache?.priorite ?? initial?.priorite ?? "aucune"
  );
  const [programmeJour, setProgrammeJour] = useState(tache?.programme_jour ?? false);
  const [duree, setDuree] = useState(tache?.duree_minutes != null ? String(tache.duree_minutes) : "");
  const [frequence, setFrequence] = useState<string>(
    tache?.recurrence_frequence ?? initial?.recurrence_frequence ?? ""
  );
  const [tagIds, setTagIds] = useState<string[]>(tache?.tags.map((t) => t.id) ?? initial?.tagIds ?? []);
  const [touteLaJournee, setTouteLaJournee] = useState(
    tache?.toute_la_journee ?? initial?.toute_la_journee ?? false
  );
  const [heure, setHeure] = useState(tache?.heure?.slice(0, 5) ?? defaultHeure ?? "");
  const [heureFin, setHeureFin] = useState(tache?.heure_fin?.slice(0, 5) ?? initial?.heure_fin ?? "");
  const [rappelMinutes, setRappelMinutes] = useState(
    tache?.rappel_minutes != null
      ? String(tache.rappel_minutes)
      : initial?.rappel_minutes != null
        ? String(initial.rappel_minutes)
        : ""
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const previews = useMemo(() => selectedFiles.map((file) => URL.createObjectURL(file)), [selectedFiles]);
  const [existingImages, setExistingImages] = useState<Tables<"tache_images">[]>(tache?.images ?? []);
  // Images retirées de l'affichage mais pas encore supprimées : le serveur
  // les supprime à « Enregistrer » (champs cachés `delete_image_ids`),
  // « Annuler » n'a donc rien à annuler. Conservé tel quel si l'envoi échoue.
  const [imagesASupprimer, setImagesASupprimer] = useState<string[]>([]);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      onDone?.(state.id, state.avertissement);
    }
    prevPending.current = pending;
  }, [pending, state.error, state.id, state.avertissement, onDone]);

  // Effet séparé, sans `onDone` dans ses dépendances : `onDone` change
  // d'identité à chaque rendu du parent, ce qui réarmerait le verrou d'envoi
  // en plein vol. `state` (objet renvoyé par l'action, identité stable entre
  // deux rendus) est là pour le cas où l'action se résout aussitôt (hors
  // ligne) : `pending` peut alors passer à vrai puis à faux dans le même lot
  // de rendu sans jamais changer de valeur visible.
  useEffect(() => {
    pendingRef.current = pending;
    if (!pending) submitLockRef.current = false;
  }, [pending, state]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  useEffect(() => {
    const textarea = titreRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, TITRE_MAX_HEIGHT_PX) + "px";
  }, [titre]);

  // Autofocus uniquement en création : ne vole pas le focus quand le formulaire sert à éditer une tâche existante.
  useEffect(() => {
    if (!tache) titreRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit s'exécuter qu'au montage
  }, []);

  // Entrée dans le titre = enregistrer (Maj+Entrée = saut de ligne). Le titre
  // reste un <textarea> pour afficher les titres longs, mais on n'y saisit
  // presque jamais de retour à la ligne : sur clavier mobile, valider doit
  // être un seul geste, sans fermer le clavier pour viser « Créer ».
  const envoyerDepuisTitre = useCallback(() => {
    const form = titreRef.current?.form;
    if (!form || pendingRef.current || submitLockRef.current) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    // Le verrou est posé par handleSubmit, que requestSubmit() déclenche.
    form.requestSubmit();
  }, []);

  function handleTitreKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    shiftRef.current = e.shiftKey;
    if (e.key !== "Enter" || e.shiftKey) return;
    // Saisie en cours de composition (IME, suggestions du clavier) : la
    // touche Entrée valide le mot, elle n'envoie pas le formulaire.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    envoyerDepuisTitre();
  }

  function handleTitreKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    shiftRef.current = e.shiftKey;
  }

  // Filet de sécurité pour les claviers mobiles dont le keydown de la touche
  // Entrée n'arrive pas sous la forme { key: "Enter" } : le navigateur émet
  // alors quand même un beforeinput « insertLineBreak ». Si keydown a déjà
  // traité Entrée (preventDefault), cet évènement n'est jamais émis.
  useEffect(() => {
    const textarea = titreRef.current;
    if (!textarea) return;
    function handleBeforeInput(event: InputEvent) {
      if (event.inputType !== "insertLineBreak" || event.isComposing || shiftRef.current) return;
      event.preventDefault();
      envoyerDepuisTitre();
    }
    textarea.addEventListener("beforeinput", handleBeforeInput);
    return () => textarea.removeEventListener("beforeinput", handleBeforeInput);
  }, [envoyerDepuisTitre]);

  function toggleTag(id: string) {
    setTagIds((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]));
  }

  // Le champ date reste non contrôlé (defaultValue) : on écrit directement
  // dans le DOM, la valeur est lue par FormData à l'envoi comme avant.
  function definirEcheanceAujourdhui() {
    if (echeanceRef.current) echeanceRef.current.value = aujourdhuiISO();
  }

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > MAX_IMAGES_TOTAL_BYTES) {
      setImagesError("Image trop volumineuse, réessayez avec une photo plus légère.");
      // Restaure la sélection précédente dans l'input : sinon son FileList
      // (ce qui est réellement soumis) se viderait alors que les vignettes
      // affichées (selectedFiles, inchangé) montreraient encore l'ancienne
      // sélection — même technique DataTransfer que removeSelectedFile.
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach((file) => dataTransfer.items.add(file));
      e.target.files = dataTransfer.files;
      return;
    }

    setImagesError(null);
    setSelectedFiles(files);
  }

  function removeSelectedFile(index: number) {
    const next = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(next);
    // Reconstruit le FileList de l'input à partir du tableau filtré : un
    // FileList n'est pas modifiable directement, DataTransfer est le
    // mécanisme standard pour repasser une sélection modifiée à l'input.
    const dataTransfer = new DataTransfer();
    next.forEach((file) => dataTransfer.items.add(file));
    if (fileInputRef.current) fileInputRef.current.files = dataTransfer.files;
  }

  // Différé : ne fait que retirer la vignette et mémoriser l'id, rien n'est
  // supprimé côté serveur avant « Enregistrer ».
  function removeExistingImage(imageId: string) {
    setExistingImages((imgs) => imgs.filter((img) => img.id !== imageId));
    setImagesASupprimer((ids) => (ids.includes(imageId) ? ids : [...ids, imageId]));
  }

  // <form onSubmit> plutôt que <form action> : React 19 réinitialise les
  // champs non contrôlés d'un formulaire à action (requestFormReset, appelé
  // avant l'action) même quand elle renvoie une erreur, ce qui effaçait
  // liste, échéance, notes, nouveaux tags et fichiers après un échec. Sans
  // prop `action`, React ne réinitialise rien. On appelle nous-mêmes
  // formAction, DANS une transition : c'est ce qui maintient `pending` à
  // vrai pendant l'action (dispatchActionState).
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Jamais deux envois en même temps (double tap, Entrée + « Créer ») : le
    // verrou couvre l'intervalle avant que `pending` ne soit rendu à vrai.
    if (pendingRef.current || submitLockRef.current) return;
    submitLockRef.current = true;
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {tache && <input type="hidden" name="id" value={tache.id} />}
      {tagIds.map((id) => (
        <input key={id} type="hidden" name="tag_ids" value={id} />
      ))}
      {imagesASupprimer.map((imageId) => (
        <input key={imageId} type="hidden" name="delete_image_ids" value={imageId} />
      ))}
      <input type="hidden" name="priorite" value={priorite} />
      {/* Durée d'origine : le serveur n'écrit la colonne que si elle change
          (cf. champDuree dans actions/taches.ts). */}
      <input type="hidden" name="duree_initiale" value={tache?.duree_minutes != null ? String(tache.duree_minutes) : ""} />

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-titre`} className={labelClass}>
          Titre
        </label>
        <textarea
          id={`${uid}-titre`}
          name="titre"
          required
          rows={1}
          ref={titreRef}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          onKeyDown={handleTitreKeyDown}
          onKeyUp={handleTitreKeyUp}
          enterKeyHint="done"
          className={`${input} resize-none overflow-y-auto max-h-40`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-liste_id`} className={labelClass}>
          Liste
        </label>
        <select
          id={`${uid}-liste_id`}
          name="liste_id"
          defaultValue={tache?.liste_id ?? defaultListeId ?? listes[0]?.id ?? ""}
          className={input}
        >
          {listes.map((liste) => (
            <option key={liste.id} value={liste.id}>
              {liste.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-echeance`} className={labelClass}>
          Échéance (optionnel)
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${uid}-echeance`}
            name="echeance"
            type="date"
            ref={echeanceRef}
            defaultValue={tache?.echeance ?? defaultEcheance ?? ""}
            className={`${input} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={definirEcheanceAujourdhui}
            aria-label="Définir l'échéance à aujourd'hui"
            className={`${secondaryButton} min-h-11 shrink-0 text-sm`}
          >
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      {/* Tous les champs ci-dessous restent dans le DOM même repliés (un
          <details> fermé ne démonte rien) : ils sont donc toujours soumis
          avec le formulaire. Ne jamais les rendre conditionnellement sur
          l'état d'ouverture — updateTache effacerait les tags de la tâche
          (tag_ids / nouveaux_tags absents du FormData). */}
      <details
        className="group border-t border-line"
        open={optionsOuvertes}
        onToggle={(e) => setOptionsOuvertes(e.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl py-1 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Plus d&apos;options</span>
            <span className="text-xs text-ink-2">Heure, rappel, notes, images…</span>
          </span>
          <span className="shrink-0 text-ink-2 transition-transform group-open:rotate-180 motion-reduce:transition-none">
            <ChevronIcon />
          </span>
        </summary>

        <div className="flex flex-col gap-3 pt-3">
          {!touteLaJournee && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-heure`} className={labelClass}>
                Heure (optionnel)
              </label>
              <input
                id={`${uid}-heure`}
                name="heure"
                type="time"
                value={heure}
                onChange={(e) => {
                  const nextHeure = e.target.value;
                  if (!heure && nextHeure && rappelMinutes === "") setRappelMinutes("5");
                  setHeure(nextHeure);
                }}
                className={input}
              />
            </div>
          )}

          {!touteLaJournee && heure && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-heure_fin`} className={labelClass}>
                Heure de fin (optionnel)
              </label>
              <input
                id={`${uid}-heure_fin`}
                name="heure_fin"
                type="time"
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                className={input}
              />
            </div>
          )}

          {!touteLaJournee && heure && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-rappel_minutes`} className={labelClass}>
                Rappel
              </label>
              <select
                id={`${uid}-rappel_minutes`}
                name="rappel_minutes"
                value={rappelMinutes}
                onChange={(e) => setRappelMinutes(e.target.value)}
                className={input}
              >
                <option value="">Aucun</option>
                <option value="5">5 min avant</option>
                <option value="15">15 min avant</option>
                <option value="30">30 min avant</option>
                <option value="60">1h avant</option>
                <option value="1440">1 jour avant (la veille)</option>
              </select>
            </div>
          )}

          {touteLaJournee && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-rappel_minutes`} className={labelClass}>
                Rappel
              </label>
              <select
                id={`${uid}-rappel_minutes`}
                name="rappel_minutes"
                value={rappelMinutes}
                onChange={(e) => setRappelMinutes(e.target.value)}
                className={input}
              >
                <option value="">Aucun</option>
                <option value="1440">La veille à 18h</option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-notes`} className={labelClass}>
              Notes (optionnel)
            </label>
            <textarea
              id={`${uid}-notes`}
              name="notes"
              rows={3}
              defaultValue={tache?.notes ?? ""}
              className={input}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                name="programme_jour"
                checked={programmeJour}
                onChange={(e) => setProgrammeJour(e.target.checked)}
                className="h-4 w-4 rounded border-line"
              />
              Tâche du jour
            </label>
            <p className="text-xs text-ink-2">
              Sera supprimée automatiquement si non cochée à la fin de la journée.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Images (optionnel)</span>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={`${uid}-tache-images`}
                className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-[1.5px] border-dashed border-line text-ink-2 transition-colors hover:bg-surface-alt"
                aria-label="Ajouter des images"
              >
                <ImageIcon />
              </label>
              <input
                ref={fileInputRef}
                type="file"
                id={`${uid}-tache-images`}
                name="images"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />

              {existingImages.map((image) => (
                <ImageThumb
                  key={image.id}
                  src={image.url}
                  onRemove={() => removeExistingImage(image.id)}
                  removeLabel="Supprimer cette image"
                />
              ))}

              {selectedFiles.map(
                (file, index) =>
                  previews[index] && (
                    <ImageThumb
                      key={`${file.name}-${index}`}
                      src={previews[index]}
                      onRemove={() => removeSelectedFile(index)}
                      removeLabel="Retirer cette image de la sélection"
                    />
                  )
              )}
            </div>
            {imagesError && (
              <p className={errorText} role="alert">
                {imagesError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Priorité</span>
            {/* Contrôle segmenté partagé (T7) : actif en vert Kcal. Les
                anciennes couleurs (ink-3, agenda, carbs, alert) détournaient
                des couleurs sémantiques et tombaient à 2,2:1 en sombre (T8). */}
            <SegmentedControl
              ariaLabel="Priorité"
              taille="sm"
              options={PRIORITES.map((p) => ({ value: p.value, label: p.label }))}
              value={priorite}
              onChange={setPriorite}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-duree_minutes`} className={labelClass}>
              Durée estimée
            </label>
            <select
              id={`${uid}-duree_minutes`}
              name="duree_minutes"
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
              className={input}
            >
              <option value="">Non renseignée</option>
              {/* Valeur existante hors liste (saisie ailleurs) : conservée. */}
              {duree && !DUREES_MINUTES.some((d) => String(d) === duree) && (
                <option value={duree}>{libelleDuree(Number(duree))}</option>
              )}
              {DUREES_MINUTES.map((d) => (
                <option key={d} value={d}>
                  {libelleDuree(d)}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              name="toute_la_journee"
              checked={touteLaJournee}
              onChange={(e) => {
                const checked = e.target.checked;
                // Les valeurs 5/15/30/60 n'existent pas dans le select "toute la
                // journée" (seul "" ou "1440" y a un sens) : on les efface pour
                // ne pas les soumettre silencieusement si elles restent d'une
                // saisie précédente avec heure.
                if (checked && rappelMinutes !== "" && rappelMinutes !== "1440") setRappelMinutes("");
                setTouteLaJournee(checked);
              }}
              className="h-4 w-4 rounded border-line"
            />
            Toute la journée
          </label>

          {tags.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                      tagIds.includes(tag.id) ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
                    }`}
                  >
                    #{tag.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-nouveaux_tags`} className={labelClass}>
              Nouveaux tags (optionnel, séparés par une virgule)
            </label>
            <input
              id={`${uid}-nouveaux_tags`}
              name="nouveaux_tags"
              defaultValue={initial?.nouveauxTags?.join(", ") ?? ""}
              placeholder="urgent, maison"
              className={input}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-recurrence_frequence`} className={labelClass}>
              Récurrence (optionnel)
            </label>
            <select
              id={`${uid}-recurrence_frequence`}
              name="recurrence_frequence"
              value={frequence}
              onChange={(e) => setFrequence(e.target.value)}
              className={input}
            >
              <option value="">Aucune récurrence</option>
              {FREQUENCES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCE_LABELS[f]}
                </option>
              ))}
            </select>
          </div>

          {frequence && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-recurrence_fin`} className={labelClass}>
                Fin de la récurrence (optionnel)
              </label>
              <input
                id={`${uid}-recurrence_fin`}
                name="recurrence_fin"
                type="date"
                defaultValue={tache?.recurrence_fin ?? initial?.recurrence_fin ?? ""}
                className={input}
              />
            </div>
          )}
        </div>
      </details>

      <div
        className="sticky bottom-0 z-10 flex flex-col items-center gap-2 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {state.error && (
          <p className={`${errorText} rounded-xl bg-surface px-3 py-1.5 shadow-card`} role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={`${primaryButton} shadow-card`}>
          {pending ? "Enregistrement..." : tache ? "Enregistrer" : "Créer"}
        </button>
      </div>
    </form>
  );
}
