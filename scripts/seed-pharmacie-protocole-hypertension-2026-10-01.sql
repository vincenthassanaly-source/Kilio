-- Protocole simple de l'hypertension (profil « Général », 3 étapes) et les
-- classes d'antihypertenseurs manquantes (sans médicaments).
-- Rejouable sans doublon. Retour arrière :
-- seed-pharmacie-protocole-hypertension-2026-10-01-revert.sql.

do $$
declare
  parent uuid;
  patho uuid;
  iec uuid;
  ara2 uuid;
  ic uuid;
  thiazidique uuid;
  etape uuid;
begin
  select id into parent from public.pharma_ref_classes where lower(nom) = 'antihypertenseurs';
  select id into patho from public.pharma_ref_pathologies where lower(nom) = 'hypertension';
  select id into iec from public.pharma_ref_classes where lower(nom) = 'iec';
  if parent is null or patho is null or iec is null then
    raise exception 'Antihypertenseurs, IEC ou la pathologie Hypertension introuvable';
  end if;

  insert into public.pharma_ref_classes (nom, parent_id) values
    ('ARA2', parent),
    ('Inhibiteurs calciques', parent),
    ('Diurétiques thiazidiques', parent)
  on conflict ((lower(nom))) do nothing;

  select id into ara2 from public.pharma_ref_classes where lower(nom) = 'ara2';
  select id into ic from public.pharma_ref_classes where lower(nom) = 'inhibiteurs calciques';
  select id into thiazidique from public.pharma_ref_classes where lower(nom) = 'diurétiques thiazidiques';

  -- Le protocole n'est posé que si la pathologie n'en a pas encore.
  if exists (select 1 from public.pharma_ref_lignes where pathologie_id = patho) then
    return;
  end if;

  insert into public.pharma_ref_lignes (pathologie_id, profil, rang, titre, description)
    values (patho, 'Général', 1, 'Deux médicaments d''emblée', 'Un IEC ou un ARA2, associé à un inhibiteur calcique ou à un thiazidique.')
    returning id into etape;
  insert into public.pharma_ref_ligne_items (ligne_id, classe_id, role, note, ordre) values
    (etape, iec, 'traitement', null, 1),
    (etape, ara2, 'traitement', null, 2),
    (etape, ic, 'association', null, 3),
    (etape, thiazidique, 'association', null, 4),
    (etape, ara2, 'eviter', 'Ne jamais l''associer à un IEC.', 5);

  insert into public.pharma_ref_lignes (pathologie_id, profil, rang, titre, description)
    values (patho, 'Général', 2, 'Trois médicaments si ça ne suffit pas', 'Un IEC ou un ARA2, un inhibiteur calcique et un thiazidique.')
    returning id into etape;
  insert into public.pharma_ref_ligne_items (ligne_id, classe_id, role, note, ordre) values
    (etape, iec, 'traitement', null, 1),
    (etape, ara2, 'traitement', null, 2),
    (etape, ic, 'association', null, 3),
    (etape, thiazidique, 'association', null, 4);

  insert into public.pharma_ref_lignes (pathologie_id, profil, rang, titre, description)
    values (patho, 'Général', 3, 'HTA résistante', 'Ajouter la spironolactone, puis demander un avis spécialisé.');
end $$;
