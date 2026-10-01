-- Noms de spécialités des ARA2 ajoutés le même jour (sans dosages).
-- Rejouable sans doublon. Retour arrière : seed-pharmacie-specialites-ara2-2026-10-01-revert.sql.

insert into public.pharma_ref_specialites (molecule_id, nom)
select m.id, s.nom
from (values
  ('losartan', 'Cozaar'),
  ('valsartan', 'Tareg'),
  ('valsartan', 'Nisis'),
  ('irbésartan', 'Aprovel'),
  ('irbésartan', 'Karvea'),
  ('candésartan', 'Atacand'),
  ('candésartan', 'Kenzen'),
  ('telmisartan', 'Micardis')
) as s(dci, nom)
join public.pharma_ref_molecules m on lower(m.dci) = s.dci
on conflict (molecule_id, (lower(nom))) do nothing;
