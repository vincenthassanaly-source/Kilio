-- Retour arrière de migration-pharmacie-referentiel-2026-09-30.sql.
-- Supprime aussi les cartes liées à une molécule.

delete from public.pharma_cartes where notion_id is null;
drop index if exists public.pharma_cartes_molecule_question_uniq;
drop index if exists public.pharma_cartes_molecule_idx;
alter table public.pharma_cartes drop constraint if exists pharma_cartes_source;
alter table public.pharma_cartes drop column if exists molecule_id;
alter table public.pharma_cartes alter column notion_id set not null;

drop table if exists public.pharma_ref_ligne_items;
drop table if exists public.pharma_ref_lignes;
drop table if exists public.pharma_ref_pathologies;
drop table if exists public.pharma_ref_specialites;
drop table if exists public.pharma_ref_molecules;
drop table if exists public.pharma_ref_classes;
