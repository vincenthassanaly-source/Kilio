"use client";

import { useId, useState } from "react";
import { normalizeSearch } from "@/lib/normalize";
import { input, label } from "@/lib/ui";

const MAX_SUGGESTIONS = 8;

// Saisie de tags (indications, propriétés) : Entrée, virgule ou sortie du champ
// ajoute le tag ; les tags déjà utilisés dans les autres fiches sont proposés
// pour garder un vocabulaire cohérent (et donc des filtres utiles).
export function TagsInput({
  libelle,
  aide,
  placeholder,
  valeur,
  onChange,
  suggestions,
}: {
  libelle: string;
  aide?: string;
  placeholder?: string;
  valeur: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const id = useId();
  const [saisie, setSaisie] = useState("");

  function ajouter(brut: string) {
    const deja = new Set(valeur.map(normalizeSearch));
    const nouveaux: string[] = [];
    for (const morceau of brut.split(/[,\n]/)) {
      const tag = morceau.trim().replace(/\s+/g, " ");
      const cle = normalizeSearch(tag);
      if (!tag || deja.has(cle)) continue;
      deja.add(cle);
      nouveaux.push(tag);
    }
    if (nouveaux.length > 0) onChange([...valeur, ...nouveaux]);
    setSaisie("");
  }

  function retirer(tag: string) {
    onChange(valeur.filter((t) => t !== tag));
  }

  const choisis = new Set(valeur.map(normalizeSearch));
  const recherche = normalizeSearch(saisie);
  const proposees = suggestions
    .filter((s) => !choisis.has(normalizeSearch(s)) && (!recherche || normalizeSearch(s).includes(recherche)))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>
        {libelle}
      </label>
      {valeur.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${libelle} choisies`}>
          {valeur.map((tag) => (
            <li key={tag} className="inline-flex min-h-10 items-center rounded-full bg-surface-alt pl-3 text-[13.5px] font-medium text-ink">
              {tag}
              <button
                type="button"
                onClick={() => retirer(tag)}
                aria-label={`Retirer ${tag}`}
                className="flex size-10 items-center justify-center rounded-full text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
              >
                <svg aria-hidden viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        type="text"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            ajouter(saisie);
          }
        }}
        onBlur={() => saisie.trim() && ajouter(saisie)}
        placeholder={placeholder}
        enterKeyHint="done"
        autoCapitalize="none"
        className={input}
      />
      {aide && <p className="text-[12.5px] text-ink-2">{aide}</p>}
      {proposees.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Suggestions">
          {proposees.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => ajouter(s)}
                className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
              >
                <span aria-hidden>+</span>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
