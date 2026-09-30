-- Module Pharmacie (cahier de cours personnel) — appliquée via le MCP Supabase
-- le 2026-09-30 (nom de migration : pharmacie_module). Copie versionnée ;
-- retour arrière : migration-pharmacie-2026-09-30-revert.sql.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table public.pharma_matieres (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index pharma_matieres_nom_uniq on public.pharma_matieres (lower(nom));

create table public.pharma_chapitres (
  id uuid primary key default gen_random_uuid(),
  matiere_id uuid not null references public.pharma_matieres(id) on delete cascade,
  nom text not null,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index pharma_chapitres_nom_uniq on public.pharma_chapitres (matiere_id, lower(nom));

create table public.pharma_notions (
  id uuid primary key default gen_random_uuid(),
  chapitre_id uuid not null references public.pharma_chapitres(id) on delete cascade,
  titre text not null,
  contenu text not null,
  tags text[] not null default '{}',
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pharma_notions_chapitre_idx on public.pharma_notions (chapitre_id, ordre);

create table public.pharma_cartes (
  id uuid primary key default gen_random_uuid(),
  notion_id uuid not null references public.pharma_notions(id) on delete cascade,
  question text not null,
  reponse text not null,
  echeance timestamptz not null default now(),
  intervalle_jours integer not null default 0,
  facilite numeric(4,2) not null default 2.5,
  repetitions integer not null default 0,
  dernier_passage timestamptz,
  created_at timestamptz not null default now()
);
create index pharma_cartes_echeance_idx on public.pharma_cartes (echeance);
create index pharma_cartes_notion_idx on public.pharma_cartes (notion_id);

create table public.pharma_historique (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  cible text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index pharma_historique_date_idx on public.pharma_historique (created_at desc);

alter table public.pharma_matieres enable row level security;
alter table public.pharma_chapitres enable row level security;
alter table public.pharma_notions enable row level security;
alter table public.pharma_cartes enable row level security;
alter table public.pharma_historique enable row level security;

-- Recherche tolérante aux accents, à la casse et aux petites fautes de frappe
-- (utilisée par le skill kilio-pharmacie-ajout pour repérer les doublons).
create or replace function public.pharma_rechercher(q text)
returns table (
  notion_id uuid,
  titre text,
  contenu text,
  tags text[],
  chapitre_id uuid,
  chapitre_nom text,
  matiere_id uuid,
  matiere_nom text,
  score real
)
language sql
stable
set search_path = public, extensions
as $$
  with terme as (select extensions.unaccent(lower(trim(q))) as t)
  select n.id, n.titre, n.contenu, n.tags, c.id, c.nom, m.id, m.nom,
    greatest(
      case when extensions.unaccent(lower(n.titre)) like '%' || terme.t || '%' then 1.0 else 0 end,
      case when extensions.unaccent(lower(array_to_string(n.tags, ' '))) like '%' || terme.t || '%' then 0.9 else 0 end,
      case when extensions.unaccent(lower(n.contenu)) like '%' || terme.t || '%' then 0.7 else 0 end,
      extensions.word_similarity(terme.t, extensions.unaccent(lower(n.titre || ' ' || array_to_string(n.tags, ' ') || ' ' || n.contenu)))::real * 0.6
    )::real as score
  from public.pharma_notions n
  join public.pharma_chapitres c on c.id = n.chapitre_id
  join public.pharma_matieres m on m.id = c.matiere_id, terme
  where length(terme.t) >= 2
    and (
      extensions.unaccent(lower(n.titre || ' ' || array_to_string(n.tags, ' ') || ' ' || n.contenu)) like '%' || terme.t || '%'
      or extensions.word_similarity(terme.t, extensions.unaccent(lower(n.titre || ' ' || array_to_string(n.tags, ' ') || ' ' || n.contenu))) > 0.45
    )
  order by score desc, n.titre
  limit 30;
$$;
