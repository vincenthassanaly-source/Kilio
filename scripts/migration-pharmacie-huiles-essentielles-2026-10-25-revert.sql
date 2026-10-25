-- Retour arrière de migration-pharmacie-huiles-essentielles-2026-10-25.sql.
-- Supprime les cartes d'huiles puis la table (les autres cartes sont intactes).
begin;

delete from public.pharma_cartes where huile_id is not null;

alter table public.pharma_cartes drop constraint pharma_cartes_huile_type_unique;
alter table public.pharma_cartes drop constraint pharma_cartes_source;
alter table public.pharma_cartes add constraint pharma_cartes_source
  check (notion_id is not null or molecule_id is not null);
alter table public.pharma_cartes drop column he_type, drop column huile_id;

drop table public.pharma_he_huiles;

commit;
