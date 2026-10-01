-- Retire les spécialités Nisis (valsartan) et Karvea (irbésartan).
-- Retour arrière : suppr-pharmacie-specialites-nisis-karvea-2026-10-01-revert.sql.

delete from public.pharma_ref_specialites s
using public.pharma_ref_molecules m
where m.id = s.molecule_id
  and ((lower(m.dci) = 'valsartan' and lower(s.nom) = 'nisis')
    or (lower(m.dci) = 'irbésartan' and lower(s.nom) = 'karvea'));
