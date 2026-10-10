// Lecture du journal d'écritures du faux Supabase (e2e/mock-supabase.mjs,
// route /__writes) : permet de vérifier ce que l'app a réellement envoyé à la
// base, au-delà de ce qu'affiche l'écran.
const MOCK = process.env.E2E_SUPABASE_URL ?? "http://localhost:54321";

type Ecriture = { method: string; table: string; body: unknown };

/** Remet le faux Supabase dans son état initial (données et journal d'écritures). */
export async function reinitialiserMock(): Promise<void> {
  await fetch(`${MOCK}/__reset`);
}

/**
 * Corps des écritures reçues pour une table, à plat (un insert groupé donne une
 * ligne par élément). `methode` : POST = insert/upsert, PATCH = update,
 * DELETE = suppression.
 */
export async function ecritures(table: string, methode: "POST" | "PATCH" | "DELETE"): Promise<Record<string, unknown>[]> {
  const toutes: Ecriture[] = await (await fetch(`${MOCK}/__writes`)).json();
  return toutes
    .filter((e) => e.method === methode && e.table === table)
    .flatMap((e) => (Array.isArray(e.body) ? e.body : [e.body]) as Record<string, unknown>[]);
}
