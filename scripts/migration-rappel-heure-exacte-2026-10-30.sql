-- Rappel « à l'heure exacte » (0 min avant) pour les tâches et les événements.
-- Nécessaire à la saisie en langage naturel (« rappelle-moi » sans délai).
-- À appliquer AVANT le déploiement du code : sans elle, un rappel à 0 est refusé.
alter table public.taches
  drop constraint if exists taches_rappel_minutes_check,
  add constraint taches_rappel_minutes_check check (rappel_minutes is null or rappel_minutes in (0, 5, 15, 30, 60, 1440));

alter table public.evenements
  drop constraint if exists evenements_rappel_minutes_check,
  add constraint evenements_rappel_minutes_check check (rappel_minutes is null or rappel_minutes in (0, 5, 15, 30, 60, 1440));
