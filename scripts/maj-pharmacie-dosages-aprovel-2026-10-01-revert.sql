-- Retour arrière de maj-pharmacie-dosages-aprovel-2026-10-01.sql.

update public.pharma_ref_specialites s
set dosages = '75 mg, 150 mg, 300 mg'
from public.pharma_ref_molecules m
where m.id = s.molecule_id
  and lower(m.dci) = 'irbésartan'
  and lower(s.nom) = 'aprovel';
