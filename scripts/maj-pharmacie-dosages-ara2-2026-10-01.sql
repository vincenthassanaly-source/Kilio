-- Dosages des spécialités ARA2 ajoutées le même jour (comprimés, de mémoire :
-- à relire). Rejouable sans effet de bord.
-- Retour arrière : maj-pharmacie-dosages-ara2-2026-10-01-revert.sql.

update public.pharma_ref_specialites s
set dosages = d.dosages
from (values
  ('cozaar', '50 mg, 100 mg'),
  ('tareg', '40 mg, 80 mg, 160 mg'),
  ('nisis', '40 mg, 80 mg, 160 mg'),
  ('aprovel', '75 mg, 150 mg, 300 mg'),
  ('karvea', '75 mg, 150 mg, 300 mg'),
  ('atacand', '4 mg, 8 mg, 16 mg, 32 mg'),
  ('kenzen', '4 mg, 8 mg, 16 mg, 32 mg'),
  ('micardis', '20 mg, 40 mg, 80 mg')
) as d(nom, dosages)
where lower(s.nom) = d.nom
  and s.molecule_id in (
    select m.id from public.pharma_ref_molecules m
    join public.pharma_ref_classes c on c.id = m.classe_id
    where lower(c.nom) = 'ara2'
  );
