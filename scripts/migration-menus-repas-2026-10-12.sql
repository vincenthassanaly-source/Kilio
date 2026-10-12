-- Menus de la semaine : repas planifiés par date et créneau (petit-déj,
-- déjeuner, collation, dîner). Un créneau contient une recette (quantite =
-- portions) ou un aliment (quantite en g/ml, comme journal_repas). `mange`
-- passe à vrai quand le repas est validé : la ligne correspondante du
-- Journal est alors créée et référencée par journal_repas_id (supprimer
-- l'entrée du Journal détache simplement le lien).
-- Appliquée sur le projet Supabase « kilio » via MCP (`menus_repas`) le 2026-10-12.
create table public.menus_repas (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  moment public.moment_repas not null,
  aliment_id uuid references public.aliments(id) on delete cascade,
  recette_id uuid references public.recettes(id) on delete cascade,
  quantite numeric not null check (quantite > 0),
  mange boolean not null default false,
  journal_repas_id uuid references public.journal_repas(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint menus_repas_un_seul_contenu check ((aliment_id is null) <> (recette_id is null))
);

create index menus_repas_date_idx on public.menus_repas (date);

-- RLS activée sans politique, comme les autres tables : seul le client admin
-- (service role) y accède.
alter table public.menus_repas enable row level security;
