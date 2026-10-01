-- Molécules de la classe ARA2 : DCI seulement (ni indications, ni spécialités).
-- Rejouable sans doublon. Retour arrière : seed-pharmacie-molecules-ara2-2026-10-01-revert.sql.

insert into public.pharma_ref_molecules (dci, classe_id)
select m.dci, c.id
from (values ('losartan'), ('valsartan'), ('irbésartan'), ('candésartan'), ('telmisartan')) as m(dci)
join public.pharma_ref_classes c on lower(c.nom) = 'ara2'
on conflict ((lower(dci))) do nothing;
