-- Retour arrière de seed-pharmacie-thiazidiques-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade).

delete from public.pharma_ref_molecules
where lower(dci) in ('indapamide', 'hydrochlorothiazide')
  and classe_id in (select id from public.pharma_ref_classes where lower(nom) = 'diurétiques thiazidiques');
