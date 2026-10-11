-- Séances de sport : type limité à LEGS / PUSH / PULL.
-- Les types libres existants sont d'abord normalisés (seul « Legs » existait),
-- puis une contrainte verrouille la valeur côté base.

update public.creneaux_seance set type = 'LEGS' where upper(btrim(type)) = 'LEGS';
update public.seances set type = 'LEGS' where upper(btrim(type)) = 'LEGS';

alter table public.creneaux_seance
  add constraint creneaux_seance_type_liste_check check (type in ('LEGS', 'PUSH', 'PULL'));
alter table public.seances
  add constraint seances_type_liste_check check (type in ('LEGS', 'PUSH', 'PULL'));
