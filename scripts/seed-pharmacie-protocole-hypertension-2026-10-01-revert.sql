-- Retour arrière de seed-pharmacie-protocole-hypertension-2026-10-01.sql.
-- Les items du protocole partent avec leurs lignes et leurs classes (cascade).

delete from public.pharma_ref_lignes
where pathologie_id in (select id from public.pharma_ref_pathologies where lower(nom) = 'hypertension');

delete from public.pharma_ref_classes
where lower(nom) in ('ara2', 'inhibiteurs calciques', 'diurétiques thiazidiques');
