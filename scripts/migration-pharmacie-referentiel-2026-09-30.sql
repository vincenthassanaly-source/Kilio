-- Référentiel Pharmacie (classes, molécules, spécialités, pathologies,
-- protocoles) — à côté du cahier de cours. Copie versionnée ; retour arrière :
-- migration-pharmacie-referentiel-2026-09-30-revert.sql.

create table public.pharma_ref_classes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  parent_id uuid references public.pharma_ref_classes(id) on delete set null,
  atc text,
  mecanisme text,
  contre_indications text,
  interactions text,
  conseils text,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index pharma_ref_classes_nom_uniq on public.pharma_ref_classes (lower(nom));
create index pharma_ref_classes_parent_idx on public.pharma_ref_classes (parent_id);

create table public.pharma_ref_molecules (
  id uuid primary key default gen_random_uuid(),
  dci text not null,
  classe_id uuid not null references public.pharma_ref_classes(id) on delete cascade,
  association boolean not null default false,
  composants text[] not null default '{}',
  indications text[] not null default '{}',
  particularites text,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index pharma_ref_molecules_dci_uniq on public.pharma_ref_molecules (lower(dci));
create index pharma_ref_molecules_classe_idx on public.pharma_ref_molecules (classe_id);

create table public.pharma_ref_specialites (
  id uuid primary key default gen_random_uuid(),
  molecule_id uuid not null references public.pharma_ref_molecules(id) on delete cascade,
  nom text not null,
  dosages text,
  created_at timestamptz not null default now()
);
create unique index pharma_ref_specialites_nom_uniq on public.pharma_ref_specialites (molecule_id, lower(nom));

create table public.pharma_ref_pathologies (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  resume text,
  source text,
  source_date text,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index pharma_ref_pathologies_nom_uniq on public.pharma_ref_pathologies (lower(nom));

-- Une ligne = une étape de la stratégie (rang 1, 2, 3…) pour un profil
-- patient donné ("Général", "Insuffisance rénale"…).
create table public.pharma_ref_lignes (
  id uuid primary key default gen_random_uuid(),
  pathologie_id uuid not null references public.pharma_ref_pathologies(id) on delete cascade,
  profil text not null default 'Général',
  rang integer not null default 1,
  titre text not null,
  description text,
  created_at timestamptz not null default now()
);
create index pharma_ref_lignes_pathologie_idx on public.pharma_ref_lignes (pathologie_id, profil, rang);

create table public.pharma_ref_ligne_items (
  id uuid primary key default gen_random_uuid(),
  ligne_id uuid not null references public.pharma_ref_lignes(id) on delete cascade,
  classe_id uuid references public.pharma_ref_classes(id) on delete cascade,
  molecule_id uuid references public.pharma_ref_molecules(id) on delete cascade,
  role text not null default 'traitement' check (role in ('traitement', 'association', 'eviter')),
  note text,
  ordre integer not null default 0,
  constraint pharma_ref_ligne_items_cible check (classe_id is not null or molecule_id is not null)
);
create index pharma_ref_ligne_items_ligne_idx on public.pharma_ref_ligne_items (ligne_id);
create index pharma_ref_ligne_items_classe_idx on public.pharma_ref_ligne_items (classe_id);
create index pharma_ref_ligne_items_molecule_idx on public.pharma_ref_ligne_items (molecule_id);

-- Les cartes du référentiel réutilisent la table et la révision existantes :
-- une carte est liée soit à une notion de cours, soit à une molécule.
alter table public.pharma_cartes alter column notion_id drop not null;
alter table public.pharma_cartes
  add column molecule_id uuid references public.pharma_ref_molecules(id) on delete cascade;
alter table public.pharma_cartes
  add constraint pharma_cartes_source check (notion_id is not null or molecule_id is not null);
create index pharma_cartes_molecule_idx on public.pharma_cartes (molecule_id);
create unique index pharma_cartes_molecule_question_uniq
  on public.pharma_cartes (molecule_id, question) where molecule_id is not null;

alter table public.pharma_ref_classes enable row level security;
alter table public.pharma_ref_molecules enable row level security;
alter table public.pharma_ref_specialites enable row level security;
alter table public.pharma_ref_pathologies enable row level security;
alter table public.pharma_ref_lignes enable row level security;
alter table public.pharma_ref_ligne_items enable row level security;
