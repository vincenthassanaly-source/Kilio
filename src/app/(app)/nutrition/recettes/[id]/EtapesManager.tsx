"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addEtape, removeEtape, updateEtape, type EtapeFormState } from "@/app/actions/recette-etapes";
import type { Tables } from "@/lib/supabase/types";
import {
  actionsLigne,
  cardTight,
  dangerButton,
  errorText,
  ghostButton,
  input,
  nameTextComplet,
  primaryButton,
} from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";

type EtapeRow = Tables<"recette_etapes">;

function EtapeLine({ etape, index, recetteId }: { etape: EtapeRow; index: number; recetteId: string }) {
  const [editing, setEditing] = useState(false);
  const [titre, setTitre] = useState(etape.titre ?? "");
  const [consigne, setConsigne] = useState(etape.consigne);
  const [astuce, setAstuce] = useState(etape.astuce ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={`${cardTight} flex flex-col gap-2`}>
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Titre (optionnel)"
                className={`text-sm ${input}`}
              />
              <textarea
                value={consigne}
                onChange={(e) => setConsigne(e.target.value)}
                rows={3}
                placeholder="Consigne"
                className={`text-sm ${input}`}
              />
              <textarea
                value={astuce}
                onChange={(e) => setAstuce(e.target.value)}
                rows={2}
                placeholder="Astuce du chef (optionnel)"
                className={`text-sm ${input}`}
              />
            </div>
          ) : (
            <>
              <p className={nameTextComplet}>
                Étape {index + 1}
                {etape.titre ? ` — ${etape.titre}` : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{etape.consigne}</p>
              {etape.astuce && (
                <p className="mt-1 text-xs italic text-ink-2">Astuce : {etape.astuce}</p>
              )}
            </>
          )}
          {error && <p className={errorText}>{error}</p>}
        </div>
        <div className={actionsLigne}>
          {editing ? (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await updateEtape(etape.id, recetteId, titre, consigne, astuce);
                      setEditing(false);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erreur inconnue.");
                    }
                  });
                }}
                className={ghostButton}
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitre(etape.titre ?? "");
                  setConsigne(etape.consigne);
                  setAstuce(etape.astuce ?? "");
                  setEditing(false);
                }}
                className={ghostButton}
              >
                Annuler
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
                Éditer
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirmDelete(`Supprimer l'étape ${index + 1} ?`)) return;
                  setError(null);
                  startTransition(async () => {
                    try {
                      await removeEtape(etape.id, recetteId);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erreur inconnue.");
                    }
                  });
                }}
                className={dangerButton}
              >
                Suppr.
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

const initialState: EtapeFormState = { error: null };

function AddEtapeForm({ recetteId }: { recetteId: string }) {
  const [state, formAction, pending] = useActionState(addEtape, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      formRef.current?.reset();
    }
    prevPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="recette_id" value={recetteId} />

      <input name="titre" placeholder="Titre (optionnel, ex. Aux fourneaux !)" className={input} />
      <textarea name="consigne" placeholder="Consigne" rows={3} required className={input} />
      <textarea name="astuce" placeholder="Astuce du chef (optionnel)" rows={2} className={input} />

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Ajout..." : "+ Ajouter l'étape"}
      </button>
    </form>
  );
}

export function EtapesManager({ recetteId, etapes }: { recetteId: string; etapes: EtapeRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      {etapes.length === 0 ? (
        <p className="text-sm text-ink-2">Aucune étape pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {etapes.map((etape, index) => (
            <EtapeLine key={etape.id} etape={etape} index={index} recetteId={recetteId} />
          ))}
        </ul>
      )}

      <AddEtapeForm recetteId={recetteId} />
    </div>
  );
}
