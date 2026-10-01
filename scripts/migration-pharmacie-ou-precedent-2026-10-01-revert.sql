-- Retour arrière de migration-pharmacie-ou-precedent-2026-10-01.sql.
-- Les lignes « ajout » d'avant ne sont pas restaurées (voir
-- maj-pharmacie-hypertension-ajout-2026-10-01.sql pour les rejouer).

alter table public.pharma_ref_ligne_items drop column if exists ou_precedent;

alter table public.pharma_ref_ligne_items drop constraint pharma_ref_ligne_items_role_check;
alter table public.pharma_ref_ligne_items
  add constraint pharma_ref_ligne_items_role_check
  check (role in ('traitement', 'association', 'ajout', 'eviter'));
