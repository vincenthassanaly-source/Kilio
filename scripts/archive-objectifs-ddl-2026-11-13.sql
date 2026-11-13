-- ARCHIVE : structure du module Objectifs, relevée en base le 2026-11-13 juste
-- avant son retrait (scripts/migration-retrait-objectifs-2026-11-13.sql).
--
-- Ce fichier n'est PAS une migration à rejouer : il garde de quoi recréer les
-- tables si le module revenait. Les quatre tables étaient vides (0 ligne depuis
-- leur création), il n'y a donc aucune donnée à restaurer. Le CREATE TABLE
-- d'origine n'était dans aucun script du dépôt : ceci est reconstruit depuis
-- le catalogue Postgres (colonnes, contraintes, index, triggers, RLS).

create type public.categorie_objectif as enum ('perso', 'pro');
create type public.statut_objectif as enum ('en_cours', 'atteint', 'abandonne');
create type public.type_suivi_objectif as enum ('valeur', 'etapes', 'binaire', 'habitudes');

create table public.objectifs (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  categorie public.categorie_objectif not null default 'perso',
  statut public.statut_objectif not null default 'en_cours',
  type_suivi public.type_suivi_objectif not null default 'binaire',
  date_echeance date,
  valeur_cible numeric(10, 2),
  unite text,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint objectifs_unite_only_valeur check (type_suivi = 'valeur' or unite is null),
  constraint objectifs_valeur_cible_only_valeur check (type_suivi = 'valeur' or valeur_cible is null)
);
create index idx_objectifs_categorie_statut on public.objectifs (categorie, statut);
create index idx_objectifs_date_echeance on public.objectifs (date_echeance);
create trigger trg_objectifs_updated_at before update on public.objectifs
  for each row execute function set_updated_at();

create table public.objectif_etapes (
  id uuid primary key default gen_random_uuid(),
  objectif_id uuid not null references public.objectifs (id) on delete cascade,
  titre text not null,
  fait boolean not null default false,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  termine_le timestamptz
);
create index idx_objectif_etapes_objectif_id on public.objectif_etapes (objectif_id, ordre);
create trigger trg_objectif_etapes_termine_le before update on public.objectif_etapes
  for each row execute function set_termine_le();

create table public.objectif_entries (
  id uuid primary key default gen_random_uuid(),
  objectif_id uuid not null references public.objectifs (id) on delete cascade,
  date date not null,
  valeur numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  constraint objectif_entries_objectif_date_key unique (objectif_id, date)
);
create index idx_objectif_entries_objectif_id_date on public.objectif_entries (objectif_id, date);

create table public.objectif_habitudes (
  objectif_id uuid not null references public.objectifs (id) on delete cascade,
  habitude_id uuid not null references public.habitudes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (objectif_id, habitude_id)
);
create index idx_objectif_habitudes_habitude_id on public.objectif_habitudes (habitude_id);

-- RLS activée sur les quatre tables, sans aucune politique : seul le rôle
-- service (utilisé par l'app) y accédait.
alter table public.objectifs enable row level security;
alter table public.objectif_etapes enable row level security;
alter table public.objectif_entries enable row level security;
alter table public.objectif_habitudes enable row level security;
