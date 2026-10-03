-- Annule migration-sport-poses-2026-10-03.sql : supprime les poses dessinées
-- (les photos des exercices ne sont pas touchées).

ALTER TABLE public.sport_exercices
  DROP COLUMN IF EXISTS poses;
