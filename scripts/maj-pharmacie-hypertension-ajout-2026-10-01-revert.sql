-- Retour arrière de maj-pharmacie-hypertension-ajout-2026-10-01.sql.

update public.pharma_ref_ligne_items i
set role = 'association', note = null
from public.pharma_ref_lignes l
join public.pharma_ref_pathologies p on p.id = l.pathologie_id
where i.ligne_id = l.id and lower(p.nom) = 'hypertension' and i.role = 'ajout';

update public.pharma_ref_lignes l
set nb_medicaments = null
from public.pharma_ref_pathologies p
where p.id = l.pathologie_id and lower(p.nom) = 'hypertension';
