-- Retour arrière de maj-pharmacie-dosages-ara2-2026-10-01.sql.

update public.pharma_ref_specialites s
set dosages = null
where lower(s.nom) in ('cozaar', 'tareg', 'nisis', 'aprovel', 'karvea', 'atacand', 'kenzen', 'micardis')
  and s.molecule_id in (
    select m.id from public.pharma_ref_molecules m
    join public.pharma_ref_classes c on c.id = m.classe_id
    where lower(c.nom) = 'ara2'
  );
