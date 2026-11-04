// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Garde-fou du JS client : un module "use client" (ou un module qu'il importe,
// directement ou non) ne doit pas importer next/server, next/cache ni
// next/headers. Ces modules sont en CommonJS, donc impossibles à élaguer :
// importer un seul utilitaire d'un fichier qui fait `import { connection }
// from "next/server"` embarque tout le runtime serveur de Next dans le JS de
// la page (≈ 92 Ko bruts sur le Journal, constaté le 2026-11-04). Un helper
// partagé avec le client doit vivre dans un module sans API serveur
// (ex. src/app/(app)/nutrition/journal/liens.ts).
//
// Les modules "use server" sont ignorés : le client n'en reçoit que des
// références (createServerReference), pas le code. Les imports de type
// (`import type`) sont effacés à la compilation.

const SRC = path.join(process.cwd(), "src");
const API_SERVEUR = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["'](next\/server|next\/cache|next\/headers)["']/m;
const DIRECTIVE_CLIENT = /^\s*["']use client["']/;
const DIRECTIVE_SERVEUR = /^\s*["']use server["']/;
// Une directive peut être précédée de commentaires : on les retire avant de la chercher.
const COMMENTAIRES_EN_TETE = /^(?:\s*(?:\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/))*/;

function aLaDirective(source: string, directive: RegExp): boolean {
  return directive.test(source.replace(COMMENTAIRES_EN_TETE, ""));
}

function fichiersSource(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersSource(chemin);
    return /\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

function resoudre(depuis: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(depuis), specifier);
  else return null;
  for (const suffixe of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidat = base + suffixe;
    if (existsSync(candidat) && statSync(candidat).isFile()) return candidat;
  }
  return null;
}

/** Imports et ré-exports à valeur (hors `import type` / `export type`), y compris `import "x"`. */
function importsAValeur(source: string): string[] {
  const motifs = [
    /^\s*import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm,
    /^\s*export\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm,
    /^\s*import\s+["']([^"']+)["']/gm,
  ];
  return motifs.flatMap((motif) => [...source.matchAll(motif)].map((m) => m[1]));
}

describe("frontière client / serveur", () => {
  it("aucun module client n'atteint next/server, next/cache ou next/headers", () => {
    const sources = new Map<string, string>();
    const lire = (f: string) => {
      if (!sources.has(f)) sources.set(f, readFileSync(f, "utf8"));
      return sources.get(f)!;
    };
    const entrees = fichiersSource(SRC).filter((f) => aLaDirective(lire(f), DIRECTIVE_CLIENT));
    expect(entrees.length).toBeGreaterThan(50);

    const fuites: string[] = [];
    for (const entree of entrees) {
      const vus = new Set<string>();
      const pile: { fichier: string; chemin: string[] }[] = [{ fichier: entree, chemin: [entree] }];
      while (pile.length > 0) {
        const { fichier, chemin } = pile.pop()!;
        if (vus.has(fichier)) continue;
        vus.add(fichier);
        const source = lire(fichier);
        if (fichier !== entree && aLaDirective(source, DIRECTIVE_SERVEUR)) continue;
        if (API_SERVEUR.test(source)) {
          fuites.push(chemin.map((f) => path.relative(SRC, f)).join(" → "));
          continue;
        }
        for (const specifier of importsAValeur(source)) {
          const cible = resoudre(fichier, specifier);
          if (cible) pile.push({ fichier: cible, chemin: [...chemin, cible] });
        }
      }
    }
    expect([...new Set(fuites)]).toEqual([]);
  });
});
