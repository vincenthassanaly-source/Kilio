-- Retour arrière de migration-pharmacie-role-ajout-2026-10-01.sql.
-- Les items « ajout » redeviennent « association » avant de resserrer la contrainte.

update public.pharma_ref_ligne_items set role = 'association' where role = 'ajout';

alter table public.pharma_ref_lignes drop column if exists nb_medicaments;

alter table public.pharma_ref_ligne_items drop constraint pharma_ref_ligne_items_role_check;
alter table public.pharma_ref_ligne_items
  add constraint pharma_ref_ligne_items_role_check
  check (role in ('traitement', 'association', 'eviter'));
