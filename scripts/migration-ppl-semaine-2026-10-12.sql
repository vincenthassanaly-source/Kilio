-- Séances de la semaine : Push / Pull / Legs sans date ni heure.
--
-- Avant : des créneaux (jour + heure) génèrent des séances datées, avec rappel
-- push, report et statut « faite ». Après : l'écran Aujourd'hui propose chaque
-- jour Push, Pull et Legs (routines A/B/C) et déduit « faite cette semaine » des
-- entraînements enregistrés, sans table de planning.
--
-- • entrainements.type_seance : type (PUSH / PULL / LEGS) d'un entraînement.
--   Copié de la routine suivie, ou choisi à la fin d'une séance libre. Il reste
--   même si la routine est supprimée plus tard.
--
-- PARTIE 1 sur 2, additive : à appliquer AVANT le déploiement du code (le
-- nouveau code écrit type_seance). La suppression de l'ancien système est dans
-- migration-ppl-semaine-suppression-2026-10-12.sql, à appliquer APRÈS.

alter table public.entrainements
  add column if not exists type_seance text null
  check (type_seance is null or type_seance in ('LEGS', 'PUSH', 'PULL'));

-- Rattrape les entraînements déjà enregistrés : le type de leur routine.
update public.entrainements e
set type_seance = r.type_seance
from public.routines r
where e.routine_id = r.id
  and e.type_seance is null
  and r.type_seance is not null;

create index if not exists entrainements_type_seance_date_idx on public.entrainements (date, type_seance);
