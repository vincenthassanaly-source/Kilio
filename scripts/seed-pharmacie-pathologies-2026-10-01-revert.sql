-- Retour arrière de seed-pharmacie-pathologies-2026-10-01.sql.
-- Supprime aussi leurs protocoles éventuels (cascade).

delete from public.pharma_ref_pathologies
where lower(nom) in ('diabète de type 1', 'diabète de type 2', 'hypertension');
