-- Aprovel : le 75 mg n'est plus commercialisé (arrêts de commercialisation en
-- mars et juin 2025 d'après la base publique des médicaments) ; il ne reste que
-- 150 mg et 300 mg. Rejouable sans effet de bord.
-- Retour arrière : maj-pharmacie-dosages-aprovel-2026-10-01-revert.sql.

update public.pharma_ref_specialites s
set dosages = '150 mg, 300 mg'
from public.pharma_ref_molecules m
where m.id = s.molecule_id
  and lower(m.dci) = 'irbésartan'
  and lower(s.nom) = 'aprovel';
