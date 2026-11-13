// Appelée une fois par jour par pg_cron (cf.
// scripts/migration-nettoyage-auto-2026-09-11.sql), avant les rappels de
// tâches/documents. Supprime définitivement, dans tous les modules
// concernés, les items marqués « fait »/« coché » depuis plus de
// delai_jours (réglage lu dans reglages_nettoyage, ligne unique).
//
// termine_le (colonne dédiée sur chaque table, maintenue par le trigger
// set_termine_le()) sert de référence : contrairement à updated_at, elle ne
// change que lors du passage à « fait »/« coché », pas à chaque édition.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Table, et colonne statut associée (juste pour le log/retour ; la
// suppression se fait uniquement sur termine_le). Pas d'ordre particulier
// requis pour les FK : on ne supprime que les items eux-mêmes (sous_taches,
// note_items), jamais leurs parents (taches, notes), donc aucune cascade
// n'est déclenchée par ces suppressions.
const TABLES = ["taches", "sous_taches", "courses_items", "note_items"] as const;

Deno.serve(async () => {
  const { data: reglages, error: reglagesError } = await supabase
    .from("reglages_nettoyage")
    .select("actif, delai_jours")
    .eq("id", 1)
    .single();

  if (reglagesError) {
    return new Response(JSON.stringify({ error: reglagesError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!reglages.actif) {
    return new Response(JSON.stringify({ message: "Nettoyage désactivé." }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const seuil = new Date();
  seuil.setDate(seuil.getDate() - reglages.delai_jours);
  const seuilISO = seuil.toISOString();

  const supprimes: Record<string, number> = {};

  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .lt("termine_le", seuilISO)
      .not("termine_le", "is", null)
      .select("id");

    if (error) {
      return new Response(JSON.stringify({ error: error.message, table }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    supprimes[table] = data?.length ?? 0;
  }

  const { error: updateError } = await supabase
    .from("reglages_nettoyage")
    .update({ derniere_execution: new Date().toISOString() })
    .eq("id", 1);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ delaiJours: reglages.delai_jours, supprimes }), {
    headers: { "Content-Type": "application/json" },
  });
});
