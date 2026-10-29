-- Documents : « vrac » (documents reçus par le partage Android, à trier) et
-- catégories gérables (jusqu'ici une liste fixe dans le code).
--
-- `documents.en_vrac` : true pour un document reçu par le partage Android et
-- pas encore trié (bouton « Trier » de /documents : Gemini propose un nom et
-- une catégorie, appliqués après aperçu). Les documents existants restent à
-- false. Seul le tri (ou l'ajout via le formulaire, qui reste à false) change
-- cette valeur : modifier un document à la main ne le sort pas du vrac.
--
-- `documents_categories` : catégories proposées dans le formulaire, par
-- Gemini et dans l'écran /documents/categories. `documents.categorie` reste
-- un simple texte (le `nom` de la catégorie) : renommer une catégorie met à
-- jour les documents côté application. Unicité insensible à la casse pour
-- éviter les doublons « Santé » / « santé ».

alter table documents
  add column en_vrac boolean not null default false;

create index documents_en_vrac_idx on documents (created_at) where en_vrac;

create table documents_categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index documents_categories_nom_unique on documents_categories (lower(btrim(nom)));

-- Les 6 catégories qui étaient en dur dans le code.
insert into documents_categories (nom) values
  ('Identité'),
  ('Véhicule'),
  ('Logement'),
  ('Santé'),
  ('Assurance'),
  ('Autre');

-- Même politique que les autres tables : RLS activée, aucune policy ; l'app
-- passe par le client service_role (src/lib/supabase/admin.ts).
alter table documents_categories enable row level security;
