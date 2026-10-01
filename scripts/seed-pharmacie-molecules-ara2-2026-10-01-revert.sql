-- Retour arrière de seed-pharmacie-molecules-ara2-2026-10-01.sql.

delete from public.pharma_ref_molecules
where lower(dci) in ('losartan', 'valsartan', 'irbésartan', 'candésartan', 'telmisartan')
  and classe_id in (select id from public.pharma_ref_classes where lower(nom) = 'ara2');
