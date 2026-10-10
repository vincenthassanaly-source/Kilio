// Faux client Supabase pour tester les Server Actions sans réseau.
//
// Chaque requête (`from(table)…`) est enregistrée dans `appels` puis résolue
// par la fonction `repondre` fournie par le test (réponse par défaut :
// `{ data: null, error: null }`). Le constructeur est chaînable et « thenable »
// comme celui de supabase-js : on peut l'attendre directement ou terminer par
// `.single()` / `.maybeSingle()`.
//
// Usage :
//   const fake = fauxSupabase((a) => a.table === "taches" && a.action === "select" ? { data: {...} } : undefined);
//   vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
//   …
//   expect(fake.appels).toContainEqual(expect.objectContaining({ action: "update", payload: {...} }));

export type ActionSupabase = "select" | "insert" | "update" | "delete" | "upsert";

export type Appel = {
  table: string;
  action: ActionSupabase;
  payload?: unknown;
  /** Filtres dans l'ordre : ["eq", "id", "x"], ["in", "id", [...]], etc. */
  filtres: unknown[][];
  /** Modificateurs : ["order", "ordre", {…}], ["limit", 1], etc. */
  modificateurs: unknown[][];
  /** Terminé par `.single()` ou `.maybeSingle()`. */
  terminal?: "single" | "maybeSingle";
};

export type Reponse = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

export type Repondre = (appel: Appel) => Reponse | undefined;

/** Opération de stockage (`supabase.storage.from(bucket)…`). */
export type OperationStockage = {
  bucket: string;
  action: "upload" | "remove";
  /** `upload` : chemin du fichier. */
  chemin?: string;
  /** `remove` : chemins supprimés. */
  chemins?: string[];
  contentType?: string;
};

export type RepondreStockage = (op: OperationStockage) => { error?: { message: string } | null } | undefined;

const FILTRES = new Set([
  "eq", "neq", "in", "is", "lt", "lte", "gt", "gte", "like", "ilike", "or", "not", "contains", "match", "filter",
]);
const MODIFICATEURS = new Set(["order", "limit", "range", "abortSignal", "returns"]);

export function fauxSupabase(repondre: Repondre = () => undefined, repondreStockage: RepondreStockage = () => undefined) {
  const appels: Appel[] = [];
  const stockage: OperationStockage[] = [];

  function resoudre(appel: Appel): Reponse & { error: Reponse["error"] } {
    const r = repondre(appel) ?? {};
    return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
  }

  function constructeur(table: string) {
    const appel: Appel = { table, action: "select", filtres: [], modificateurs: [] };
    appels.push(appel);

    const b: Record<string, unknown> = {};
    const definirAction = (action: ActionSupabase) => (payload?: unknown) => {
      appel.action = action;
      if (payload !== undefined) appel.payload = payload;
      return b;
    };
    b.insert = definirAction("insert");
    b.update = definirAction("update");
    b.upsert = definirAction("upsert");
    b.delete = definirAction("delete");
    // `.select()` après une écriture demande seulement le retour des lignes.
    b.select = () => b;
    for (const f of FILTRES) b[f] = (...args: unknown[]) => (appel.filtres.push([f, ...args]), b);
    for (const m of MODIFICATEURS) b[m] = (...args: unknown[]) => (appel.modificateurs.push([m, ...args]), b);
    b.single = () => ((appel.terminal = "single"), Promise.resolve(resoudre(appel)));
    b.maybeSingle = () => ((appel.terminal = "maybeSingle"), Promise.resolve(resoudre(appel)));
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resoudre(appel)).then(ok, ko);
    return b;
  }

  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: (chemin: string, _corps: unknown, options?: { contentType?: string }) => {
          const op: OperationStockage = { bucket, action: "upload", chemin, contentType: options?.contentType };
          stockage.push(op);
          return Promise.resolve({ data: null, error: repondreStockage(op)?.error ?? null });
        },
        remove: (chemins: string[]) => {
          const op: OperationStockage = { bucket, action: "remove", chemins };
          stockage.push(op);
          return Promise.resolve({ data: null, error: repondreStockage(op)?.error ?? null });
        },
        getPublicUrl: (chemin: string) => ({
          data: { publicUrl: `https://stockage.test/storage/v1/object/public/${bucket}/${chemin}` },
        }),
      }),
    },
    from: (table: string) => constructeur(table),
    rpc: (fn: string, args?: unknown) => {
      const appel: Appel = { table: `rpc:${fn}`, action: "select", payload: args, filtres: [], modificateurs: [] };
      appels.push(appel);
      return Promise.resolve(resoudre(appel));
    },
  };

  return { client, appels, stockage };
}

/** Appels d'écriture d'une table, pour des assertions lisibles. */
export function ecritures(appels: Appel[], table: string, action?: ActionSupabase): Appel[] {
  return appels.filter((a) => a.table === table && a.action !== "select" && (!action || a.action === action));
}
