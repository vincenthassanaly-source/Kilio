-- Référentiel Pharmacie : rôle « ajout » (médicament qui s'ajoute à l'étape
-- précédente) et compteur optionnel de médicaments par étape (« 2 médicaments »).
-- Retour arrière : migration-pharmacie-role-ajout-2026-10-01-revert.sql.

alter table public.pharma_ref_ligne_items drop constraint pharma_ref_ligne_items_role_check;
alter table public.pharma_ref_ligne_items
  add constraint pharma_ref_ligne_items_role_check
  check (role in ('traitement', 'association', 'ajout', 'eviter'));

alter table public.pharma_ref_lignes
  add column nb_medicaments smallint check (nb_medicaments is null or nb_medicaments between 1 and 9);
