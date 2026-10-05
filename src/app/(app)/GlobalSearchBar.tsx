"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { rechercheGlobale, type ModuleRecherche, type ResultatRecherche } from "@/app/actions/recherche";
import { input } from "@/lib/ui";
import { runAction } from "@/lib/actions/runAction";

function idOption(item: ResultatRecherche): string {
  return `recherche-option-${item.module}-${item.id}`;
}

const MODULE_INFO: Record<ModuleRecherche, { label: string; accentVar: string }> = {
  // Pas de bleu Protéines hors macros (Semantic-Only Macro Rule, T8).
  notes: { label: "Notes", accentVar: "var(--ink-2)" },
  taches: { label: "Tâches", accentVar: "var(--accent-agenda)" },
  recettes: { label: "Recettes", accentVar: "var(--accent-kcal)" },
  objectifs: { label: "Objectifs", accentVar: "var(--accent-objectifs)" },
  courses: { label: "Courses", accentVar: "var(--accent-courses)" },
};

const ORDRE_MODULES: ModuleRecherche[] = ["notes", "taches", "recettes", "objectifs", "courses"];

function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

export function GlobalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [aRecherche, setARecherche] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const q = query.trim();
      if (q.length < 2) {
        setResultats([]);
        setARecherche(false);
        return;
      }
      // Contrat T1 : un échec (hors ligne, Supabase lent) s'affiche dans la
      // liste déroulante au lieu de faire basculer tout le dashboard sur
      // error.tsx. Pas de toast : la recherche se relance à chaque frappe.
      startTransition(async () => {
        const resultat = await runAction(() => rechercheGlobale(q), {
          silencieux: true,
          erreur: "La recherche a échoué. Réessaie dans un instant.",
        });
        if (!resultat.ok) {
          setErreur(resultat.error);
          setResultats([]);
          setARecherche(true);
          return;
        }
        setErreur(null);
        setResultats(resultat.data);
        setARecherche(true);
        setActiveIndex(-1);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const dropdownVisible = ouvert && query.trim().length >= 2;

  const groupes = ORDRE_MODULES.map((module) => ({
    module,
    items: resultats.filter((r) => r.module === module),
  })).filter((g) => g.items.length > 0);

  const flatItems = groupes.flatMap((g) => g.items);

  function selectionner(item: ResultatRecherche) {
    setOuvert(false);
    setQuery("");
    router.push(item.href);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!dropdownVisible || flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectionner(flatItems[activeIndex]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
          <SearchIcon color="var(--ink-3)" />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOuvert(true)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher dans Kilio…"
          aria-expanded={dropdownVisible}
          aria-controls="recherche-globale-listbox"
          aria-activedescendant={activeIndex >= 0 ? idOption(flatItems[activeIndex]) : undefined}
          role="combobox"
          aria-autocomplete="list"
          autoComplete="off"
          className={`${input} w-full pl-10 pr-9`}
        />
        {isPending && (
          <span className="absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-ink-3" />
        )}
      </div>

      {dropdownVisible && (
        <div
          id="recherche-globale-listbox"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto rounded-[20px] border border-line bg-surface p-2 shadow-card"
        >
          {groupes.length === 0 ? (
            erreur ? (
              <p role="alert" className="px-3 py-4 text-center text-[13.5px] text-alert">
                {erreur}
              </p>
            ) : (
              <p className="px-3 py-4 text-center text-[13.5px] text-ink-2">
                {aRecherche ? "Aucun résultat." : "Recherche…"}
              </p>
            )
          ) : (
            <div className="flex flex-col gap-2">
              {groupes.map(({ module, items }) => (
                <div key={module} className="flex flex-col gap-1">
                  <span
                    className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: MODULE_INFO[module].accentVar }}
                  >
                    {MODULE_INFO[module].label}
                  </span>
                  {items.map((item) => {
                    const active = flatItems.indexOf(item) === activeIndex;
                    return (
                      <Link
                        key={`${module}-${item.id}`}
                        id={idOption(item)}
                        href={item.href}
                        role="option"
                        aria-selected={active}
                        onClick={() => selectionner(item)}
                        className={`flex flex-col rounded-2xl px-2.5 py-2 transition-colors hover:bg-surface-alt ${
                          active ? "bg-surface-alt" : ""
                        }`}
                      >
                        <span className="truncate text-[14px] font-semibold text-ink">{item.titre}</span>
                        {item.sousTitre && (
                          <span className="truncate text-[12px] text-ink-2">{item.sousTitre}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
