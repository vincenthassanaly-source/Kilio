-- Inbox : captures rapides à trier (tâche, note, événement), et lien conservé
-- entre une tâche et la note dont elle est issue. Appliquée sur le projet
-- Supabase « kilio » via MCP (`inbox_et_lien_tache_note`) le 2026-10-09.
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  texte text not null,
  created_at timestamptz not null default now(),
  constraint inbox_items_texte_check check (length(btrim(texte)) > 0)
);

create index inbox_items_created_at_idx on public.inbox_items (created_at);

alter table public.inbox_items enable row level security;

-- Supprimer la note ne supprime pas la tâche : le lien est simplement perdu.
alter table public.taches
  add column if not exists note_id uuid references public.notes(id) on delete set null;

create index if not exists taches_note_id_idx on public.taches (note_id) where note_id is not null;
