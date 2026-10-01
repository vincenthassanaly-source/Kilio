-- Hypertension : rend la différence bithérapie / trithérapie visible.
-- Étape 1 = 2 médicaments, étape 2 = 3 médicaments ; à l'étape 2 l'inhibiteur
-- calcique et le thiazidique passent en « ajout ». À lancer après
-- migration-pharmacie-role-ajout-2026-10-01.sql. Rejouable sans effet de bord.
-- Retour arrière : maj-pharmacie-hypertension-ajout-2026-10-01-revert.sql.

update public.pharma_ref_lignes l
set nb_medicaments = case l.rang when 1 then 2 when 2 then 3 end
from public.pharma_ref_pathologies p
where p.id = l.pathologie_id
  and lower(p.nom) = 'hypertension'
  and l.profil = 'Général'
  and l.rang in (1, 2);

update public.pharma_ref_ligne_items i
set role = 'ajout', note = 'Le deuxième, celui qui manquait à l''étape 1.'
from public.pharma_ref_lignes l, public.pharma_ref_pathologies p, public.pharma_ref_classes c
where i.ligne_id = l.id
  and p.id = l.pathologie_id
  and c.id = i.classe_id
  and lower(p.nom) = 'hypertension'
  and l.profil = 'Général'
  and l.rang = 2
  and lower(c.nom) in ('inhibiteurs calciques', 'diurétiques thiazidiques')
  and i.role = 'association';
