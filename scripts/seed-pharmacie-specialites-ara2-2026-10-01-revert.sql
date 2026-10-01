-- Retour arrière de seed-pharmacie-specialites-ara2-2026-10-01.sql.

delete from public.pharma_ref_specialites s
using public.pharma_ref_molecules m
where m.id = s.molecule_id
  and lower(m.dci) in ('losartan', 'valsartan', 'irbésartan', 'candésartan', 'telmisartan')
  and lower(s.nom) in ('cozaar', 'tareg', 'nisis', 'aprovel', 'karvea', 'atacand', 'kenzen', 'micardis');
