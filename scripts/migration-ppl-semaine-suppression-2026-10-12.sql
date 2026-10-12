-- Séances de la semaine Push / Pull / Legs : suppression de l'ancien système de
-- créneaux (jour + heure), PARTIE 2 sur 2.
--
-- À appliquer APRÈS le déploiement du code et après
-- migration-ppl-semaine-2026-10-12.sql : l'ancien code lit encore seances /
-- seance_id / seances_rappel_actif et l'Edge Function envoyer-rappels-seances.
-- Irréversible pour le créneau LEGS (dimanche 14:00) et les 2 séances existantes ;
-- aucun entraînement n'y est lié (la table entrainements est vide).

-- Le rappel push de séance n'existe plus.
select cron.unschedule('rappels-seances')
where exists (select 1 from cron.job where jobname = 'rappels-seances');

alter table public.reglages_briefing drop column if exists seances_rappel_actif;

drop index if exists public.entrainements_seance_idx;
alter table public.entrainements drop column if exists seance_id;

drop table if exists public.seances;
drop table if exists public.creneaux_seance;
