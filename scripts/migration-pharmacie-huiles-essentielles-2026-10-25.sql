-- Pharmacie : huiles essentielles (2026-10-25).
-- Nouvelle table pharma_he_huiles + lien des cartes de révision (pharma_cartes)
-- vers une huile. Une carte d'huile est identifiée par (huile_id, he_type) :
-- l'app la met à jour à l'enregistrement de la fiche sans perdre son état de
-- répétition espacée. Supprimer l'huile supprime ses cartes (ON DELETE CASCADE).
-- Retour arrière : migration-pharmacie-huiles-essentielles-2026-10-25-revert.sql.
begin;

create table public.pharma_he_huiles (
  id uuid primary key default gen_random_uuid(),
  nom_fr text not null check (length(btrim(nom_fr)) > 0),
  nom_latin text,
  famille text,
  partie_distillee text,
  chemotype text,
  indications text[] not null default '{}',
  proprietes text[] not null default '{}',
  -- orale = « comestible » ; les autres valeurs décrivent les voies d'usage.
  voies text[] not null default '{}'
    check (voies <@ array['orale','cutanee','diffusion','inhalation','bain']::text[]),
  dermocaustique boolean not null default false,
  photosensibilisante boolean not null default false,
  precautions text[] not null default '{}'
    check (precautions <@ array['grossesse','allaitement','enfant','epilepsie','asthme','hypertension','anticoagulants']::text[]),
  precautions_details text,
  dosage text,
  mode_emploi text,
  notes text,
  sources text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Même régime que les autres tables pharma_* : RLS active, accès par la clé
-- service uniquement (createAdminClient).
alter table public.pharma_he_huiles enable row level security;

alter table public.pharma_cartes
  add column huile_id uuid references public.pharma_he_huiles(id) on delete cascade,
  add column he_type text;

alter table public.pharma_cartes drop constraint pharma_cartes_source;
alter table public.pharma_cartes add constraint pharma_cartes_source
  check (notion_id is not null or molecule_id is not null or huile_id is not null);

-- NULL distincts : sans effet sur les cartes de notions et de molécules.
alter table public.pharma_cartes
  add constraint pharma_cartes_huile_type_unique unique (huile_id, he_type);

commit;
