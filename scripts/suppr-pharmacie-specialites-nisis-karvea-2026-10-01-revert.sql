-- Retour arrière de suppr-pharmacie-specialites-nisis-karvea-2026-10-01.sql.
-- Recrée Nisis et Karvea avec leurs dosages ; rejouable sans doublon.

insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('valsartan', 'Nisis', '40 mg, 80 mg, 160 mg'),
  ('irbésartan', 'Karvea', '75 mg, 150 mg, 300 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = s.dci
on conflict (molecule_id, (lower(nom))) do nothing;
