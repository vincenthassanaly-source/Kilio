-- Référentiel Pharmacie : « ou » entre alternatives d'une même étape
-- (colonne ou_precedent) ; le rôle « ajout » est abandonné (les lignes
-- concernées redeviennent « association »).
-- Retour arrière : migration-pharmacie-ou-precedent-2026-10-01-revert.sql.

update public.pharma_ref_ligne_items set role = 'association' where role = 'ajout';

alter table public.pharma_ref_ligne_items drop constraint pharma_ref_ligne_items_role_check;
alter table public.pharma_ref_ligne_items
  add constraint pharma_ref_ligne_items_role_check
  check (role in ('traitement', 'association', 'eviter'));

alter table public.pharma_ref_ligne_items
  add column ou_precedent boolean not null default false;
