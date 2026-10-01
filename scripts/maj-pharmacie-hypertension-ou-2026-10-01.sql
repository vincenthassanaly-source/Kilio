-- Hypertension : « ou » entre alternatives. À lancer après
-- migration-pharmacie-ou-precedent-2026-10-01.sql. Rejouable sans effet de bord.
-- Étapes 1 et 2 : ARA2 « ou » IEC. Étape 1 seulement : thiazidique « ou »
-- inhibiteur calcique. Retire les notes « Le deuxième… » de l'étape 2.
-- Retour arrière : maj-pharmacie-hypertension-ou-2026-10-01-revert.sql.

update public.pharma_ref_ligne_items i
set ou_precedent = true
from public.pharma_ref_lignes l, public.pharma_ref_pathologies p, public.pharma_ref_classes c
where i.ligne_id = l.id
  and p.id = l.pathologie_id
  and c.id = i.classe_id
  and lower(p.nom) = 'hypertension'
  and l.profil = 'Général'
  and (
    (l.rang in (1, 2) and i.role = 'traitement' and lower(c.nom) = 'ara2')
    or (l.rang = 1 and i.role = 'association' and lower(c.nom) = 'diurétiques thiazidiques')
  );

update public.pharma_ref_ligne_items i
set note = null
from public.pharma_ref_lignes l, public.pharma_ref_pathologies p
where i.ligne_id = l.id
  and p.id = l.pathologie_id
  and lower(p.nom) = 'hypertension'
  and l.rang = 2
  and i.note like 'Le deuxième, celui qui manquait%';
