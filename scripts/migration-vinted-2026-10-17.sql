-- Module Vinted : brouillons d'annonces, leurs photos et les réglages
-- réutilisables (signature, colis par défaut, hashtags). Même pattern que
-- collections / tache_images : pas de RLS, pas de user_id (app mono-utilisateur),
-- photos supprimées en cascade avec l'annonce.
--
-- Les fichiers des photos vivent dans le bucket public `vinted-images`
-- (supprimés par l'action supprimerAnnonce, pas par la cascade SQL).

begin;

create table vinted_annonces (
  id uuid primary key default gen_random_uuid(),
  titre text not null default '',
  description text not null default '',
  hashtags text[] not null default '{}',
  categorie text not null default '',
  marque text not null default '',
  taille text not null default '',
  etat text not null default '',
  couleur text not null default '',
  matiere text not null default '',
  prix numeric(8, 2) check (prix is null or prix >= 0),
  colis text not null default '',
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'pret', 'publie', 'vendu', 'retire')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_vinted_annonces_statut on vinted_annonces(statut, created_at desc);

create table vinted_photos (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references vinted_annonces(id) on delete cascade,
  url text not null,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_vinted_photos_annonce_id on vinted_photos(annonce_id, ordre);

-- Une seule ligne de réglages (id forcé à true).
create table vinted_reglages (
  id boolean primary key default true check (id),
  signature text not null default '',
  colis_defaut text not null default '',
  hashtags_communs text[] not null default '{}',
  -- { "<catégorie en minuscules>": ["#tag", ...] }
  hashtags_par_categorie jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into vinted_reglages (id) values (true) on conflict do nothing;

insert into storage.buckets (id, name, public)
values ('vinted-images', 'vinted-images', true)
on conflict (id) do nothing;

commit;
