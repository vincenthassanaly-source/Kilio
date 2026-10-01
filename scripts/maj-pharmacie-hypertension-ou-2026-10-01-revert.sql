-- Retour arrière de maj-pharmacie-hypertension-ou-2026-10-01.sql.

update public.pharma_ref_ligne_items i
set ou_precedent = false
from public.pharma_ref_lignes l, public.pharma_ref_pathologies p
where i.ligne_id = l.id
  and p.id = l.pathologie_id
  and lower(p.nom) = 'hypertension';
