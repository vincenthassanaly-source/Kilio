-- Événements : journée entière, rappel push et récurrence.
-- Appliquée sur le projet Supabase « kilio » via MCP (apply_migration
-- `evenements_journee_rappel_recurrence`), le 2026-10-09.
-- Une journée entière reste stockée avec heure 00:00 / heure_fin 23:59 pour
-- respecter la contrainte existante `heure_fin > heure`.
alter table public.evenements
  add column if not exists toute_la_journee boolean not null default false,
  add column if not exists rappel_minutes integer,
  add column if not exists rappel_occurrence_envoyee date,
  add column if not exists recurrence_frequence public.frequence_recurrence,
  add column if not exists recurrence_fin date;

alter table public.evenements
  drop constraint if exists evenements_rappel_minutes_check,
  add constraint evenements_rappel_minutes_check check (rappel_minutes is null or rappel_minutes in (5, 15, 30, 60, 1440)),
  drop constraint if exists evenements_recurrence_fin_check,
  add constraint evenements_recurrence_fin_check check (recurrence_fin is null or recurrence_frequence is not null);

create index if not exists evenements_recurrence_idx on public.evenements (recurrence_frequence) where recurrence_frequence is not null;
