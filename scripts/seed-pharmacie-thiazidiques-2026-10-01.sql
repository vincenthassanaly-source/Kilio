-- Molécules de la classe « Diurétiques thiazidiques » : indapamide (Fludex LP
-- 1,5 mg) et hydrochlorothiazide (Esidrex 25 mg). Spécialités et dosages
-- vérifiés dans la base publique des médicaments (base-donnees-publique.medicaments.gouv.fr).
-- Rejouable sans doublon. Retour arrière : seed-pharmacie-thiazidiques-2026-10-01-revert.sql.

insert into public.pharma_ref_molecules (dci, classe_id)
select m.dci, c.id
from (values ('indapamide'), ('hydrochlorothiazide')) as m(dci)
join public.pharma_ref_classes c on lower(c.nom) = 'diurétiques thiazidiques'
on conflict ((lower(dci))) do nothing;

insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('indapamide', 'Fludex', '1,5 mg LP'),
  ('hydrochlorothiazide', 'Esidrex', '25 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = s.dci
on conflict (molecule_id, (lower(nom))) do nothing;
